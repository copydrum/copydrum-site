import { supabase } from './supabase';

export type DashboardAnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export interface DashboardAnalyticsSeriesPoint {
  label: string;
  start: string;
  pageViews: number;
  visitors: number;
  orderCount: number;
  revenue: number;
  newUsers: number;
  inquiryCount: number;
}

export interface DashboardAnalyticsMetrics {
  totalVisitors: number;
  visitorsChangePct: number;
  totalRevenue: number;
  revenueChangePct: number;
  totalNewUsers: number;
  newUsersChangePct: number;
}

export interface DashboardAnalyticsResult {
  period: DashboardAnalyticsPeriod;
  metrics: DashboardAnalyticsMetrics;
  series: DashboardAnalyticsSeriesPoint[];
}

type Bucket = {
  label: string;
  start: Date;
  end: Date;
};

type PageViewRow = { created_at: string | null; user_id: string | null };
type OrderRow = { created_at: string | null; total_amount: number | null };
type ProfileRow = { created_at: string | null };
type InquiryRow = { created_at: string | null };

const PERIOD_CONFIG: Record<DashboardAnalyticsPeriod, { buckets: number }> = {
  daily: { buckets: 7 },
  weekly: { buckets: 1 },
  monthly: { buckets: 12 },
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay();
  // 주 시작을 월요일로 지정
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const startOfMonth = (date: Date): Date => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

const addPeriod = (base: Date, period: DashboardAnalyticsPeriod, amount: number): Date => {
  const date = new Date(base);
  switch (period) {
    case 'daily': {
      date.setDate(date.getDate() + amount);
      break;
    }
    case 'weekly': {
      date.setDate(date.getDate() + amount * 7);
      break;
    }
    case 'monthly': {
      date.setMonth(date.getMonth() + amount);
      break;
    }
  }
  return date;
};

const formatLabel = (date: Date, period: DashboardAnalyticsPeriod): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  switch (period) {
    case 'daily':
      return `${month}-${day}`;
    case 'weekly':
      return `${month}-${day}`;
    case 'monthly':
      return `${year}-${month}`;
  }
};

const createBuckets = (period: DashboardAnalyticsPeriod, bucketCount: number, now: Date): Bucket[] => {
  let alignedNow: Date;
  let actualPeriod: DashboardAnalyticsPeriod;
  
  if (period === 'daily') {
    alignedNow = startOfDay(now);
    actualPeriod = 'daily';
  } else if (period === 'weekly') {
    // 주간별은 오늘 날짜로부터 일주일 전까지 일별로 표시
    alignedNow = startOfDay(now);
    actualPeriod = 'daily';
    bucketCount = 7; // 일주일치 = 7일
  } else {
    alignedNow = startOfMonth(now);
    actualPeriod = 'monthly';
  }
  
  const earliestStart = addPeriod(alignedNow, actualPeriod, -(bucketCount - 1));
  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    const start = addPeriod(earliestStart, actualPeriod, i);
    const end = addPeriod(start, actualPeriod, 1);
    buckets.push({
      label: formatLabel(start, actualPeriod),
      start,
      end,
    });
  }
  const lastIndex = buckets.length - 1;
  buckets[lastIndex].end = new Date(now);
  return buckets;
};

const computeChangePct = (current: number, previous: number): number => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
};

const sumRevenue = (rows: OrderRow[]): number =>
  rows.reduce((acc, row) => acc + (row.total_amount ?? 0), 0);

const generateSeries = (
  buckets: Bucket[],
  pageViews: PageViewRow[],
  orders: OrderRow[],
  profiles: ProfileRow[],
  inquiries: InquiryRow[]
): DashboardAnalyticsSeriesPoint[] => {
  const series = buckets.map<DashboardAnalyticsSeriesPoint>((bucket) => ({
    label: bucket.label,
    start: bucket.start.toISOString(),
    pageViews: 0,
    visitors: 0,
    orderCount: 0,
    revenue: 0,
    newUsers: 0,
    inquiryCount: 0,
  }));

  const locateBucket = (date: Date): number => {
    for (let i = 0; i < buckets.length; i += 1) {
      const bucket = buckets[i];
      if (date >= bucket.start && date < bucket.end) {
        return i;
      }
    }
    return -1;
  };

  // 페이지뷰 및 방문자 계산
  const uniqueVisitorsPerBucket: Map<number, Set<string>> = new Map();
  pageViews.forEach((row) => {
    if (!row.created_at) return;
    const bucketIndex = locateBucket(new Date(row.created_at));
    if (bucketIndex >= 0) {
      series[bucketIndex].pageViews += 1;
      
      // 고유 방문자 계산 (user_id 기준)
      if (row.user_id) {
        if (!uniqueVisitorsPerBucket.has(bucketIndex)) {
          uniqueVisitorsPerBucket.set(bucketIndex, new Set());
        }
        uniqueVisitorsPerBucket.get(bucketIndex)!.add(row.user_id);
      }
    }
  });

  // 고유 방문자 수 설정
  uniqueVisitorsPerBucket.forEach((userSet, bucketIndex) => {
    series[bucketIndex].visitors = userSet.size;
  });

  // 주문 수 및 매출 계산
  orders.forEach((row) => {
    if (!row.created_at) return;
    const bucketIndex = locateBucket(new Date(row.created_at));
    if (bucketIndex >= 0) {
      series[bucketIndex].orderCount += 1;
      series[bucketIndex].revenue += row.total_amount ?? 0;
    }
  });

  // 신규 가입자 계산
  profiles.forEach((row) => {
    if (!row.created_at) return;
    const bucketIndex = locateBucket(new Date(row.created_at));
    if (bucketIndex >= 0) {
      series[bucketIndex].newUsers += 1;
    }
  });

  // 문의 수 계산
  inquiries.forEach((row) => {
    if (!row.created_at) return;
    const bucketIndex = locateBucket(new Date(row.created_at));
    if (bucketIndex >= 0) {
      series[bucketIndex].inquiryCount += 1;
    }
  });

  return series;
};

