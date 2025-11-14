
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { VirtualAccountInfo } from '../../lib/payments';
import { startCashCharge } from '../../lib/payments';
import MainHeader from '../../components/common/MainHeader';
import UserSidebar from '../../components/feature/UserSidebar';
import { useCart } from '../../hooks/useCart';
import type { FavoriteSheet } from '../../lib/favorites';
import { fetchUserFavorites, removeFavorite } from '../../lib/favorites';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { buildDownloadKey, downloadFile, getDownloadFileName, requestSignedDownloadUrl } from '../../utils/downloadHelpers';

type TabKey = 'profile' | 'purchases' | 'downloads' | 'favorites' | 'cash' | 'inquiries' | 'custom-orders';

type MaybeDateString = string | null | undefined;

interface ProfileInfo {
  id: string;
  email: string | null;
  name: string | null;
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

const CASH_TYPE_META: Record<CashTransactionType, { label: string; badgeClass: string; amountClass: string }> = {
  charge: {
    label: '캐쉬 충전',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amountClass: 'text-emerald-600',
  },
  use: {
    label: '캐쉬 사용',
    badgeClass: 'bg-red-50 text-red-600 border border-red-200',
    amountClass: 'text-red-500',
  },
  admin_add: {
    label: '관리자 추가',
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    amountClass: 'text-purple-600',
  },
  admin_deduct: {
    label: '관리자 차감',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    amountClass: 'text-amber-600',
  },
};

const formatCurrency = (value: number) => `₩${value.toLocaleString('ko-KR')}`;
const formatDate = (value: MaybeDateString) => (value ? new Date(value).toLocaleDateString('ko-KR') : '-');
const formatDateTime = (value: MaybeDateString) => (value ? new Date(value).toLocaleString('ko-KR') : '-');

const orderStatusStyles: Record<string, { label: string; className: string }> = {
  completed: { label: '완료', className: 'bg-green-100 text-green-800' },
  pending: { label: '대기', className: 'bg-yellow-100 text-yellow-800' },
  cancelled: { label: '취소', className: 'bg-red-100 text-red-700' },
  refunded: { label: '환불', className: 'bg-purple-100 text-purple-700' },
};

const customOrderStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: '견적중', className: 'bg-blue-100 text-blue-800' },
  quoted: { label: '결제대기', className: 'bg-amber-100 text-amber-700' },
  payment_confirmed: { label: '입금확인', className: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: '작업중', className: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '작업완료', className: 'bg-purple-100 text-purple-700' },
  cancelled: { label: '취소됨', className: 'bg-red-100 text-red-700' },
};

const inquiryStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: '답변 대기', className: 'bg-yellow-100 text-yellow-800' },
  answered: { label: '답변 완료', className: 'bg-emerald-100 text-emerald-700' },
};

const getInquiryStatusMeta = (status: string) =>
  inquiryStatusMap[status] ?? { label: '처리 중', className: 'bg-gray-100 text-gray-600' };

