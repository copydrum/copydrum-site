
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import PointChargeModal from '../../components/payments/PointChargeModal';
import MainHeader from '../../components/common/MainHeader';
import UserSidebar from '../../components/feature/UserSidebar';
import { useCart } from '../../hooks/useCart';
import { useUserCashBalance } from '../../hooks/useUserCashBalance';
import type { FavoriteSheet } from '../../lib/favorites';
import { fetchUserFavorites, removeFavorite } from '../../lib/favorites';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { buildDownloadKey, downloadFile, getDownloadFileName, requestSignedDownloadUrl } from '../../utils/downloadHelpers';
// convertUSDToKRW is not used in this component anymore
import { useTranslation } from 'react-i18next';
import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { getUserDisplayName } from '../../utils/userDisplayName';

import type { VirtualAccountInfo } from '../../lib/payments';

type TabKey = 'profile' | 'purchases' | 'downloads' | 'favorites' | 'cash' | 'inquiries' | 'custom-orders';

type MaybeDateString = string | null | undefined;

interface ProfileInfo {
  id: string;
  email: string | null;
  name: string | null;
  display_name?: string | null;
  phone: string | null;
  credits: number;
  created_at: MaybeDateString;
}

interface CustomerInquiry {
  id: string;
  category: string;
  title: string;
  content: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

interface CategoryInfo {
  name: string | null;
}

interface SheetInfo {
  id: string;
  title: string;
  artist: string;
  price: number;
  thumbnail_url: string | null;
  pdf_url: string | null;
  preview_image_url: string | null;
  categories?: CategoryInfo | null;
}

interface OrderItemDetail {
  id: string;
  sheet_id: string;
  price: number;
  created_at: string;
  drum_sheets: SheetInfo | null;
}

const DOWNLOADABLE_STATUSES = ['completed', 'payment_confirmed', 'paid'];

interface OrderSummary {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_confirmed_at?: string | null;
  transaction_id?: string | null;
  depositor_name?: string | null;
  virtual_account_info?: VirtualAccountInfo | null;
  order_items: OrderItemDetail[];
}

interface DownloadableItem extends OrderItemDetail {
  order_id: string;
  order_status: string;
  order_created_at: string;
}

interface CustomOrderSummary {
  id: string;
  song_title: string;
  artist: string;
  status: string;
  estimated_price: number | null;
  created_at: string;
  updated_at: string;
}

type CashTransactionType = 'charge' | 'use' | 'admin_add' | 'admin_deduct';

interface CashHistoryEntry {
  id: string;
  transaction_type: CashTransactionType;
  amount: number;
  bonus_amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
  sheet?: {
    id: string;
    title: string | null;
  } | null;
  order_id?: string | null;
}

// CASH_TYPE_META는 컴포넌트 내부에서 t()를 사용하여 동적으로 생성

const formatDate = (value: MaybeDateString) => (value ? new Date(value).toLocaleDateString('ko-KR') : '-');
const formatDateTime = (value: MaybeDateString) => (value ? new Date(value).toLocaleString('ko-KR') : '-');

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cartItems, addToCart, isInCart } = useCart();
  const { t, i18n } = useTranslation();

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname);

  const formatCurrency = useCallback(
    (value: number) => {
      const converted = convertFromKrw(value, currency);
      return formatCurrencyUtil(converted, currency);
    },
    [currency],
  );

  // Status maps using t()
  const orderStatusStyles = useMemo(() => ({
    completed: { label: t('mypage.status.order.completed'), className: 'bg-green-100 text-green-800' },
    pending: { label: t('mypage.status.order.pending'), className: 'bg-yellow-100 text-yellow-800' },
    cancelled: { label: t('mypage.status.order.cancelled'), className: 'bg-red-100 text-red-700' },
    refunded: { label: t('mypage.status.order.refunded'), className: 'bg-purple-100 text-purple-700' },
  }), [t]);

  const customOrderStatusMap = useMemo(() => ({
    pending: { label: t('mypage.status.customOrder.pending'), className: 'bg-blue-100 text-blue-800' },
    quoted: { label: t('mypage.status.customOrder.quoted'), className: 'bg-amber-100 text-amber-700' },
    payment_confirmed: { label: t('mypage.status.customOrder.paymentConfirmed'), className: 'bg-emerald-100 text-emerald-700' },
    in_progress: { label: t('mypage.status.customOrder.inProgress'), className: 'bg-indigo-100 text-indigo-700' },
    completed: { label: t('mypage.status.customOrder.completed'), className: 'bg-purple-100 text-purple-700' },
    cancelled: { label: t('mypage.status.customOrder.cancelled'), className: 'bg-red-100 text-red-700' },
  }), [t]);

  const inquiryStatusMap = useMemo(() => ({
    pending: { label: t('mypage.status.inquiry.pending'), className: 'bg-yellow-100 text-yellow-800' },
    answered: { label: t('mypage.status.inquiry.answered'), className: 'bg-emerald-100 text-emerald-700' },
  }), [t]);

  const getInquiryStatusMeta = useCallback((status: string) =>
    (inquiryStatusMap[status as keyof typeof inquiryStatusMap] ?? { label: t('mypage.status.inquiry.processing'), className: 'bg-gray-100 text-gray-600' }),
    [inquiryStatusMap, t]);

  const CASH_TYPE_META = useMemo(() => ({
    charge: {
      label: t('mypage.cash.types.charge'),
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      amountClass: 'text-emerald-600',
    },
    use: {
      label: t('mypage.cash.types.use'),
      badgeClass: 'bg-red-50 text-red-600 border border-red-200',
      amountClass: 'text-red-500',
    },
    admin_add: {
      label: t('mypage.cash.types.adminAdd'),
      badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
      amountClass: 'text-purple-600',
    },
    admin_deduct: {
      label: t('mypage.cash.types.adminDeduct'),
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      amountClass: 'text-amber-600',
    },
  }), [t]);

  const getTabs = useCallback((): { id: TabKey; label: string; icon: string; description?: string }[] => [
    { id: 'profile', label: t('mypage.tabs.profile.label'), icon: 'ri-user-line', description: t('mypage.tabs.profile.description') },
    { id: 'purchases', label: t('mypage.tabs.purchases.label'), icon: 'ri-shopping-bag-line', description: t('mypage.tabs.purchases.description') },
    { id: 'downloads', label: t('mypage.tabs.downloads.label'), icon: 'ri-download-2-line', description: t('mypage.tabs.downloads.description') },
    { id: 'favorites', label: t('mypage.tabs.favorites.label'), icon: 'ri-heart-line', description: t('mypage.tabs.favorites.description') },
    { id: 'cash', label: t('mypage.tabs.cash.label'), icon: 'ri-coin-line', description: t('mypage.tabs.cash.description') },
    { id: 'inquiries', label: t('mypage.tabs.inquiries.label'), icon: 'ri-question-answer-line', description: t('mypage.tabs.inquiries.description') },
    { id: 'custom-orders', label: t('mypage.tabs.customOrders.label'), icon: 'ri-file-text-line', description: t('mypage.tabs.customOrders.description') },
  ], [t]);

  const [user, setUser] = useState<User | null>(null);

  // 캐시 잔액 조회: 통일된 훅 사용 (profiles 테이블의 credits 필드가 기준)
  const { credits: userCashBalance, loading: cashBalanceLoading, error: cashBalanceError, refresh: refreshCashBalance } = useUserCashBalance(user);
  const [loading, setLoading] = useState(true);

  // URL 쿼리 파라미터에서 탭 정보 읽기
  const getInitialTab = useCallback((): TabKey => {
    const tabParam = searchParams.get('tab') || searchParams.get('section');
    if (
      tabParam &&
      ['profile', 'purchases', 'downloads', 'favorites', 'cash', 'inquiries', 'custom-orders'].includes(tabParam)
    ) {
      return tabParam as TabKey;
    }
    // section 파라미터 매핑 (기존 호환성 유지)
    const sectionParam = searchParams.get('section');
    if (sectionParam === 'cash-history') return 'cash';
    if (sectionParam === 'profile') return 'profile';
    if (sectionParam === 'inquiries') return 'inquiries';
    return 'profile';
  }, [searchParams]);

  const initialTab = useMemo(() => getInitialTab(), [getInitialTab]);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // 캐시충전 모달 상태
  const [showCashChargeModal, setShowCashChargeModal] = useState(false);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [downloads, setDownloads] = useState<DownloadableItem[]>([]);
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<string[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Record<string, string[]>>({});
  const [downloadingKeys, setDownloadingKeys] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSheet[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrderSummary[]>([]);
  const [cashHistory, setCashHistory] = useState<CashHistoryEntry[]>([]);
  const [cashHistoryLoading, setCashHistoryLoading] = useState(false);
  const [userInquiries, setUserInquiries] = useState<CustomerInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: '',
  });

  const [searchQuery, setSearchQuery] = useState('');

  const loadCashTransactions = useCallback(async (currentUser: User) => {
    setCashHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select(
          `
            id,
            transaction_type,
            amount,
            bonus_amount,
            balance_after,
            description,
            created_at,
            sheet:drum_sheets (id, title),
            related_order:orders (id)
          `,
        )
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      const normalized = (data ?? []).map((entry: any) => ({
        id: entry.id as string,
        transaction_type: entry.transaction_type as CashTransactionType,
        amount: entry.amount ?? 0,
        bonus_amount: entry.bonus_amount ?? 0,
        balance_after: entry.balance_after ?? 0,
        description: entry.description ?? null,
        created_at: entry.created_at as string,
        sheet: entry.sheet ?? null,
        order_id: entry.related_order?.id ?? null,
      }));

      setCashHistory(normalized);
    } catch (error) {
      console.error(t('mypage.console.cashHistoryError'), error);
      setCashHistory([]);
    } finally {
      setCashHistoryLoading(false);
    }
  }, []);

  const loadUserInquiries = useCallback(async (currentUser: User) => {
    setInquiriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_inquiries')
        .select('id, category, title, content, status, admin_reply, replied_at, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const normalized = (data ?? []).map((item: any) => ({
        id: item.id as string,
        category: item.category ?? '',
        title: item.title ?? '',
        content: item.content ?? '',
        status: item.status ?? 'pending',
        admin_reply: item.admin_reply ?? null,
        replied_at: item.replied_at ?? null,
        created_at: item.created_at as string,
      }));

      setUserInquiries(normalized);
    } catch (error) {
      console.error(t('mypage.console.inquiryHistoryError'), error);
      setUserInquiries([]);
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedDownloadIds((prev) =>
      prev.filter((key) => downloads.some((item) => buildDownloadKey(item.order_id, item.id) === key))
    );
  }, [downloads]);

  useEffect(() => {
    if (!user) {
      setInquiryForm({
        name: '',
        email: '',
        category: '',
        subject: '',
        message: '',
      });
      return;
    }

    setInquiryForm((prev) => ({
      ...prev,
      name: prev.name || (user.user_metadata?.name as string) || '',
      email: prev.email || user.email || '',
    }));
  }, [user]);

  useEffect(() => {
    setSelectedPurchaseIds((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }

      const orderMap = new Map<string, Set<string>>();
      orders.forEach((order) => {
        orderMap.set(
          order.id,
          new Set(order.order_items.map((item) => item.id))
        );
      });

      const next: Record<string, string[]> = {};
      let changed = false;

      Object.entries(prev).forEach(([orderId, itemIds]) => {
        const validIds = orderMap.get(orderId);
        if (!validIds) {
          changed = true;
          return;
        }

        const filtered = itemIds.filter((itemId) => validIds.has(itemId));

        if (filtered.length !== itemIds.length) {
          changed = true;
        }

        if (filtered.length > 0) {
          next[orderId] = filtered;
        } else if (itemIds.length > 0) {
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return next;
    });
  }, [orders]);

  const loadProfile = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, display_name, phone, created_at')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const profileData: ProfileInfo = {
        id: currentUser.id,
        email: data?.email ?? currentUser.email ?? null,
        name: data?.name ?? (currentUser.user_metadata?.name as string | null) ?? null,
        display_name: data?.display_name ?? null,
        phone: data?.phone ?? (currentUser.user_metadata?.phone as string | null) ?? null,
        credits: 0, // credits는 useUserCashBalance 훅에서 관리 (통일된 소스)
        created_at: data?.created_at ?? currentUser.created_at,
      };

      setProfile(profileData);
      setProfileForm({
        name: profileData.name ?? '',
        phone: profileData.phone ?? '',
      });
    } catch (error) {
      console.error(t('mypage.console.profileLoadError'), error);
      const fallbackProfile: ProfileInfo = {
        id: currentUser.id,
        email: currentUser.email ?? null,
        name: (currentUser.user_metadata?.name as string | null) ?? null,
        phone: (currentUser.user_metadata?.phone as string | null) ?? null,
        credits: 0,
        created_at: currentUser.created_at,
      };
      setProfile(fallbackProfile);
      setProfileForm({
        name: fallbackProfile.name ?? '',
        phone: fallbackProfile.phone ?? '',
      });
    }
  }, []);

  // 일반 유저용: 본인 주문만 조회 (필터 필수)
  // RLS 정책과 함께 이중으로 보안 적용
  const loadOrders = useCallback(async (currentUser: User) => {
    try {
      // order_items 테이블의 실제 컬럼명을 확인하기 위해 먼저 간단한 쿼리 시도
      // sheet_id가 없을 수 있으므로 오류 처리 추가
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          total_amount,
          payment_method,
          payment_status,
          payment_confirmed_at,
          transaction_id,
          depositor_name,
          virtual_account_info,
          order_items (
            id,
            drum_sheet_id,
            price,
            created_at,
            drum_sheets (
              id,
              title,
              artist,
              price,
              thumbnail_url,
              pdf_url,
              preview_image_url,
              categories (
                name
              )
            )
          )
        `)
        .eq('user_id', currentUser.id)  // 일반 유저는 본인 주문만 필터링
        .order('created_at', { ascending: false });

      if (error) {
        // 컬럼명 오류인 경우 빈 배열로 설정하고 계속 진행
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          console.warn('order_items 테이블 스키마 오류 - 구매 내역을 불러올 수 없습니다:', error.message);
          setOrders([]);
          setDownloads([]);
          return;
        }
        throw error;
      }

      const normalizedOrders: OrderSummary[] = (data ?? []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        payment_status: order.payment_status ?? null,
        payment_confirmed_at: order.payment_confirmed_at ?? null,
        transaction_id: order.transaction_id ?? null,
        depositor_name: order.depositor_name ?? null,
        virtual_account_info: (order.virtual_account_info ?? null) as VirtualAccountInfo | null,
        order_items: (order.order_items ?? []).map((item: any) => {
          const sheetId = item.drum_sheet_id || item.drum_sheets?.id || '';
          return {
            id: item.id,
            sheet_id: sheetId || '',
            price: item.price,
            created_at: item.created_at,
            drum_sheets: item.drum_sheets
              ? {
                id: item.drum_sheets.id,
                title: item.drum_sheets.title,
                artist: item.drum_sheets.artist,
                price: item.drum_sheets.price,
                thumbnail_url: item.drum_sheets.thumbnail_url,
                pdf_url: item.drum_sheets.pdf_url,
                preview_image_url: item.drum_sheets.preview_image_url,
                categories: item.drum_sheets.categories,
              }
              : null,
          };
        }),
      }));

      const filteredOrders = normalizedOrders.filter((order) => (order.order_items?.length ?? 0) > 0);

      setOrders(filteredOrders);
      const downloadItems: DownloadableItem[] = filteredOrders.flatMap((order) =>
        DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())
          ? order.order_items
            .filter((item) => item.sheet_id)
            .map((item) => ({
              ...item,
              order_id: order.id,
              order_status: order.status,
              order_created_at: order.created_at,
            }))
          : [],
      );
      setDownloads(downloadItems);
      setSelectedDownloadIds((prev) => {
        const validKeys = new Set(
          downloadItems.map((item) => buildDownloadKey(item.order_id, item.id)),
        );
        return prev.filter((key) => validKeys.has(key));
      });
    } catch (error) {
      console.error(t('mypage.console.orderHistoryError'), error);
      // 오류가 발생해도 빈 배열로 설정하여 다른 데이터 로드는 계속 진행
      setOrders([]);
      setDownloads([]);
    }
  }, []);

  const loadFavoritesList = useCallback(async (currentUser: User) => {
    try {
      const data = await fetchUserFavorites(currentUser.id);
      setFavorites(data);
    } catch (error) {
      console.error(t('mypage.console.favoritesLoadError'), error);
      setFavorites([]);
    }
  }, []);

  const loadCustomOrders = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('custom_orders')
        .select('id, song_title, artist, status, estimated_price, created_at, updated_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCustomOrders((data ?? []) as CustomOrderSummary[]);
    } catch (error) {
      console.error(t('mypage.console.customOrderHistoryError'), error);
      setCustomOrders([]);
    }
  }, []);

  const loadAll = useCallback(
    async (currentUser: User) => {
      setLoading(true);
      try {
        // Promise.allSettled를 사용하여 하나의 요청이 실패해도 다른 요청은 계속 진행
        await Promise.allSettled([
          loadProfile(currentUser),
          loadOrders(currentUser),
          loadFavoritesList(currentUser),
          loadCustomOrders(currentUser),
          loadCashTransactions(currentUser),
          loadUserInquiries(currentUser),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loadProfile, loadOrders, loadFavoritesList, loadCustomOrders, loadCashTransactions, loadUserInquiries]
  );

  // URL 쿼리 파라미터 변경 시 탭 업데이트
  useEffect(() => {
    const tab = getInitialTab();
    setActiveTab(tab);
  }, [getInitialTab]);

  useEffect(() => {
    let isMounted = true;

    const initialise = async () => {
      setLoading(true);
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        setUser(currentUser ?? null);
        if (currentUser) {
          await loadAll(currentUser);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error(t('mypage.console.initError'), error);
        setLoading(false);
      }
    };

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        if (event === 'USER_UPDATED') {
          setLoading(true);
          try {
            await Promise.allSettled([loadProfile(nextUser)]);
          } finally {
            setLoading(false);
          }
          return;
        }

        await loadAll(nextUser);
      } else {
        setProfile(null);
        setProfileForm({ name: '', phone: '' });
        setOrders([]);
        setDownloads([]);
        setFavorites([]);
        setCustomOrders([]);
        setCashHistory([]);
        setUserInquiries([]);
        setInquiryForm({
          name: '',
          email: '',
          category: '',
          subject: '',
          message: '',
        });
        setInquiriesLoading(false);
        setInquirySubmitting(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadAll, loadProfile]);

  const totalPurchasedSheets = useMemo(
    () => orders.reduce((count, order) => count + order.order_items.length, 0),
    [orders]
  );

  const stats = useMemo(
    () => [
      { label: t('mypage.stats.purchasedSheets'), value: totalPurchasedSheets },
      { label: t('mypage.stats.availableDownloads'), value: downloads.length },
      { label: t('mypage.stats.favoriteSheets'), value: favorites.length },
      { label: t('mypage.stats.inquiries'), value: userInquiries.length },
      { label: t('mypage.stats.customOrders'), value: customOrders.length },
    ],
    [totalPurchasedSheets, downloads.length, favorites.length, userInquiries.length, customOrders.length, t]
  );

  const handleCashCharge = () => {
    setShowCashChargeModal(true);
  };

  const handleCloseCashChargeModal = () => {
    setShowCashChargeModal(false);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/categories?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleInquiryInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setInquiryForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInquirySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      alert(t('mypage.errors.loginRequired'));
      return;
    }

    if (
      !inquiryForm.name.trim() ||
      !inquiryForm.email.trim() ||
      !inquiryForm.category ||
      !inquiryForm.subject.trim() ||
      !inquiryForm.message.trim()
    ) {
      alert(t('mypage.errors.allFieldsRequired'));
      return;
    }

    try {
      setInquirySubmitting(true);
      const trimmedName = inquiryForm.name.trim();
      const trimmedEmail = inquiryForm.email.trim();
      const trimmedSubject = inquiryForm.subject.trim();
      const trimmedMessage = inquiryForm.message.trim();

      const { error } = await supabase
        .from('customer_inquiries')
        .insert({
          user_id: user.id,
          name: trimmedName,
          email: trimmedEmail,
          category: inquiryForm.category,
          title: trimmedSubject,
          content: trimmedMessage,
          status: 'pending',
        });

      if (error) {
        throw error;
      }

      alert(t('mypage.errors.inquirySubmitted'));
      setInquiryForm((prev) => ({
        ...prev,
        category: '',
        subject: '',
        message: '',
      }));
      await loadUserInquiries(user);
    } catch (error) {
      console.error(t('mypage.console.inquirySubmitError'), error);
      alert(t('mypage.errors.inquiryError'));
    } finally {
      setInquirySubmitting(false);
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      alert(t('mypage.errors.loginRequired'));
      return;
    }

    setProfileSaving(true);
    try {
      const updates = {
        name: profileForm.name.trim() || null,
        phone: profileForm.phone.trim() || null,
      };

      const { error: authError } = await supabase.auth.updateUser({
        data: updates,
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        name: updates.name,
        phone: updates.phone,
        credits: userCashBalance, // 통일된 캐시 잔액 사용
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      setProfile((prev) =>
        prev
          ? { ...prev, name: updates.name, phone: updates.phone }
          : {
            id: user.id,
            email: user.email ?? null,
            name: updates.name,
            phone: updates.phone,
            credits: userCashBalance, // 통일된 캐시 잔액 사용
            created_at: user.created_at,
          }
      );

      alert(t('mypage.errors.profileUpdated'));
    } catch (error) {
      console.error(t('mypage.console.profileUpdateError'), error);
      alert(t('mypage.errors.profileUpdateError'));
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleDownloadSelection = (item: DownloadableItem) => {
    if (!DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase())) {
      return;
    }

    const key = buildDownloadKey(item.order_id, item.id);
    setSelectedDownloadIds((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]
    );
  };

  const renderInquiryStatusBadge = (status: string) => {
    const meta = getInquiryStatusMeta(status);
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  };

  const handleToggleSelectAllDownloads = () => {
    setSelectedDownloadIds((prev) => {
      if (downloads.length === 0) {
        return [];
      }
      return prev.length === downloads.length
        ? []
        : downloads.map((item) => buildDownloadKey(item.order_id, item.id));
    });
  };

  const clearDownloadSelection = () => {
    setSelectedDownloadIds([]);
  };

  const togglePurchaseSelection = (orderId: string, itemId: string) => {
    setSelectedPurchaseIds((prev) => {
      const current = prev[orderId] ?? [];
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];

      if (next.length === 0) {
        const { [orderId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [orderId]: next };
    });
  };

  const clearPurchaseSelection = (orderId: string) => {
    setSelectedPurchaseIds((prev) => {
      if (!(orderId in prev)) {
        return prev;
      }

      const { [orderId]: _, ...rest } = prev;
      return rest;
    });
  };

  const toggleSelectAllInOrder = (orderId: string, orderItems: OrderItemDetail[]) => {
    setSelectedPurchaseIds((prev) => {
      const selectableIds = orderItems.filter((item) => item.sheet_id).map((item) => item.id);
      if (selectableIds.length === 0) {
        return prev;
      }

      const current = prev[orderId] ?? [];
      const isAllSelected = selectableIds.every((id) => current.includes(id));

      if (isAllSelected) {
        const { [orderId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [orderId]: selectableIds };
    });
  };

  const handleDownloadSelectedInOrder = async (order: OrderSummary) => {
    if (!DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())) {
      alert(t('mypage.errors.downloadRestricted'));
      return;
    }

    const selectedIds = selectedPurchaseIds[order.id] ?? [];
    if (selectedIds.length === 0) {
      alert(t('mypage.errors.selectDownloadItems'));
      return;
    }

    const selectedItems = order.order_items
      .filter((item) => item.sheet_id && selectedIds.includes(item.id))
      .map<DownloadableItem>((item) => ({
        ...item,
        order_id: order.id,
        order_status: order.status,
        order_created_at: order.created_at,
      }));

    await handleDownloadMultiple(selectedItems);
  };

  const handleDownloadAllInOrder = async (order: OrderSummary) => {
    if (!DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())) {
      alert(t('mypage.errors.downloadRestricted'));
      return;
    }

    const items = order.order_items
      .filter((item) => item.sheet_id)
      .map<DownloadableItem>((item) => ({
        ...item,
        order_id: order.id,
        order_status: order.status,
        order_created_at: order.created_at,
      }));

    if (items.length === 0) {
      alert(t('mypage.errors.noDownloadableItems'));
      return;
    }

    await handleDownloadMultiple(items);
  };

  const startDownloading = (key: string) => {
    setDownloadingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const finishDownloading = (key: string) => {
    setDownloadingKeys((prev) => prev.filter((value) => value !== key));
  };

  const downloadSheetItem = async (item: DownloadableItem, accessToken: string) => {
    if (!item.sheet_id) {
      throw new Error(t('mypage.errors.sheetInfoNotFound'));
    }

    if (!item.drum_sheets) {
      throw new Error(t('mypage.errors.downloadLinkNotFound'));
    }

    const fileName = getDownloadFileName({
      title: item.drum_sheets?.title,
      artist: item.drum_sheets?.artist,
      orderId: item.order_id,
    });

    const signedUrl = await requestSignedDownloadUrl({
      orderId: item.order_id,
      orderItemId: item.id,
      accessToken,
    });

    await downloadFile(signedUrl, fileName);
  };

  const handleDownloadMultiple = async (items: DownloadableItem[]) => {
    if (items.length === 0) {
      alert(t('mypage.errors.selectDownloadItems'));
      return;
    }

    const invalidItems = items.filter(
      (item) => !DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase()),
    );
    if (invalidItems.length > 0) {
      alert(t('mypage.errors.downloadRestrictedMultiple'));
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert(t('mypage.errors.loginRequiredForDownload'));
      return;
    }

    setBulkDownloading(true);
    const failed: DownloadableItem[] = [];

    try {
      for (const item of items) {
        const key = buildDownloadKey(item.order_id, item.id);
        startDownloading(key);
        try {
          await downloadSheetItem(item, session.access_token);
        } catch (error) {
          failed.push(item);
        } finally {
          finishDownloading(key);
        }
      }
    } finally {
      setBulkDownloading(false);
    }

    if (failed.length > 0) {
      alert(t('mypage.errors.downloadFailed', { count: failed.length }));
    }
  };

  const handleDownloadSelected = async () => {
    const selectedItems = downloads.filter(
      (item) =>
        selectedDownloadIds.includes(buildDownloadKey(item.order_id, item.id)) &&
        DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase()),
    );
    await handleDownloadMultiple(selectedItems);
  };

  const handleDownloadAll = async () => {
    const downloadableItems = downloads.filter((item) =>
      DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase()),
    );
    await handleDownloadMultiple(downloadableItems);
  };

  const handleDownload = async (item: DownloadableItem) => {
    if (!DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase())) {
      alert(t('mypage.errors.downloadRestrictedMultiple'));
      return;
    }

    const key = buildDownloadKey(item.order_id, item.id);
    startDownloading(key);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t('mypage.errors.loginRequiredForDownload'));
      }

      await downloadSheetItem(item, session.access_token);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert(t('mypage.errors.downloadFailedSingle'));
      }
    } finally {
      finishDownloading(key);
    }
  };

  const handlePreview = (item: DownloadableItem) => {
    const previewUrl = item.drum_sheets?.preview_image_url;
    if (!previewUrl) {
      alert(t('mypage.errors.previewNotFound'));
      return;
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFavoriteRemove = async (sheetId: string) => {
    if (!user) return;
    try {
      await removeFavorite(sheetId, user.id);
      await loadFavoritesList(user);
    } catch (error) {
      console.error(t('mypage.console.favoriteRemoveError'), error);
      alert(t('mypage.errors.favoriteRemoveFailed'));
    }
  };

  const handleAddToCart = async (sheetId: string) => {
    await addToCart(sheetId);
  };

  const handleGoToSheet = (sheetId: string) => {
    navigate(`/sheet-detail/${sheetId}`);
  };

  const renderOrderStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase();
    const badge = orderStatusStyles[normalized as keyof typeof orderStatusStyles];
    if (!badge) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status || t('mypage.status.order.undetermined')}</span>;
    }
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const renderCustomOrderStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase();
    const badge = customOrderStatusMap[normalized as keyof typeof customOrderStatusMap];
    if (!badge) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status || t('mypage.status.customOrder.undetermined')}</span>;
    }
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const renderLoader = () => (
    <div className="py-24 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full border-b-2 border-blue-600 animate-spin mb-4" />
      <p className="text-gray-600 font-medium">{t('mypage.loading.message')}</p>
    </div>
  );

  const renderGuestState = () => (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
      <i className="ri-user-line text-5xl text-gray-400" />
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('mypage.guest.title')}</h2>
        <p className="text-gray-600">{t('mypage.guest.description')}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          {t('mypage.guest.login')}
        </button>
        <button
          onClick={() => navigate('/auth/signup')}
          className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
        >
          {t('mypage.guest.signup')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <div className="hidden md:block">
        <MainHeader user={user} />
      </div>

      <div className="hidden lg:block">
        <UserSidebar user={user} />
      </div>

      <div className={`${user ? 'lg:pr-64' : ''} pt-[76px] md:pt-0`}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          {loading ? (
            renderLoader()
          ) : !user ? (
            renderGuestState()
          ) : (
            <div className="space-y-10">
              <header>
                <h2 className="text-3xl font-extrabold text-gray-900">{t('mypage.title')}</h2>
                <p className="mt-2 text-gray-600">
                  {t('mypage.subtitle')}
                </p>
              </header>

              <section className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                      {getUserDisplayName(profile as Profile | null, profile?.email || null).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('mypage.profile.memberInfo')}</p>
                      <h3 className="text-xl font-bold text-gray-900">{getUserDisplayName(profile as Profile | null, profile?.email || null)}</h3>
                      <p className="text-sm text-gray-600">{profile?.email}</p>
                      <p className="mt-2 text-xs text-gray-400">{t('mypage.profile.joinedOn')} {formatDate(profile?.created_at)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 shadow-sm p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-red-500">{t('mypage.profile.cashBalance')}</p>
                      {cashBalanceLoading ? (
                        <p className="mt-2 text-3xl font-black text-gray-400 animate-pulse">로딩 중...</p>
                      ) : cashBalanceError ? (
                        <p className="mt-2 text-lg font-bold text-red-600">
                          오류: {cashBalanceError.message}
                        </p>
                      ) : (
                        <p className="mt-2 text-3xl font-black text-gray-900">
                          {userCashBalance.toLocaleString('en-US')} P
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">{t('mypage.profile.cashBalanceDescription')}</p>
                    </div>
                    <button
                      onClick={handleCashCharge}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold shadow-lg hover:bg-red-600 transition"
                    >
                      {t('mypage.profile.chargeCash')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map((item) => (
                    <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <p className="text-sm text-gray-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-extrabold text-gray-900">{item.value.toLocaleString('ko-KR')}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1 space-y-4">
                  {getTabs().map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${activeTab === tab.id
                        ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:text-blue-600'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`${tab.icon} text-lg`} />
                        <span className="font-semibold">{tab.label}</span>
                      </div>
                      {tab.description ? <p className="text-xs text-gray-500">{tab.description}</p> : null}
                    </button>
                  ))}
                </aside>

                <section className="lg:col-span-3">
                  {activeTab === 'profile' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-6">{t('mypage.profile.title')}</h3>
                      <form onSubmit={handleProfileSubmit} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('mypage.profile.email')}</label>
                            <input
                              type="email"
                              value={profile?.email ?? ''}
                              disabled
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('mypage.profile.name')}</label>
                            <input
                              type="text"
                              value={profileForm.name}
                              onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                              placeholder={t('mypage.profile.namePlaceholder')}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('mypage.profile.phoneNumber')}</label>
                            <input
                              type="tel"
                              value={profileForm.phone}
                              onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                              placeholder={t('mypage.profile.phonePlaceholder')}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('mypage.profile.joinDate')}</label>
                            <input
                              type="text"
                              value={formatDate(profile?.created_at)}
                              disabled
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={profileSaving}
                            className={`px-6 py-3 rounded-lg font-semibold text-white transition ${profileSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                          >
                            {profileSaving ? t('mypage.profile.saving') : t('mypage.profile.updateProfile')}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {activeTab === 'purchases' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.purchases.title')}</h3>
                          <p className="text-sm text-gray-500">{t('mypage.purchases.description')}</p>
                        </div>
                        <Link
                          to="/categories"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50"
                        >
                          <i className="ri-add-line text-lg" /> {t('mypage.purchases.browseMore')}
                        </Link>
                      </div>

                      {orders.length === 0 ? (
                        <div className="py-16 text-center text-gray-500">
                          <i className="ri-shopping-bag-line text-4xl text-gray-300 mb-4" />
                          <p className="font-medium">{t('mypage.purchases.noPurchases')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {orders.map((order) => {
                            const selectableOrderItems = order.order_items.filter((item) => item.sheet_id);
                            const orderSelectedIds = selectedPurchaseIds[order.id] ?? [];
                            const selectedCount = orderSelectedIds.length;
                            const allSelectableSelected =
                              selectableOrderItems.length > 0 && selectedCount === selectableOrderItems.length;
                            const hasSelectableItems = selectableOrderItems.length > 0;

                            return (
                              <div key={order.id} className="border border-gray-100 rounded-xl p-4 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm text-gray-500">{t('mypage.purchases.orderNumber')}</p>
                                    <h4 className="text-lg font-semibold text-gray-900">
                                      #{order.id.slice(0, 8).toUpperCase()}
                                    </h4>
                                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.created_at)}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    {renderOrderStatusBadge(order.status)}
                                    <p className="text-base font-semibold text-gray-900">
                                      {t('mypage.purchases.total')}{' '}
                                      {order.payment_method === 'cash'
                                        ? `${order.total_amount.toLocaleString('en-US')} P`
                                        : formatCurrency(order.total_amount)}
                                    </p>
                                    {hasSelectableItems ? (
                                      <button
                                        onClick={() => handleDownloadAllInOrder(order)}
                                        disabled={bulkDownloading}
                                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${bulkDownloading
                                          ? 'border-blue-200 bg-blue-100 text-blue-300 cursor-not-allowed'
                                          : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                                          }`}
                                      >
                                        <i className="ri-stack-line text-base" />
                                        {bulkDownloading ? t('mypage.purchases.downloading') : t('mypage.purchases.downloadAllInOrder')}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                {hasSelectableItems ? (
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={() => toggleSelectAllInOrder(order.id, order.order_items)}
                                        disabled={bulkDownloading}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${bulkDownloading
                                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'border-gray-300 text-gray-700 hover:bg-white'
                                          }`}
                                      >
                                        <i className="ri-checkbox-multiple-line text-base" />
                                        {allSelectableSelected ? t('mypage.purchases.deselectAll') : t('mypage.purchases.selectAll')}
                                      </button>
                                      <button
                                        onClick={() => clearPurchaseSelection(order.id)}
                                        disabled={bulkDownloading || selectedCount === 0}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${bulkDownloading || selectedCount === 0
                                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'border-gray-300 text-gray-700 hover:bg-white'
                                          }`}
                                      >
                                        <i className="ri-close-circle-line text-base" />
                                        {t('mypage.purchases.deselectAll')}
                                      </button>
                                      <span className="text-xs text-gray-500">
                                        {t('mypage.purchases.selected')} {selectedCount.toLocaleString('ko-KR')}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={() => handleDownloadSelectedInOrder(order)}
                                        disabled={bulkDownloading || selectedCount === 0}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${bulkDownloading || selectedCount === 0
                                          ? 'bg-blue-300 cursor-not-allowed'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                          }`}
                                      >
                                        <i className="ri-download-2-line text-base" />
                                        {bulkDownloading ? t('mypage.purchases.downloading') : t('mypage.purchases.downloadSelected')}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="space-y-3">
                                  {order.order_items.map((item) => {
                                    const downloadItem: DownloadableItem = {
                                      ...item,
                                      order_id: order.id,
                                      order_status: order.status,
                                      order_created_at: order.created_at,
                                    };
                                    const downloadKey = buildDownloadKey(downloadItem.order_id, downloadItem.id);
                                    const isDownloading = bulkDownloading || downloadingKeys.includes(downloadKey);
                                    const isSelectable = Boolean(item.sheet_id);
                                    const isSelected = isSelectable && orderSelectedIds.includes(item.id);

                                    return (
                                      <div
                                        key={item.id}
                                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${isSelected
                                          ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                                          : 'border-gray-100 bg-gray-50'
                                          }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={isSelectable ? isSelected : false}
                                            onChange={() => togglePurchaseSelection(order.id, item.id)}
                                            disabled={!isSelectable || bulkDownloading}
                                          />
                                          <img
                                            src={
                                              item.drum_sheets?.thumbnail_url ||
                                              generateDefaultThumbnail(80, 80)
                                            }
                                            alt={item.drum_sheets?.title ?? '악보 썸네일'}
                                            className="w-16 h-16 rounded-lg object-cover"
                                            onError={(event) => {
                                              (event.target as HTMLImageElement).src = generateDefaultThumbnail(80, 80);
                                            }}
                                          />
                                          <div>
                                            <p className="text-sm text-gray-500">
                                              {item.drum_sheets?.categories?.name ?? t('mypage.purchases.categoryNotSet')}
                                            </p>
                                            <h5 className="font-semibold text-gray-900">
                                              {item.drum_sheets?.title ?? t('mypage.purchases.deletedSheet')}
                                            </h5>
                                            <p className="text-sm text-gray-500">{item.drum_sheets?.artist ?? '-'}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-sm font-semibold text-gray-900">
                                            {order.payment_method === 'cash'
                                              ? `${(item.price ?? 0).toLocaleString('en-US')} P`
                                              : formatCurrency(item.price ?? 0)}
                                          </span>
                                          <button
                                            onClick={() => handleDownload(downloadItem)}
                                            disabled={isDownloading}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold text-white transition ${isDownloading
                                              ? 'bg-blue-300 cursor-not-allowed'
                                              : 'bg-blue-600 hover:bg-blue-700'
                                              }`}
                                          >
                                            {isDownloading ? t('mypage.purchases.downloading') : t('mypage.purchases.download')}
                                          </button>
                                          <button
                                            onClick={() => handleGoToSheet(item.sheet_id)}
                                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                          >
                                            {t('mypage.purchases.viewDetails')}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'downloads' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.downloads.title')}</h3>
                          <p className="text-sm text-gray-500">{t('mypage.downloads.description')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{t('mypage.downloads.totalItems', { count: downloads.length })}</p>
                          {selectedDownloadIds.length > 0 ? (
                            <p className="mt-1 text-xs text-blue-600">{t('mypage.downloads.selectedItems', { count: selectedDownloadIds.length })}</p>
                          ) : null}
                        </div>
                      </div>

                      {downloads.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={handleToggleSelectAllDownloads}
                              disabled={downloads.length === 0 || bulkDownloading}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${downloads.length === 0 || bulkDownloading
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              <i className="ri-checkbox-multiple-line text-base" />
                              {downloads.length > 0 && selectedDownloadIds.length === downloads.length ? t('mypage.downloads.deselectAll') : t('mypage.downloads.selectAll')}
                            </button>
                            <button
                              onClick={clearDownloadSelection}
                              disabled={selectedDownloadIds.length === 0 || bulkDownloading}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${selectedDownloadIds.length === 0 || bulkDownloading
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              <i className="ri-close-circle-line text-base" />
                              {t('mypage.downloads.deselectAll')}
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={handleDownloadSelected}
                              disabled={selectedDownloadIds.length === 0 || bulkDownloading}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${selectedDownloadIds.length === 0 || bulkDownloading
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                              <i className="ri-download-2-line text-base" />
                              {bulkDownloading ? t('mypage.downloads.downloading') : t('mypage.downloads.downloadSelected')}
                            </button>
                            <button
                              onClick={handleDownloadAll}
                              disabled={downloads.length === 0 || bulkDownloading}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${downloads.length === 0 || bulkDownloading
                                ? 'bg-indigo-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                              <i className="ri-stack-line text-base" />
                              {bulkDownloading ? t('mypage.downloads.downloading') : t('mypage.downloads.downloadAll')}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {downloads.length === 0 ? (
                        <div className="py-16 text-center text-gray-500">
                          <i className="ri-download-2-line text-4xl text-gray-300 mb-4" />
                          <p className="font-medium">{t('mypage.downloads.noDownloads')}</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {downloads.map((item) => {
                            const itemKey = buildDownloadKey(item.order_id, item.id);
                            const isSelected = selectedDownloadIds.includes(itemKey);
                            const isDownloading = bulkDownloading || downloadingKeys.includes(itemKey);
                            const isDownloadableStatus = DOWNLOADABLE_STATUSES.includes(
                              (item.order_status ?? '').toLowerCase(),
                            );

                            return (
                              <div
                                key={itemKey}
                                className={`rounded-xl border p-4 space-y-3 transition ${isSelected
                                  ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                                  : 'border-gray-100 bg-white hover:border-blue-200'
                                  }`}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleDownloadSelection(item)}
                                    disabled={bulkDownloading || !isDownloadableStatus}
                                    className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex flex-1 items-center gap-3">
                                    <img
                                      src={
                                        item.drum_sheets?.thumbnail_url ||
                                        generateDefaultThumbnail(96, 96)
                                      }
                                      alt={item.drum_sheets?.title ?? t('mypage.downloads.noDownloads')}
                                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                      onError={(event) => {
                                        (event.target as HTMLImageElement).src = generateDefaultThumbnail(96, 96);
                                      }}
                                    />
                                    <div>
                                      <h4 className="font-semibold text-gray-900">
                                        {item.drum_sheets?.title ?? t('mypage.favorites.deletedSheet')}
                                      </h4>
                                      <p className="text-sm text-gray-500">{item.drum_sheets?.artist ?? '-'}</p>
                                      <p className="text-xs text-gray-400">{t('mypage.downloads.purchaseDate')} {formatDate(item.order_created_at)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => handleDownload(item)}
                                    disabled={isDownloading || !isDownloadableStatus}
                                    className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold text-white transition ${isDownloading || !isDownloadableStatus
                                      ? 'bg-blue-300 cursor-not-allowed'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                      }`}
                                  >
                                    {isDownloading
                                      ? t('mypage.downloads.downloading')
                                      : isDownloadableStatus
                                        ? t('mypage.downloads.download')
                                        : t('mypage.downloads.downloadUnavailable')}
                                  </button>
                                  <button
                                    onClick={() => handlePreview(item)}
                                    disabled={bulkDownloading}
                                    className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold transition ${bulkDownloading
                                      ? 'border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                      }`}
                                  >
                                    {t('mypage.downloads.preview')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'favorites' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.favorites.title')}</h3>
                          <p className="text-sm text-gray-500">{t('mypage.favorites.description')}</p>
                        </div>
                        <p className="text-sm text-gray-500">{t('mypage.favorites.totalCount', { count: favorites.length })}</p>
                      </div>

                      {favorites.length === 0 ? (
                        <div className="py-16 text-center text-gray-500">
                          <i className="ri-heart-line text-4xl text-gray-300 mb-4" />
                          <p className="font-medium">{t('mypage.favorites.noFavorites')}</p>
                          <p className="text-sm">{t('mypage.favorites.addFavorites')}</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {favorites.map((favorite) => (
                            <div key={favorite.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={
                                    favorite.sheet?.thumbnail_url ||
                                    generateDefaultThumbnail(96, 96)
                                  }
                                  alt={favorite.sheet?.title ?? '악보 썸네일'}
                                  className="w-20 h-20 rounded-lg object-cover"
                                  onError={(event) => {
                                    (event.target as HTMLImageElement).src = generateDefaultThumbnail(96, 96);
                                  }}
                                />
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate">
                                    {favorite.sheet?.title ?? t('mypage.favorites.deletedSheet')}
                                  </h4>
                                  <p className="text-sm text-gray-500 truncate">{favorite.sheet?.artist ?? '-'}</p>
                                  <p className="text-base font-bold text-blue-600 mt-1">
                                    {favorite.sheet ? formatCurrency(favorite.sheet.price) : '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => handleGoToSheet(favorite.sheet_id)}
                                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                                >
                                  {t('mypage.favorites.viewDetails')}
                                </button>
                                <button
                                  onClick={() => handleAddToCart(favorite.sheet_id)}
                                  className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold border ${isInCart(favorite.sheet_id)
                                    ? 'border-green-200 bg-green-50 text-green-600 cursor-not-allowed'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                  disabled={isInCart(favorite.sheet_id)}
                                >
                                  {isInCart(favorite.sheet_id) ? t('mypage.favorites.inCart') : t('mypage.favorites.cart')}
                                </button>
                                <button
                                  onClick={() => handleFavoriteRemove(favorite.sheet_id)}
                                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
                                >
                                  {t('mypage.favorites.removeFavorite')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'inquiries' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.inquiries.title')}</h3>
                          <p className="text-sm text-gray-500">
                            {t('mypage.inquiries.description')}
                          </p>
                        </div>

                        <form className="space-y-5" onSubmit={handleInquirySubmit}>
                          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                              <label htmlFor="inquiry-name" className="block text-sm font-medium text-gray-700 mb-2">
                                {t('mypage.inquiries.name')} *
                              </label>
                              <input
                                id="inquiry-name"
                                name="name"
                                type="text"
                                value={inquiryForm.name}
                                onChange={handleInquiryInputChange}
                                required
                                disabled={inquirySubmitting}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                placeholder={t('mypage.inquiries.namePlaceholder')}
                              />
                            </div>
                            <div>
                              <label htmlFor="inquiry-email" className="block text-sm font-medium text-gray-700 mb-2">
                                {t('mypage.inquiries.email')} *
                              </label>
                              <input
                                id="inquiry-email"
                                name="email"
                                type="email"
                                value={inquiryForm.email}
                                onChange={handleInquiryInputChange}
                                required
                                disabled={inquirySubmitting}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                placeholder={t('mypage.inquiries.emailPlaceholder')}
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="inquiry-category" className="block text-sm font-medium text-gray-700 mb-2">
                              {t('mypage.inquiries.category')} *
                            </label>
                            <select
                              id="inquiry-category"
                              name="category"
                              value={inquiryForm.category}
                              onChange={handleInquiryInputChange}
                              required
                              disabled={inquirySubmitting}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                              <option value="">{t('mypage.inquiries.categoryPlaceholder')}</option>
                              <option value="주문/결제">{t('mypage.inquiries.categories.orderPayment')}</option>
                              <option value="악보/다운로드">{t('mypage.inquiries.categories.sheetDownload')}</option>
                              <option value="주문제작">{t('mypage.inquiries.categories.customOrder')}</option>
                              <option value="기술지원">{t('mypage.inquiries.categories.technical')}</option>
                              <option value="기타">{t('mypage.inquiries.categories.other')}</option>
                            </select>
                          </div>

                          <div>
                            <label htmlFor="inquiry-subject" className="block text-sm font-medium text-gray-700 mb-2">
                              {t('mypage.inquiries.subject')} *
                            </label>
                            <input
                              id="inquiry-subject"
                              name="subject"
                              type="text"
                              value={inquiryForm.subject}
                              onChange={handleInquiryInputChange}
                              required
                              disabled={inquirySubmitting}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                              placeholder={t('mypage.inquiries.subjectPlaceholder')}
                            />
                          </div>

                          <div>
                            <label htmlFor="inquiry-message" className="block text-sm font-medium text-gray-700 mb-2">
                              {t('mypage.inquiries.message')} *
                            </label>
                            <textarea
                              id="inquiry-message"
                              name="message"
                              value={inquiryForm.message}
                              onChange={handleInquiryInputChange}
                              required
                              disabled={inquirySubmitting}
                              rows={6}
                              maxLength={500}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none"
                              placeholder={t('mypage.inquiries.messagePlaceholder')}
                            />
                            <div className="mt-1 text-right text-xs text-gray-400">
                              {inquiryForm.message.length}/500{t('mypage.inquiries.characters')}
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={inquirySubmitting}
                            className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                          >
                            {inquirySubmitting ? t('mypage.inquiries.submitting') : t('mypage.inquiries.submit')}
                          </button>
                        </form>
                      </div>

                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{t('mypage.inquiries.history.title')}</h3>
                            <p className="text-sm text-gray-500">{t('mypage.inquiries.history.description')}</p>
                          </div>
                          <span className="text-sm text-gray-500">{t('mypage.inquiries.history.total', { count: userInquiries.length })}</span>
                        </div>

                        {inquiriesLoading ? (
                          <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                            <p className="font-medium">{t('mypage.inquiries.history.loading')}</p>
                          </div>
                        ) : userInquiries.length === 0 ? (
                          <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                            <i className="ri-question-answer-line text-4xl text-gray-300 mb-4" />
                            <p className="font-medium">{t('mypage.inquiries.history.noInquiries')}</p>
                            <p className="text-sm">{t('mypage.inquiries.history.noInquiriesDescription')}</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {userInquiries.map((inquiry) => (
                              <div key={inquiry.id} className="border border-gray-100 rounded-xl p-5 space-y-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                      {inquiry.category || t('mypage.inquiries.history.category')}
                                    </span>
                                    {renderInquiryStatusBadge(inquiry.status)}
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {t('mypage.inquiries.history.received')} {formatDateTime(inquiry.created_at)}
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900">{inquiry.title}</h4>
                                  <div className="mt-2 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                                    {inquiry.content}
                                  </div>
                                </div>

                                {inquiry.admin_reply ? (
                                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                    <div className="flex flex-col gap-1 text-sm text-blue-700 md:flex-row md:items-center md:justify-between">
                                      <span className="font-semibold">{t('mypage.inquiries.history.adminReply')}</span>
                                      {inquiry.replied_at ? (
                                        <span className="text-xs text-blue-500">
                                          {t('mypage.inquiries.history.replied')} {formatDateTime(inquiry.replied_at)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-blue-900">
                                      {inquiry.admin_reply}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                    {t('mypage.inquiries.history.preparing')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'cash' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.cash.title')}</h3>
                          <p className="text-sm text-gray-500">{t('mypage.cash.description')}</p>
                        </div>
                        <button
                          onClick={handleCashCharge}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                        >
                          {t('mypage.cash.chargeCash')}
                        </button>
                      </div>

                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
                        <p className="text-sm text-blue-600">{t('mypage.cash.availableCash')}</p>
                        {cashBalanceLoading ? (
                          <p className="mt-2 text-3xl font-bold text-blue-400 animate-pulse">로딩 중...</p>
                        ) : cashBalanceError ? (
                          <p className="mt-2 text-lg font-bold text-red-600">
                            오류: {cashBalanceError.message}
                          </p>
                        ) : (
                          <p className="mt-2 text-3xl font-bold text-blue-900">
                            {userCashBalance.toLocaleString('en-US')} P
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        {cashHistoryLoading ? (
                          <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                            <p className="font-medium">{t('mypage.cash.loadingHistory')}</p>
                          </div>
                        ) : cashHistory.length === 0 ? (
                          <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                            <p className="font-medium">{t('mypage.cash.noHistory')}</p>
                            <p className="text-sm">{t('mypage.cash.noHistoryDescription')}</p>
                          </div>
                        ) : (
                          cashHistory.map((entry) => {
                            const meta =
                              CASH_TYPE_META[entry.transaction_type] ?? {
                                label: t('mypage.cash.types.record'),
                                badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200',
                                amountClass: 'text-gray-700',
                              };
                            const amount = entry.amount ?? 0;
                            const amountSign = amount >= 0 ? '+' : '-';
                            const description =
                              entry.description || (entry.sheet?.title ? `${t('mypage.cash.sheet')}: ${entry.sheet.title}` : t('mypage.cash.noDescription'));
                            return (
                              <div
                                key={entry.id}
                                className="flex flex-col gap-3 rounded-xl border border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}
                                    >
                                      {meta.label}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</span>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-gray-900">{description}</p>
                                </div>
                                <div className="text-right min-w-[140px]">
                                  <p className={`text-lg font-bold ${meta.amountClass}`}>
                                    {amountSign}
                                    {Math.abs(amount).toLocaleString('en-US')} P
                                  </p>
                                  {entry.bonus_amount > 0 && (
                                    <p className="text-xs text-emerald-600 mt-1">
                                      {t('mypage.cash.bonus')} +{entry.bonus_amount.toLocaleString('en-US')} P
                                    </p>
                                  )}
                                  {entry.balance_after !== undefined && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {t('mypage.cash.balance')} {entry.balance_after.toLocaleString('en-US')} P
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'custom-orders' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t('mypage.customOrders.title')}</h3>
                          <p className="text-sm text-gray-500">{t('mypage.customOrders.description')}</p>
                        </div>
                        <button
                          onClick={() => navigate('/custom-order')}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                        >
                          {t('mypage.customOrders.newOrderRequest')}
                        </button>
                      </div>

                      {customOrders.length === 0 ? (
                        <div className="py-16 text-center text-gray-500">
                          <i className="ri-file-text-line text-4xl text-gray-300 mb-4" />
                          <p className="font-medium">{t('mypage.customOrders.noOrders')}</p>
                          <p className="text-sm">{t('mypage.customOrders.serviceDescription')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {customOrders.map((order) => (
                            <div key={order.id} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900">{order.song_title}</h4>
                                  <p className="text-sm text-gray-500">{order.artist}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {renderCustomOrderStatusBadge(order.status)}
                                  <p className="text-sm font-semibold text-gray-900">
                                    {order.status === 'quoted' && order.estimated_price
                                      ? formatCurrency(order.estimated_price)
                                      : order.status === 'quoted' && !order.estimated_price
                                        ? t('mypage.customOrders.quoteConfirm')
                                        : order.status === 'completed' && !order.estimated_price
                                          ? t('mypage.customOrders.workCompleted')
                                          : order.estimated_price
                                            ? formatCurrency(order.estimated_price)
                                            : t('mypage.customOrders.quotePending')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                                <span>{t('mypage.customOrders.requestDate')} {formatDateTime(order.created_at)}</span>
                                <span>{t('mypage.customOrders.lastUpdate')} {formatDateTime(order.updated_at)}</span>
                              </div>
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => navigate(`/custom-order-detail/${order.id}`)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                  <i className="ri-chat-1-line"></i>
                                  {t('mypage.customOrders.viewDetails')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* 포인트 충전 모달 */}
      <PointChargeModal
        open={showCashChargeModal}
        onClose={handleCloseCashChargeModal}
        user={user}
        profile={profile}
        userCash={userCashBalance}
        cashLoading={cashBalanceLoading}
        cashError={cashBalanceError}
        onCashUpdate={async () => {
          if (user) {
            await Promise.all([
              loadCashTransactions(user),
              refreshCashBalance(),
            ]);
          }
        }}
      />

      <button
        onClick={() => navigate('/cart')}
        className="hidden md:fixed md:bottom-6 md:right-6 md:z-40 md:flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3 shadow-lg hover:bg-blue-700"
      >
        <i className="ri-shopping-cart-line text-lg" />
        {t('mypage.cart')}
        {cartItems.length > 0 ? (
          <span className="ml-2 rounded-full bg-white text-blue-600 text-xs font-bold px-2 py-0.5">
            {cartItems.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