const fetchPageViews = async (startIso: string, endIso: string): Promise<PageViewRow[]> => {
  const { data, error } = await supabase
    .from('page_views')
    .select('created_at, user_id')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`페이지 뷰 데이터를 불러오지 못했습니다: ${error.message}`);
  }
  return data ?? [];
};

const fetchOrders = async (startIso: string, endIso: string): Promise<OrderRow[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('created_at,total_amount')
    .eq('status', 'completed')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`주문 데이터를 불러오지 못했습니다: ${error.message}`);
  }
  return data ?? [];
};

const fetchProfiles = async (startIso: string, endIso: string): Promise<ProfileRow[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`가입자 데이터를 불러오지 못했습니다: ${error.message}`);
  }
  return data ?? [];
};

const fetchInquiries = async (startIso: string, endIso: string): Promise<InquiryRow[]> => {
  const { data, error } = await supabase
    .from('customer_inquiries')
    .select('created_at')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`문의 데이터를 불러오지 못했습니다: ${error.message}`);
  }
  return data ?? [];
};

export const getDashboardAnalytics = async (
  period: DashboardAnalyticsPeriod
): Promise<DashboardAnalyticsResult> => {
  const now = new Date();
  const { buckets } = PERIOD_CONFIG[period];
  const currentBuckets = createBuckets(period, buckets, now);
  const currentRangeStart = currentBuckets[0]?.start ?? startOfDay(now);
  const currentRangeEnd = now;

  const previousRangeEnd = new Date(currentRangeStart);
  const previousRangeStart = addPeriod(previousRangeEnd, period, -buckets);

  const [
    currentPageViews,
    previousPageViews,
    currentOrders,
    previousOrders,
    currentProfiles,
    previousProfiles,
    currentInquiries,
    previousInquiries,
  ] = await Promise.all([
    fetchPageViews(currentRangeStart.toISOString(), currentRangeEnd.toISOString()),
    fetchPageViews(previousRangeStart.toISOString(), previousRangeEnd.toISOString()),
    fetchOrders(currentRangeStart.toISOString(), currentRangeEnd.toISOString()),
    fetchOrders(previousRangeStart.toISOString(), previousRangeEnd.toISOString()),
    fetchProfiles(currentRangeStart.toISOString(), currentRangeEnd.toISOString()),
    fetchProfiles(previousRangeStart.toISOString(), previousRangeEnd.toISOString()),
    fetchInquiries(currentRangeStart.toISOString(), currentRangeEnd.toISOString()),
    fetchInquiries(previousRangeStart.toISOString(), previousRangeEnd.toISOString()),
  ]);

  const series = generateSeries(currentBuckets, currentPageViews, currentOrders, currentProfiles, currentInquiries);

  const totalVisitors = currentPageViews.length;
  const totalRevenue = sumRevenue(currentOrders);
  const totalNewUsers = currentProfiles.length;

  const previousVisitors = previousPageViews.length;
  const previousRevenue = sumRevenue(previousOrders);
  const previousNewUsers = previousProfiles.length;

  return {
    period,
    series,
    metrics: {
      totalVisitors,
      visitorsChangePct: computeChangePct(totalVisitors, previousVisitors),
      totalRevenue,
      revenueChangePct: computeChangePct(totalRevenue, previousRevenue),
      totalNewUsers,
      newUsersChangePct: computeChangePct(totalNewUsers, previousNewUsers),
    },
  };
};

export interface PageViewPayload {
  user_id?: string | null;
  session_id?: string | null;
  page_url: string;
  referrer?: string | null;
  user_agent?: string | null;
}

export const recordPageView = async (payload: PageViewPayload): Promise<void> => {
  const { error } = await supabase.from('page_views').insert({
    user_id: payload.user_id ?? null,
    session_id: payload.session_id ?? null,
    page_url: payload.page_url,
    referrer: payload.referrer ?? null,
    user_agent: payload.user_agent ?? null,
  });
  if (error) {
    throw new Error(`페이지 뷰 기록에 실패했습니다: ${error.message}`);
  }
};



