
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { generateDefaultThumbnail } from '@/lib/defaultThumbnail';
import MainHeader from '@/components/common/MainHeader';
import UserSidebar from '@/components/feature/UserSidebar';
import { useCart } from '@/hooks/useCart';
import { buildDownloadKey, downloadFile, getDownloadFileName, requestSignedDownloadUrl } from '@/utils/downloadHelpers';
import type { VirtualAccountInfo } from '@/lib/payments';

interface CategoryInfo {
  name: string | null;
}

interface DrumSheetInfo {
  id: string;
  title: string | null;
  artist: string | null;
  price: number | null;
  thumbnail_url: string | null;
  pdf_url: string | null;
  preview_image_url: string | null;
  categories?: CategoryInfo | CategoryInfo[] | null;
}

interface OrderItemInfo {
  id: string;
  sheet_id: string;
  price: number | null;
  created_at: string | null;
  drum_sheets: DrumSheetInfo | null;
}

interface OrderSummary {
  id: string;
  order_number?: string | null;
  created_at: string | null;
  status: string | null;
  total_amount: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_confirmed_at?: string | null;
  transaction_id?: string | null;
  depositor_name?: string | null;
  virtual_account_info?: VirtualAccountInfo | null;
  order_items: OrderItemInfo[];
}

const STATUS_META: Record<
  string,
  { label: string; badgeClass: string; description?: string }
> = {
  pending: {
    label: '결제 대기',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    description: '결제 확인을 기다리고 있습니다.',
  },
  in_progress: {
    label: '처리 중',
    badgeClass: 'bg-blue-100 text-blue-800',
    description: '주문이 처리되고 있습니다.',
  },
  completed: {
    label: '완료',
    badgeClass: 'bg-green-100 text-green-800',
    description: '결제가 정상적으로 완료되었습니다.',
  },
  cancelled: {
    label: '취소됨',
    badgeClass: 'bg-red-100 text-red-700',
    description: '주문이 취소되었습니다.',
  },
  awaiting_deposit: {
    label: '입금 대기',
    badgeClass: 'bg-amber-100 text-amber-700',
    description: '무통장입금 확인을 기다리고 있습니다.',
  },
  payment_confirmed: {
    label: '결제 확인',
    badgeClass: 'bg-blue-100 text-blue-800',
    description: '결제가 확인되었습니다. 다운로드가 가능합니다.',
  },
  paid: {
    label: '결제 완료',
    badgeClass: 'bg-green-100 text-green-900',
    description: '결제가 완료되었습니다.',
  },
  refunded: {
    label: '환불 완료',
    badgeClass: 'bg-purple-100 text-purple-700',
    description: '환불이 완료된 주문입니다. 해당 악보는 더 이상 다운로드할 수 없습니다.',
  },
};

const DOWNLOADABLE_STATUSES = ['completed', 'payment_confirmed', 'paid'];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: '카드 결제',
  bank_transfer: '계좌 이체',
  virtual_account: '가상 계좌',
  cash: '보유 캐시',
  points: '포인트 사용',
};

const formatCurrency = (value: number | null | undefined) =>
  value != null ? `₩${value.toLocaleString('ko-KR')}` : '-';

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('ko-KR') : '-';

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('ko-KR') : '-';

const normalizePaymentMethod = (method: string | null | undefined) => {
  if (!method) return '-';
  const key = method.toLowerCase();
  return PAYMENT_METHOD_LABELS[key] ?? method;
};

const getCategoryName = (categories: DrumSheetInfo['categories']) => {
  if (!categories) return '카테고리 미지정';
  if (Array.isArray(categories)) {
    return categories[0]?.name ?? '카테고리 미지정';
  }
  return categories.name ?? '카테고리 미지정';
};

const getStatusMeta = (status: string | null | undefined) => {
  if (!status) {
    return {
      label: '미정',
      badgeClass: 'bg-gray-100 text-gray-600',
      description: undefined,
    };
  }
  return (
    STATUS_META[status.toLowerCase()] ?? {
      label: status,
      badgeClass: 'bg-gray-100 text-gray-600',
    }
  );
};