const tabs: { id: TabKey; label: string; icon: string; description?: string }[] = [
  { id: 'profile', label: '프로필 관리', icon: 'ri-user-line', description: '개인 정보 및 연락처를 관리하세요.' },
  { id: 'purchases', label: '구매 내역', icon: 'ri-shopping-bag-line', description: '구매한 악보 주문 정보를 확인하세요.' },
  { id: 'downloads', label: '다운로드 관리', icon: 'ri-download-2-line', description: '구매한 악보를 다운로드하고 미리보기 하세요.' },
  { id: 'favorites', label: '찜한 악보', icon: 'ri-heart-line', description: '관심 있는 악보를 모아보세요.' },
  { id: 'cash', label: '캐시 내역', icon: 'ri-coin-line', description: '보유 캐시와 사용 내역을 확인하세요.' },
  { id: 'inquiries', label: '1:1 문의', icon: 'ri-question-answer-line', description: '문의와 답변을 확인하세요.' },
  { id: 'custom-orders', label: '주문제작 신청', icon: 'ri-file-text-line', description: '맞춤 제작 신청 현황을 확인하세요.' },
];

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cartItems, addToCart, isInCart } = useCart();

  const [user, setUser] = useState<User | null>(null);
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
  const [chargeAmount, setChargeAmount] = useState(10000);
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'kakaopay' | 'bank'>('bank');
  const [chargeAgreementChecked, setChargeAgreementChecked] = useState(false);
  const [chargeProcessing, setChargeProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showDepositorInput, setShowDepositorInput] = useState(false);
  const [depositorName, setDepositorName] = useState('');
  
  const chargeOptions = [
    { amount: 3000, bonus: 0, label: '3천원' },
    { amount: 5000, bonus: 500, label: '5천원', bonusPercent: '10%' },
    { amount: 10000, bonus: 1500, label: '1만원', bonusPercent: '15%' },
    { amount: 30000, bonus: 6000, label: '3만원', bonusPercent: '20%' },
    { amount: 50000, bonus: 11000, label: '5만원', bonusPercent: '22%' },
    { amount: 100000, bonus: 25000, label: '10만원', bonusPercent: '25%' },
  ];

  const paymentMethods = [
    { 
      id: 'card', 
      name: '신용카드', 
      icon: 'ri-bank-card-line', 
      color: 'text-blue-600',
      disabled: true,
      badge: '준비 중',
    },
    {
      id: 'kakaopay',
      name: '카카오페이',
      icon: 'ri-kakao-talk-fill',
      color: 'text-yellow-600',
      disabled: true,
      badge: '준비 중',
    },
    { id: 'bank', name: '무통장입금', icon: 'ri-bank-line', color: 'text-green-600' },
  ] as const;

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
      console.error('캐쉬 내역 로드 오류:', error);
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
      console.error('문의 내역 로드 오류:', error);
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
        .select('id, email, name, phone, credits, created_at')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const profileData: ProfileInfo = {
        id: currentUser.id,
        email: data?.email ?? currentUser.email ?? null,
        name: data?.name ?? (currentUser.user_metadata?.name as string | null) ?? null,
        phone: data?.phone ?? (currentUser.user_metadata?.phone as string | null) ?? null,
        credits: data?.credits ?? 0,
        created_at: data?.created_at ?? currentUser.created_at,
      };

      setProfile(profileData);
      setProfileForm({
        name: profileData.name ?? '',
        phone: profileData.phone ?? '',
      });
    } catch (error) {
      console.error('프로필 로드 오류:', error);
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
        .eq('user_id', currentUser.id)
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
      console.error('구매 내역 로드 오류:', error);
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
      console.error('찜한 악보 로드 오류:', error);
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
      console.error('주문제작 내역 로드 오류:', error);
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
        console.error('마이페이지 초기화 오류:', error);
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
      { label: '구매한 악보', value: totalPurchasedSheets },
      { label: '다운로드 가능', value: downloads.length },
      { label: '찜한 악보', value: favorites.length },
      { label: '1:1 문의', value: userInquiries.length },
      { label: '주문제작 신청', value: customOrders.length },
    ],
    [totalPurchasedSheets, downloads.length, favorites.length, userInquiries.length, customOrders.length]
  );

  const handleCashCharge = () => {
    setBankTransferInfo(null);
    setChargeAgreementChecked(false);
    setChargeProcessing(false);
    setShowCashChargeModal(true);
  };

  const handleCloseCashChargeModal = () => {
    setShowCashChargeModal(false);
    setChargeAgreementChecked(false);
    setChargeProcessing(false);
    setBankTransferInfo(null);
    setShowDepositorInput(false);
    setDepositorName('');
  };

  const handleChargeConfirm = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!chargeAgreementChecked) {
      alert('결제 약관에 동의해 주세요.');
      return;
    }

    const selectedOption = chargeOptions.find((option) => option.amount === chargeAmount);
    if (!selectedOption) {
      alert('선택한 충전 금액을 확인할 수 없습니다.');
      return;
    }

    if (selectedPayment === 'kakaopay' || selectedPayment === 'card') {
      alert('해당 결제수단은 현재 준비 중입니다.');
      return;
    }

    if (selectedPayment === 'bank') {
      // 무통장 입금은 입금자명 입력 단계로 이동
      setShowDepositorInput(true);
      return;
    }
  };

  const handleBankTransferConfirm = async () => {
    if (!user) return;

    if (!depositorName.trim()) {
      alert('입금자명을 입력해 주세요.');
      return;
    }

    const selectedOption = chargeOptions.find((option) => option.amount === chargeAmount);
    if (!selectedOption) {
      alert('선택한 충전 금액을 확인할 수 없습니다.');
      return;
    }

    setChargeProcessing(true);

    try {
      const description = `캐쉬 충전 ${selectedOption.amount.toLocaleString('ko-KR')}원`;
      const result = await startCashCharge({
        userId: user.id,
        amount: selectedOption.amount,
        bonusAmount: selectedOption.bonus ?? 0,
        paymentMethod: 'bank_transfer',
        description,
        buyerName: profile?.name ?? profileForm.name ?? null,
        buyerEmail: user.email ?? null,
        buyerTel: profile?.phone ?? profileForm.phone ?? null,
        depositorName: depositorName.trim(),
        returnUrl: new URL('/payments/inicis/return', window.location.origin).toString(),
      });

      setBankTransferInfo(result.virtualAccountInfo ?? null);
      setShowDepositorInput(false);
      await loadCashTransactions(user);
      alert('주문이 접수되었습니다.\n입금 확인 후 관리자가 캐시 충전을 완료합니다.');
      setChargeAgreementChecked(false);
    } catch (error) {
      console.error('캐쉬 충전 오류:', error);
      alert(error instanceof Error ? error.message : '캐쉬 충전 중 오류가 발생했습니다.');
    } finally {
      setChargeProcessing(false);
    }
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
      alert('로그인이 필요합니다.');
      return;
    }

    if (
      !inquiryForm.name.trim() ||
      !inquiryForm.email.trim() ||
      !inquiryForm.category ||
      !inquiryForm.subject.trim() ||
      !inquiryForm.message.trim()
    ) {
      alert('모든 필드를 입력해주세요.');
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

      alert('문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.');
      setInquiryForm((prev) => ({
        ...prev,
        category: '',
        subject: '',
        message: '',
      }));
      await loadUserInquiries(user);
    } catch (error) {
      console.error('문의 등록 실패:', error);
      alert('문의 전송 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      alert('로그인이 필요합니다.');
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
        credits: profile?.credits ?? 0,
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
              credits: profile?.credits ?? 0,
              created_at: user.created_at,
            }
      );

      alert('프로필 정보가 업데이트되었습니다.');
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      alert('프로필 업데이트에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
      alert('환불되었거나 다운로드가 제한된 주문입니다.');
      return;
    }

    const selectedIds = selectedPurchaseIds[order.id] ?? [];
    if (selectedIds.length === 0) {
      alert('다운로드할 악보를 선택해주세요.');
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
      alert('환불되었거나 다운로드가 제한된 주문입니다.');
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
      alert('다운로드 가능한 악보가 없습니다.');
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
      throw new Error('다운로드 가능한 악보 정보를 찾을 수 없습니다.');
    }

    if (!item.drum_sheets) {
      throw new Error('다운로드 링크를 찾을 수 없습니다. 관리자에게 문의해주세요.');
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
      alert('다운로드할 악보를 선택해주세요.');
      return;
    }

    const invalidItems = items.filter(
      (item) => !DOWNLOADABLE_STATUSES.includes((item.order_status ?? '').toLowerCase()),
    );
    if (invalidItems.length > 0) {
      alert('환불되었거나 다운로드가 제한된 악보는 다운로드할 수 없습니다.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert('로그인이 필요합니다. 다시 로그인한 후 이용해주세요.');
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
      alert(`${failed.length}개의 파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.`);
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
      alert('환불되었거나 다운로드가 제한된 악보는 다운로드할 수 없습니다.');
      return;
    }

    const key = buildDownloadKey(item.order_id, item.id);
    startDownloading(key);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
      }

      await downloadSheetItem(item, session.access_token);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('파일 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      finishDownloading(key);
    }
  };

  const handlePreview = (item: DownloadableItem) => {
    const previewUrl = item.drum_sheets?.preview_image_url;
    if (!previewUrl) {
      alert('미리보기 파일을 찾을 수 없습니다.');
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
      console.error('찜 해제 오류:', error);
      alert('찜 해제에 실패했습니다.');
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
    const badge = orderStatusStyles[normalized];
    if (!badge) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status || '미정'}</span>;
    }
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const renderCustomOrderStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase();
    const badge = customOrderStatusMap[normalized];
    if (!badge) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{status || '미정'}</span>;
    }
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const renderLoader = () => (
    <div className="py-24 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full border-b-2 border-blue-600 animate-spin mb-4" />
      <p className="text-gray-600 font-medium">마이페이지 데이터를 불러오는 중이에요...</p>
    </div>
  );

  const renderGuestState = () => (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
      <i className="ri-user-line text-5xl text-gray-400" />
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-600">구매 내역, 다운로드, 찜한 악보 등 마이페이지 기능을 이용하려면 로그인해주세요.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          로그인하러 가기
        </button>
        <button
          onClick={() => navigate('/auth/signup')}
          className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
        >
          회원가입
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
              <h2 className="text-3xl font-extrabold text-gray-900">마이페이지</h2>
              <p className="mt-2 text-gray-600">악보 구매부터 주문제작까지, 나의 활동을 한눈에 살펴보세요.</p>
            </header>

            <section className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                    {(profile?.name ?? profile?.email ?? 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">회원 정보</p>
                    <h3 className="text-xl font-bold text-gray-900">{profile?.name || '이름 미설정'}</h3>
                    <p className="text-sm text-gray-600">{profile?.email}</p>
                    <p className="mt-2 text-xs text-gray-400">가입일 {formatDate(profile?.created_at)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-500">보유 캐시</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">
                      {formatCurrency(profile?.credits ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">다음 악보 구매 시 사용 가능합니다.</p>
                  </div>
                  <button
                    onClick={handleCashCharge}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold shadow-lg hover:bg-red-600 transition"
                  >
                    캐시 충전
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
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                      activeTab === tab.id
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
                    <h3 className="text-xl font-bold text-gray-900 mb-6">프로필 관리</h3>
                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                          <input
                            type="email"
                            value={profile?.email ?? ''}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="이름을 입력하세요"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
                          <input
                            type="tel"
                            value={profileForm.phone}
                            onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                            placeholder="전화번호를 입력하세요"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">가입 날짜</label>
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
                          className={`px-6 py-3 rounded-lg font-semibold text-white transition ${
                            profileSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {profileSaving ? '저장 중...' : '프로필 업데이트'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {activeTab === 'purchases' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">구매 내역</h3>
                        <p className="text-sm text-gray-500">최근 주문 순으로 정렬되었습니다.</p>
                      </div>
                      <Link
                        to="/categories"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50"
                      >
                        <i className="ri-add-line text-lg" /> 악보 더 둘러보기
                      </Link>
                    </div>

                    {orders.length === 0 ? (
                      <div className="py-16 text-center text-gray-500">
                        <i className="ri-shopping-bag-line text-4xl text-gray-300 mb-4" />
                        <p className="font-medium">아직 구매한 악보가 없습니다.</p>
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
                                  <p className="text-sm text-gray-500">주문 번호</p>
                                  <h4 className="text-lg font-semibold text-gray-900">
                                    #{order.id.slice(0, 8).toUpperCase()}
                                  </h4>
                                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.created_at)}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  {renderOrderStatusBadge(order.status)}
                                  <p className="text-base font-semibold text-gray-900">
                                    총 {formatCurrency(order.total_amount)}
                                  </p>
                                  {hasSelectableItems ? (
                                    <button
                                      onClick={() => handleDownloadAllInOrder(order)}
                                      disabled={bulkDownloading}
                                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                        bulkDownloading
                                          ? 'border-blue-200 bg-blue-100 text-blue-300 cursor-not-allowed'
                                          : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                                      }`}
                                    >
                                      <i className="ri-stack-line text-base" />
                                      {bulkDownloading ? '다운로드 중...' : '이 주문 전체 다운로드'}
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
                                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                                        bulkDownloading
                                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'border-gray-300 text-gray-700 hover:bg-white'
                                      }`}
                                    >
                                      <i className="ri-checkbox-multiple-line text-base" />
                                      {allSelectableSelected ? '전체 해제' : '전체 선택'}
                                    </button>
                                    <button
                                      onClick={() => clearPurchaseSelection(order.id)}
                                      disabled={bulkDownloading || selectedCount === 0}
                                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                                        bulkDownloading || selectedCount === 0
                                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'border-gray-300 text-gray-700 hover:bg-white'
                                      }`}
                                    >
                                      <i className="ri-close-circle-line text-base" />
                                      선택 해제
                                    </button>
                                    <span className="text-xs text-gray-500">
                                      선택 {selectedCount.toLocaleString('ko-KR')}개
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => handleDownloadSelectedInOrder(order)}
                                      disabled={bulkDownloading || selectedCount === 0}
                                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                                        bulkDownloading || selectedCount === 0
                                          ? 'bg-blue-300 cursor-not-allowed'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      }`}
                                    >
                                      <i className="ri-download-2-line text-base" />
                                      {bulkDownloading ? '다운로드 중...' : '선택 다운로드'}
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
                                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                                        isSelected
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
                                            {item.drum_sheets?.categories?.name ?? '카테고리 미지정'}
                                          </p>
                                          <h5 className="font-semibold text-gray-900">
                                            {item.drum_sheets?.title ?? '삭제된 악보'}
                                          </h5>
                                          <p className="text-sm text-gray-500">{item.drum_sheets?.artist ?? '-'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleDownload(downloadItem)}
                                          disabled={isDownloading}
                                          className={`px-3 py-2 rounded-lg text-sm font-semibold text-white transition ${
                                            isDownloading
                                              ? 'bg-blue-300 cursor-not-allowed'
                                              : 'bg-blue-600 hover:bg-blue-700'
                                          }`}
                                        >
                                          {isDownloading ? '다운로드 중...' : '다운로드'}
                                        </button>
                                        <button
                                          onClick={() => handleGoToSheet(item.sheet_id)}
                                          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                          상세보기
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
                        <h3 className="text-xl font-bold text-gray-900">다운로드 관리</h3>
                        <p className="text-sm text-gray-500">구매한 악보를 언제든지 다시 다운로드할 수 있습니다.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">총 {downloads.length}개</p>
                        {selectedDownloadIds.length > 0 ? (
                          <p className="mt-1 text-xs text-blue-600">선택 {selectedDownloadIds.length}개</p>
                        ) : null}
                      </div>
                    </div>

                    {downloads.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleToggleSelectAllDownloads}
                            disabled={downloads.length === 0 || bulkDownloading}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                              downloads.length === 0 || bulkDownloading
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <i className="ri-checkbox-multiple-line text-base" />
                            {downloads.length > 0 && selectedDownloadIds.length === downloads.length ? '전체 해제' : '전체 선택'}
                          </button>
                          <button
                            onClick={clearDownloadSelection}
                            disabled={selectedDownloadIds.length === 0 || bulkDownloading}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                              selectedDownloadIds.length === 0 || bulkDownloading
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <i className="ri-close-circle-line text-base" />
                            선택 해제
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleDownloadSelected}
                            disabled={selectedDownloadIds.length === 0 || bulkDownloading}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                              selectedDownloadIds.length === 0 || bulkDownloading
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <i className="ri-download-2-line text-base" />
                            {bulkDownloading ? '다운로드 중...' : '선택 다운로드'}
                          </button>
                          <button
                            onClick={handleDownloadAll}
                            disabled={downloads.length === 0 || bulkDownloading}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                              downloads.length === 0 || bulkDownloading
                                ? 'bg-indigo-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            <i className="ri-stack-line text-base" />
                            {bulkDownloading ? '다운로드 중...' : '전체 다운로드'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {downloads.length === 0 ? (
                      <div className="py-16 text-center text-gray-500">
                        <i className="ri-download-2-line text-4xl text-gray-300 mb-4" />
                        <p className="font-medium">다운로드 가능한 악보가 없습니다.</p>
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
                              className={`rounded-xl border p-4 space-y-3 transition ${
                                isSelected
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
                                    alt={item.drum_sheets?.title ?? '악보 썸네일'}
                                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                    onError={(event) => {
                                      (event.target as HTMLImageElement).src = generateDefaultThumbnail(96, 96);
                                    }}
                                  />
                                  <div>
                                    <h4 className="font-semibold text-gray-900">
                                      {item.drum_sheets?.title ?? '삭제된 악보'}
                                    </h4>
                                    <p className="text-sm text-gray-500">{item.drum_sheets?.artist ?? '-'}</p>
                                    <p className="text-xs text-gray-400">구매일 {formatDate(item.order_created_at)}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => handleDownload(item)}
                                  disabled={isDownloading || !isDownloadableStatus}
                                  className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold text-white transition ${
                                    isDownloading || !isDownloadableStatus
                                      ? 'bg-blue-300 cursor-not-allowed'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  {isDownloading
                                    ? '다운로드 중...'
                                    : isDownloadableStatus
                                    ? '다운로드'
                                    : '다운로드 불가'}
                                </button>
                                <button
                                  onClick={() => handlePreview(item)}
                                  disabled={bulkDownloading}
                                  className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold transition ${
                                    bulkDownloading
                                      ? 'border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  미리보기
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
                        <h3 className="text-xl font-bold text-gray-900">찜한 악보</h3>
                        <p className="text-sm text-gray-500">관심 있는 악보를 빠르게 찾아보세요.</p>
                      </div>
                      <p className="text-sm text-gray-500">총 {favorites.length}개</p>
                    </div>

                    {favorites.length === 0 ? (
                      <div className="py-16 text-center text-gray-500">
                        <i className="ri-heart-line text-4xl text-gray-300 mb-4" />
                        <p className="font-medium">찜한 악보가 없습니다.</p>
                        <p className="text-sm">마음에 드는 악보를 찜해보세요!</p>
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
                                  {favorite.sheet?.title ?? '삭제된 악보'}
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
                                상세보기
                              </button>
                              <button
                                onClick={() => handleAddToCart(favorite.sheet_id)}
                                className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm font-semibold border ${
                                  isInCart(favorite.sheet_id)
                                    ? 'border-green-200 bg-green-50 text-green-600 cursor-not-allowed'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                                disabled={isInCart(favorite.sheet_id)}
                              >
                                {isInCart(favorite.sheet_id) ? '장바구니에 있음' : '장바구니'}
                              </button>
                              <button
                                onClick={() => handleFavoriteRemove(favorite.sheet_id)}
                                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                찜 해제
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
                        <h3 className="text-xl font-bold text-gray-900">1:1 문의하기</h3>
                        <p className="text-sm text-gray-500">
                          문의를 등록하면 관리자 답변을 마이페이지에서 바로 확인할 수 있습니다.
                        </p>
                      </div>

                      <form className="space-y-5" onSubmit={handleInquirySubmit}>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <div>
                            <label htmlFor="inquiry-name" className="block text-sm font-medium text-gray-700 mb-2">
                              이름 *
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
                              placeholder="이름을 입력하세요"
                            />
                          </div>
                          <div>
                            <label htmlFor="inquiry-email" className="block text-sm font-medium text-gray-700 mb-2">
                              이메일 *
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
                              placeholder="연락 가능한 이메일을 입력하세요"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="inquiry-category" className="block text-sm font-medium text-gray-700 mb-2">
                            문의 유형 *
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
                            <option value="">문의 유형을 선택하세요</option>
                            <option value="주문/결제">주문/결제 문의</option>
                            <option value="악보/다운로드">악보/다운로드 문의</option>
                            <option value="주문제작">주문제작 문의</option>
                            <option value="기술지원">기술지원</option>
                            <option value="기타">기타 문의</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="inquiry-subject" className="block text-sm font-medium text-gray-700 mb-2">
                            제목 *
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
                            placeholder="문의 제목을 입력하세요"
                          />
                        </div>

                        <div>
                          <label htmlFor="inquiry-message" className="block text-sm font-medium text-gray-700 mb-2">
                            문의 내용 *
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
                            placeholder="문의 내용을 자세히 작성해 주세요 (최대 500자)"
                          />
                          <div className="mt-1 text-right text-xs text-gray-400">
                            {inquiryForm.message.length}/500자
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={inquirySubmitting}
                          className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                        >
                          {inquirySubmitting ? '전송 중...' : '문의 등록'}
                        </button>
                      </form>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">내 문의 내역</h3>
                          <p className="text-sm text-gray-500">등록된 문의와 관리자 답변을 확인하세요.</p>
                        </div>
                        <span className="text-sm text-gray-500">총 {userInquiries.length}건</span>
                      </div>

                      {inquiriesLoading ? (
                        <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                          <p className="font-medium">문의 내역을 불러오는 중입니다...</p>
                        </div>
                      ) : userInquiries.length === 0 ? (
                        <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                          <i className="ri-question-answer-line text-4xl text-gray-300 mb-4" />
                          <p className="font-medium">등록된 문의가 없습니다.</p>
                          <p className="text-sm">궁금한 점이 있다면 위 양식을 통해 문의를 남겨주세요.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {userInquiries.map((inquiry) => (
                            <div key={inquiry.id} className="border border-gray-100 rounded-xl p-5 space-y-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {inquiry.category || '문의'}
                                  </span>
                                  {renderInquiryStatusBadge(inquiry.status)}
                                </div>
                                <span className="text-xs text-gray-400">
                                  접수 {formatDateTime(inquiry.created_at)}
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
                                    <span className="font-semibold">관리자 답변</span>
                                    {inquiry.replied_at ? (
                                      <span className="text-xs text-blue-500">
                                        답변 {formatDateTime(inquiry.replied_at)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-blue-900">
                                    {inquiry.admin_reply}
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                  답변 준비 중입니다. 담당자가 확인 후 안내드리겠습니다.
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
                        <h3 className="text-xl font-bold text-gray-900">캐시 내역</h3>
                        <p className="text-sm text-gray-500">보유 캐시와 사용 내역을 확인하세요.</p>
                      </div>
                      <button
                        onClick={handleCashCharge}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                      >
                        캐시 충전
                      </button>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
                      <p className="text-sm text-blue-600">보유 캐시</p>
                      <p className="mt-2 text-3xl font-bold text-blue-900">
                        {formatCurrency(profile?.credits ?? 0)}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {cashHistoryLoading ? (
                        <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                          <p className="font-medium">캐쉬 내역을 불러오는 중입니다...</p>
                        </div>
                      ) : cashHistory.length === 0 ? (
                        <div className="py-16 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                          <p className="font-medium">표시할 캐시 내역이 없습니다.</p>
                          <p className="text-sm">캐시를 충전하거나 사용하면 이곳에 기록됩니다.</p>
                        </div>
                      ) : (
                        cashHistory.map((entry) => {
                          const meta =
                            CASH_TYPE_META[entry.transaction_type] ?? {
                              label: '기록',
                              badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200',
                              amountClass: 'text-gray-700',
                            };
                          const amount = entry.amount ?? 0;
                          const amountSign = amount >= 0 ? '+' : '-';
                          const description =
                            entry.description || (entry.sheet?.title ? `악보: ${entry.sheet.title}` : '기록된 설명이 없습니다.');
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
                                  {formatCurrency(Math.abs(amount))}
                                </p>
                                {entry.bonus_amount > 0 && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    보너스 +{formatCurrency(entry.bonus_amount)}
                                  </p>
                                )}
                                {entry.balance_after !== undefined && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    잔액 {formatCurrency(entry.balance_after)}
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
                        <h3 className="text-xl font-bold text-gray-900">주문제작 신청 내역</h3>
                        <p className="text-sm text-gray-500">맞춤 제작 진행 상황을 확인하세요.</p>
                      </div>
                      <button
                        onClick={() => navigate('/custom-order')}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                      >
                        새 주문 신청
                      </button>
                    </div>

                    {customOrders.length === 0 ? (
                      <div className="py-16 text-center text-gray-500">
                        <i className="ri-file-text-line text-4xl text-gray-300 mb-4" />
                        <p className="font-medium">주문제작 신청 내역이 없습니다.</p>
                        <p className="text-sm">맞춤 제작 서비스를 이용해 특별한 악보를 만들어보세요.</p>
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
                                    ? '견적 확인'
                                    : order.status === 'completed' && !order.estimated_price
                                    ? '작업완료'
                                    : order.estimated_price
                                    ? formatCurrency(order.estimated_price)
                                    : '견적 미정'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                              <span>신청일 {formatDateTime(order.created_at)}</span>
                              <span>최근 업데이트 {formatDateTime(order.updated_at)}</span>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => navigate(`/custom-order-detail/${order.id}`)}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                              >
                                <i className="ri-chat-1-line"></i>
                                상세 보기
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

      {/* 캐쉬충전 모달 */}
      {showCashChargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">캐쉬충전</h2>
              <button onClick={handleCloseCashChargeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-4">
              {/* 현재 포인트 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center">
                <i className="ri-coins-line text-yellow-600 text-lg mr-2"></i>
                <span className="text-sm text-gray-700">보유 악보캐쉬</span>
                <span className="ml-auto font-bold text-yellow-600">
                  {(profile?.credits ?? 0).toLocaleString()} P
                </span>
              </div>

              {showDepositorInput ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">무통장 입금 정보</h3>
                  
                  <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">입금하실 금액</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(chargeAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">입금 계좌 정보</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">은행</span>
                      <span className="text-xs font-medium text-gray-900">농협</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">계좌번호</span>
                      <span className="text-xs font-medium text-gray-900">106-02-303742</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">예금주</span>
                      <span className="text-xs font-medium text-gray-900">강만수</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="depositor-name" className="block text-sm font-semibold text-gray-900">
                      입금자명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="depositor-name"
                      type="text"
                      value={depositorName}
                      onChange={(e) => setDepositorName(e.target.value)}
                      placeholder="입금자명을 입력하세요"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      * 회원명과 입금자가 다른 경우, 입금자명을 기입해 주시기 바랍니다.
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                    <div className="flex gap-2">
                      <i className="ri-information-line text-yellow-600 text-base flex-shrink-0 mt-0.5"></i>
                      <div className="text-xs text-gray-700 space-y-1">
                        <p>• 입금 확인 후 관리자가 수동으로 캐시 충전을 완료합니다.</p>
                        <p>• 입금자명이 일치하지 않으면 확인이 지연될 수 있습니다.</p>
                        <p>• 입금 확인은 영업일 기준 1~2일 소요될 수 있습니다.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDepositorInput(false)}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                      이전
                    </button>
                    <button
                      onClick={handleBankTransferConfirm}
                      disabled={chargeProcessing}
                      className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-70 font-medium text-sm transition-colors"
                    >
                      {chargeProcessing ? '처리 중...' : '확인'}
                    </button>
                  </div>
                </div>
              ) : bankTransferInfo ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3">무통장입금 안내</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>
                        <span className="font-medium text-gray-900">은행</span> {bankTransferInfo.bankName}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">계좌번호</span>{' '}
                        {bankTransferInfo.accountNumber}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">예금주</span> {bankTransferInfo.depositor}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">입금금액</span>{' '}
                        {formatCurrency(bankTransferInfo.amount ?? chargeAmount)}
                      </li>
                      {bankTransferInfo.expectedDepositor ? (
                        <li>
                          <span className="font-medium text-gray-900">입금자명</span>{' '}
                          <span className="text-blue-600 font-semibold">
                            {bankTransferInfo.expectedDepositor}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                    {bankTransferInfo.message ? (
                      <p className="mt-4 text-xs text-gray-600">{bankTransferInfo.message}</p>
                    ) : null}
                  </div>

                  <button
                    onClick={handleCloseCashChargeModal}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  {/* 결제금액 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">결제금액</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {chargeOptions.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => setChargeAmount(option.amount)}
                          className={`relative p-3 border rounded-lg text-left transition-colors ${
                            chargeAmount === option.amount
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{option.label}</span>
                            <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                              {chargeAmount === option.amount && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          {option.bonus > 0 && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">
                                +{option.bonus.toLocaleString()} 적립
                              </span>
                              <span className="ml-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                                {option.bonusPercent}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 결제방법 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">결제방법</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {paymentMethods.map((method) => {
                        const isSelected = selectedPayment === method.id;
                        const isDisabled = method.disabled;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              if (isDisabled) {
                                alert('해당 결제수단은 현재 준비 중입니다.');
                                return;
                              }
                              setSelectedPayment(method.id);
                            }}
                            disabled={isDisabled}
                            className={`p-3 border rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <i className={`${method.icon} ${method.color} text-lg mr-2`}></i>
                                <span className="text-sm font-medium">{method.name}</span>
                              </div>
                              <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                                {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                              </div>
                            </div>
                            {method.badge ? (
                              <div className="mt-1">
                                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
                                  {method.badge}
                                </span>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 약관 동의 */}
                  <div className="mb-6">
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chargeAgreementChecked}
                        onChange={(event) => setChargeAgreementChecked(event.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                      <span className="ml-2 text-xs text-gray-600 leading-relaxed">
                        결제 내용을 확인하였으며, 약관에 동의합니다.
                        <button type="button" className="text-blue-600 hover:text-blue-800 ml-1">
                          <i className="ri-arrow-down-s-line"></i>
                        </button>
                      </span>
                    </label>
                  </div>

                  {/* 충전하기 버튼 */}
                  <button
                    onClick={handleChargeConfirm}
                    disabled={chargeProcessing}
                    className={`w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-bold text-sm transition-colors ${
                      chargeProcessing ? 'opacity-70 cursor-not-allowed' : 'hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    {chargeProcessing ? '처리 중...' : '다음'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => navigate('/cart')}
        className="hidden md:fixed md:bottom-6 md:right-6 md:z-40 md:flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3 shadow-lg hover:bg-blue-700"
      >
        <i className="ri-shopping-cart-line text-lg" />
        장바구니
        {cartItems.length > 0 ? (
          <span className="ml-2 rounded-full bg-white text-blue-600 text-xs font-bold px-2 py-0.5">
            {cartItems.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
