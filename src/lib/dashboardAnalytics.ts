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

type PageViewRow = { created_at: string | null; user_id: string | null; session_id: string | null; id?: string | null };
type OrderRow = { created_at: string | null; total_amount: number | null };
type ProfileRow = { created_at: string | null };
type InquiryRow = { created_at: string | null };

const PERIOD_CONFIG: Record<DashboardAnalyticsPeriod, { buckets: number }> = {
  daily: { buckets: 7 },      // 최근 7일
  weekly: { buckets: 8 },     // 최근 8주
  monthly: { buckets: 6 },    // 최근 6개월
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
    case 'weekly': {
      // 주간별: 해당 주의 시작일 표시 (예: 01-15)
      return `${month}-${day}`;
    }
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
    // 주간별: 주 단위로 그룹화
    alignedNow = startOfWeek(now);
    actualPeriod = 'weekly';
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
      
      // 고유 방문자 계산 (session_id 기준)
      // session_id가 있으면 사용, 없으면 id를 fallback으로 사용
      const visitorKey = row.session_id || (row.id ? `anon-${row.id}` : null);
      if (visitorKey) {
        if (!uniqueVisitorsPerBucket.has(bucketIndex)) {
          uniqueVisitorsPerBucket.set(bucketIndex, new Set());
        }
        uniqueVisitorsPerBucket.get(bucketIndex)!.add(visitorKey);
      }
    }
  });

  // 고유 방문자 수 설정
  uniqueVisitorsPerBucket.forEach((visitorSet, bucketIndex) => {
    series[bucketIndex].visitors = visitorSet.size;
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
    .select('id, created_at, user_id, session_id')
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

  // 고유 방문자 수 계산 (session_id 기준)
  const uniqueVisitorsSet = new Set<string>();
  currentPageViews.forEach((row) => {
    const visitorKey = row.session_id || (row.id ? `anon-${row.id}` : null);
    if (visitorKey) {
      uniqueVisitorsSet.add(visitorKey);
    }
  });
  const totalVisitors = uniqueVisitorsSet.size;

  const totalRevenue = sumRevenue(currentOrders);
  const totalNewUsers = currentProfiles.length;

  // 이전 기간 고유 방문자 수 계산
  const previousVisitorsSet = new Set<string>();
  previousPageViews.forEach((row) => {
    const visitorKey = row.session_id || (row.id ? `anon-${row.id}` : null);
    if (visitorKey) {
      previousVisitorsSet.add(visitorKey);
    }
  });
  const previousVisitors = previousVisitorsSet.size;
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