const MyOrdersPage = () => {
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Record<string, string[]>>({});
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [downloadingKeys, setDownloadingKeys] = useState<string[]>([]);

  const loadOrders = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
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
      `
      )
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedOrders: OrderSummary[] = (data ?? []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number ?? null,
      created_at: order.created_at ?? null,
      status: order.status ?? null,
      total_amount: order.total_amount ?? 0,
      payment_method: order.payment_method ?? null,
      payment_status: order.payment_status ?? null,
      payment_confirmed_at: order.payment_confirmed_at ?? null,
      transaction_id: order.transaction_id ?? null,
      depositor_name: order.depositor_name ?? null,
      virtual_account_info: (order.virtual_account_info ?? null) as VirtualAccountInfo | null,
      order_items: (order.order_items ?? []).map((item: any) => ({
        id: item.id,
        sheet_id: item.drum_sheets?.id ?? '',
        price: item.price ?? null,
        created_at: item.created_at ?? null,
        drum_sheets: item.drum_sheets
          ? {
              id: item.drum_sheets.id,
              title: item.drum_sheets.title ?? null,
              artist: item.drum_sheets.artist ?? null,
              price: item.drum_sheets.price ?? null,
              thumbnail_url: item.drum_sheets.thumbnail_url ?? null,
              pdf_url: item.drum_sheets.pdf_url ?? null,
              preview_image_url: item.drum_sheets.preview_image_url ?? null,
              categories: item.drum_sheets.categories ?? null,
            }
          : null,
      })),
    }));

    const filteredOrders = normalizedOrders.filter((order) => (order.order_items?.length ?? 0) > 0);

    setOrders(filteredOrders);
    setSelectedPurchaseIds((prev) => {
      const next: Record<string, string[]> = {};
      filteredOrders.forEach((order) => {
        const normalizedStatus = (order.status ?? '').toLowerCase();
        if (!DOWNLOADABLE_STATUSES.includes(normalizedStatus)) {
          return;
        }
        const existing = prev[order.id] ?? [];
        if (existing.length === 0) {
          return;
        }

        const validIds = existing.filter((id) =>
          order.order_items.some((item) => item.id === id && item.sheet_id),
        );
        if (validIds.length > 0) {
          next[order.id] = validIds;
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialise = async () => {
      setLoading(true);
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        setUser(currentUser ?? null);

        if (currentUser) {
          await loadOrders(currentUser);
        } else {
          setOrders([]);
        }
      } catch (error) {
        console.error('구매 내역 초기화 오류:', error);
        if (isMounted) {
          setOrders([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) {
        return;
      }

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        setLoading(true);
        try {
          await loadOrders(nextUser);
        } catch (error) {
          console.error('구매 내역 갱신 오류:', error);
          setOrders([]);
        } finally {
          setLoading(false);
        }
      } else {
        setOrders([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadOrders]);

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

  const totalPurchasedSheets = useMemo(
    () =>
      orders.reduce(
        (total, order) => total + (order.order_items?.length ?? 0),
        0
      ),
    [orders]
  );

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

  const toggleSelectAllInOrder = (orderId: string, orderItems: OrderItemInfo[]) => {
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

  const startDownloading = (key: string) => {
    setDownloadingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const finishDownloading = (key: string) => {
    setDownloadingKeys((prev) => prev.filter((value) => value !== key));
  };

  const handleDownloadMultiple = async (targets: { order: OrderSummary; item: OrderItemInfo }[]) => {
    if (targets.length === 0) {
      alert('다운로드할 악보를 선택해주세요.');
      return;
    }

    const invalidTargets = targets.filter(
      ({ order }) => !DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase()),
    );
    if (invalidTargets.length > 0) {
      alert('환불되었거나 다운로드가 제한된 주문이 포함되어 있습니다.');
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
    const failed: { order: OrderSummary; item: OrderItemInfo }[] = [];

    try {
      for (const { order, item } of targets) {
        if (!item.sheet_id) {
          failed.push({ order, item });
          continue;
        }

        if (!item.drum_sheets) {
          failed.push({ order, item });
          continue;
        }

        const key = buildDownloadKey(order.id, item.id);
        startDownloading(key);

        try {
          const fileName = getDownloadFileName({
            title: item.drum_sheets?.title,
            artist: item.drum_sheets?.artist,
            orderId: order.id,
          });
          const signedUrl = await requestSignedDownloadUrl({
            orderId: order.id,
            orderItemId: item.id,
            accessToken: session.access_token,
          });
          await downloadFile(signedUrl, fileName);
        } catch (_error) {
          failed.push({ order, item });
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

    const targets = order.order_items
      .filter((item) => item.sheet_id && selectedIds.includes(item.id))
      .map((item) => ({ order, item }));

    await handleDownloadMultiple(targets);
  };

  const handleDownloadAllInOrder = async (order: OrderSummary) => {
    if (!DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())) {
      alert('환불되었거나 다운로드가 제한된 주문입니다.');
      return;
    }

    const targets = order.order_items
      .filter((item) => item.sheet_id)
      .map((item) => ({ order, item }));

    if (targets.length === 0) {
      alert('다운로드 가능한 악보가 없습니다.');
      return;
    }

    await handleDownloadMultiple(targets);
  };

  const handleDownload = async (order: OrderSummary, item: OrderItemInfo) => {
    if (!DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())) {
      alert('환불되었거나 다운로드가 제한된 주문입니다.');
      return;
    }

    if (!item.sheet_id) {
      alert('다운로드 가능한 악보 정보를 찾을 수 없습니다.');
      return;
    }

    if (!item.drum_sheets) {
      alert('다운로드 가능한 파일을 찾을 수 없습니다.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert('로그인이 필요합니다. 다시 로그인해주세요.');
      return;
    }

    const key = buildDownloadKey(order.id, item.id);
    startDownloading(key);

    try {
      const fileName = getDownloadFileName({
        title: item.drum_sheets?.title,
        artist: item.drum_sheets?.artist,
        orderId: order.id,
      });
      const signedUrl = await requestSignedDownloadUrl({
        orderId: order.id,
        orderItemId: item.id,
        accessToken: session.access_token,
      });
      await downloadFile(signedUrl, fileName);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600">
            악보 구매 내역을 확인하려면 로그인해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 메인 헤더 */}
      <MainHeader user={user} />

      {/* 사용자 사이드바 */}
      <UserSidebar user={user} />

      {/* 메인 컨텐츠 */}
      <div className={user ? 'mr-64' : ''}>
        <div className="bg-gray-50 py-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">악보 구매 내역</h1>
            <p className="mt-2 text-gray-600">
              최근 순으로 정렬된 악보 구입 목록입니다.
              {orders.length > 0 && (
                <span className="ml-1">
                  총 {totalPurchasedSheets}개의 악보를 구매하셨습니다.
                </span>
              )}
            </p>
          </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
              <i className="ri-shopping-bag-line text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              구매한 악보가 없습니다
            </h3>
            <p className="text-gray-600 mb-6">
              마음에 드는 악보를 찾아 장바구니에 담아보세요.
            </p>
            <a
              href="/categories"
              className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="ri-music-2-line mr-2"></i>
              악보 둘러보기
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const statusMeta = getStatusMeta(order.status);
              const normalizedStatus = (order.status ?? '').toLowerCase();
              const isDownloadableStatus = DOWNLOADABLE_STATUSES.includes(normalizedStatus);
              const selectableOrderItems = order.order_items.filter((item) => item.sheet_id);
              const orderSelectedIds = selectedPurchaseIds[order.id] ?? [];
              const selectedCount = orderSelectedIds.length;
              const allSelectableSelected =
                selectableOrderItems.length > 0 && selectedCount === selectableOrderItems.length;
              const hasSelectableItems = selectableOrderItems.length > 0;
              const canDownload = isDownloadableStatus && hasSelectableItems;
              const shortOrderId = order.id ? order.id.slice(0, 8).toUpperCase() : '-';
              const displayOrderNumber = order.order_number ?? `#${shortOrderId}`;

              return (
                <section
                  key={order.id}
                  className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5"
                >
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>주문 번호</span>
                        <span className="font-semibold text-gray-900">
                          {displayOrderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDateTime(order.created_at)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        결제 수단: {normalizePaymentMethod(order.payment_method)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                      <p className="text-base font-semibold text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </p>
                      {canDownload ? (
                        <button
                          type="button"
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
                  </header>

                  {canDownload ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
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
                          type="button"
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
                          type="button"
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

                  <div className="space-y-4">
                    {order.order_items.map((item) => {
                      const sheet = item.drum_sheets;
                      const thumbnailSrc =
                        sheet?.thumbnail_url ||
                        generateDefaultThumbnail(
                          96,
                          96,
                          sheet?.title ?? '악보 썸네일'
                        );

                      const downloadKey = buildDownloadKey(order.id, item.id);
                      const isDownloading = bulkDownloading || downloadingKeys.includes(downloadKey);
                      const isSelectable = Boolean(item.sheet_id);
                      const isSelected = isSelectable && isDownloadableStatus && orderSelectedIds.includes(item.id);

                      return (
                        <article
                          key={item.id}
                          className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3 transition ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                              : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={isSelectable && isDownloadableStatus ? isSelected : false}
                              onChange={() => togglePurchaseSelection(order.id, item.id)}
                              disabled={!isSelectable || bulkDownloading || !isDownloadableStatus}
                            />
                            <img
                              src={thumbnailSrc}
                              alt={sheet?.title ?? '악보 썸네일'}
                              className="h-16 w-16 rounded-lg object-cover"
                              onError={(event) => {
                                (event.target as HTMLImageElement).src =
                                  generateDefaultThumbnail(96, 96);
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">
                                {getCategoryName(sheet?.categories)}
                              </p>
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {sheet?.title ?? '삭제된 악보'}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {sheet?.artist ?? '-'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                구매일 {formatDate(item.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(item.price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownload(order, item)}
                              disabled={isDownloading || !DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
                                isDownloading ||
                                !DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())
                                  ? 'bg-blue-300 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <i className="ri-download-line"></i>
                              {isDownloading
                                ? '다운로드 중...'
                                : DOWNLOADABLE_STATUSES.includes((order.status ?? '').toLowerCase())
                                ? '다운로드'
                                : '다운로드 불가'}
                            </button>
                            <a
                              href={`/sheet-detail/${item.sheet_id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              <i className="ri-file-music-line"></i>
                              상세보기
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {statusMeta.description && (
                    <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      {statusMeta.description}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
          </div>
        </div>

        {/* 장바구니 버튼 */}
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3 shadow-lg hover:bg-blue-700"
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
    </div>
  );
};

export default MyOrdersPage;
