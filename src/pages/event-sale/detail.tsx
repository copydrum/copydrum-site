import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import type { EventDiscountSheet } from '../../lib/eventDiscounts';
import {
  fetchEventDiscountById,
  formatRemainingTime,
  getRemainingTime,
  isEventActive,
  purchaseEventDiscount,
} from '../../lib/eventDiscounts';
import { isFavorite, toggleFavorite } from '../../lib/favorites';
import { processCashPurchase } from '../../lib/cashPurchases';
import MainHeader from '../../components/common/MainHeader';
import UserSidebar from '../../components/feature/UserSidebar';
import { hasPurchasedSheet } from '../../lib/purchaseCheck';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

const EventSaleDetailPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDiscountSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [processing, setProcessing] = useState(false);
  const [isFavoriteSheet, setIsFavoriteSheet] = useState(false);
  const [favoriteProcessing, setFavoriteProcessing] = useState(false);
  const { user } = useAuthStore();
  const { i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ 
      amountKRW: value, 
      language: i18n.language,
      host: typeof window !== 'undefined' ? window.location.host : undefined
    }).formatted,
    [i18n.language],
  );
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!eventId) return;

    const loadEvent = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEventDiscountById(eventId);
        if (!data) {
          setError('요청하신 이벤트를 찾을 수 없습니다.');
        }
        setEvent(data);
      } catch (err) {
        console.error('이벤트 할인 악보 상세 조회 오류:', err);
        setError('이벤트 정보를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  useEffect(() => {
    const loadFavoriteState = async () => {
      if (!user || !event?.sheet_id) {
        setIsFavoriteSheet(false);
        return;
      }

      try {
        const favorite = await isFavorite(event.sheet_id, user.id);
        setIsFavoriteSheet(favorite);
      } catch (err) {
        console.error('찜 상태 로드 오류:', err);
      }
    };

    loadFavoriteState();
  }, [user, event?.sheet_id]);

  const isActive = useMemo(() => (event ? isEventActive(event, now) : false), [event, now]);

  const remainingLabel = useMemo(() => {
    if (!event) return '';
    if (!isActive) {
      if (event.status === 'scheduled') {
        const start = new Date(event.event_start).toLocaleString('ko-KR');
        return `이벤트 시작 예정: ${start}`;
      }
      return '이벤트가 종료되었습니다.';
    }
    const remaining = getRemainingTime(event, now);
    const dayLabel = remaining.days > 0 ? `${remaining.days}일 ` : '';
    return `남은 시간 ${dayLabel}${formatRemainingTime(remaining)}`;
  }, [event, isActive, now]);

  const handlePurchase = async () => {
    if (!event) return;
    if (!user) {
      if (window.confirm('로그인이 필요합니다. 로그인 페이지로 이동할까요?')) {
        navigate('/login');
      }
      return;
    }

    if (!isActive) {
      alert('이벤트가 종료되었거나 비활성화되었습니다.');
      return;
    }

    if (!event.sheet_id) {
      alert('구매할 악보 정보를 확인할 수 없습니다.');
      return;
    }

    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, event.sheet_id);
      if (alreadyPurchased) {
        alert('이미 구매하신 악보입니다.\n마이페이지에서 다운로드해 주세요.');
        return;
      }
    } catch (error) {
      console.error('이벤트 악보 구매 이력 확인 오류:', error);
      alert('구매 이력 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setProcessing(true);
    try {
      const price = Math.max(0, event.discount_price ?? 0);

      const purchaseResult = await processCashPurchase({
        userId: user.id,
        totalPrice: price,
        description: `이벤트 악보 구매: ${event.title ?? '이벤트 악보'}`,
        items: [{ sheetId: event.sheet_id, sheetTitle: event.title ?? '이벤트 악보', price }],
        sheetIdForTransaction: event.sheet_id,
      });

      if (!purchaseResult.success) {
        if (purchaseResult.reason === 'INSUFFICIENT_CREDIT') {
          alert(
            `보유 캐쉬가 부족합니다.\n현재 잔액: ${purchaseResult.currentCredits.toLocaleString('ko-KR')}P\n캐쉬를 충전한 뒤 다시 시도해주세요.`,
          );
        }
        return;
      }

      const result = await purchaseEventDiscount(event);
      const message = result?.message ?? '구매가 완료되었습니다.';
      alert(`${message}\n마이페이지에서 악보를 확인하세요.`);
    } catch (err: any) {
      alert(err?.message || '결제 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!event?.sheet_id) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setFavoriteProcessing(true);
    try {
      const favorite = await toggleFavorite(event.sheet_id, user.id);
      setIsFavoriteSheet(favorite);
    } catch (err) {
      console.error('찜하기 처리 오류:', err);
      alert('찜하기 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setFavoriteProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <MainHeader user={user} />
        <UserSidebar user={user} />
        <div className="min-h-[calc(100vh-156px)] bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center text-gray-600 md:mr-64">
          <i className="ri-loader-4-line w-10 h-10 animate-spin text-red-500" />
          <p className="mt-4 font-medium">이벤트 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-white">
        <MainHeader user={user} />
        <UserSidebar user={user} />
        <div className="min-h-[calc(100vh-156px)] bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center text-gray-600 md:mr-64">
          <p className="text-lg font-semibold text-gray-700">{error || '이벤트 정보를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate('/event-sale')}
            className="mt-6 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-600"
          >
            이벤트 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <UserSidebar user={user} />
      <div className="md:mr-64">
      <header className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:py-16">
          <div className="flex-shrink-0 overflow-hidden rounded-3xl border-4 border-white/40 shadow-2xl">
            <img
              src={event.thumbnail_url || generateDefaultThumbnail(600, 600)}
              alt={event.title || '이벤트 악보'}
              className="h-48 w-48 object-cover md:h-72 md:w-72"
            />
          </div>
          <div className="flex-1 space-y-4">
            <span className="inline-flex items-center gap-3 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">
              <span className="text-xl">🔥</span>
              100원 특가 이벤트 악보
            </span>
            <h1 className="text-3xl font-black leading-tight md:text-5xl">{event.title}</h1>
            <p className="text-base font-medium text-white/90 md:text-lg">{event.artist}</p>
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <span className="text-sm text-white/80 line-through">
                정가 {formatCurrency(event.original_price)}
              </span>
              <span className="rounded-full bg-white px-4 py-1 text-2xl font-extrabold text-red-500 shadow-lg md:text-3xl">
                100원
              </span>
              {event.discount_percent !== null && (
                <span className="rounded-full bg-red-500/20 px-4 py-1 text-sm font-semibold text-white">
                  {event.discount_percent}% 할인
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-[2fr,1fr] md:gap-10">
          <section className="space-y-6 md:space-y-8">
            <div className="rounded-3xl border border-orange-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 md:text-xl">이벤트 안내</h2>
                  <p className="text-sm text-gray-500">이벤트 기간 동안 100원에 해당 악보를 소장할 수 있습니다.</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-4 py-1 text-sm font-semibold ${
                    isActive ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isActive ? '진행 중' : event.status === 'scheduled' ? '예정' : '종료'}
                </span>
              </div>

              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">이벤트 기간</p>
                  <p className="text-sm font-medium text-gray-700">
                    {new Date(event.event_start).toLocaleString('ko-KR')} ~{' '}
                    {new Date(event.event_end).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">남은 시간</p>
                  <p className={`text-lg font-bold ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                    {remainingLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
              <h3 className="text-lg font-semibold text-gray-900">이 악보의 특징</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line mt-1 text-green-500" />
                  이벤트 기간 내 100원에 즉시 다운로드 가능
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line mt-1 text-green-500" />
                  결제 완료 후 마이페이지 &gt; 구매내역에서 재다운로드 지원
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line mt-1 text-green-500" />
                  이벤트 종료 후에는 정상가로 전환될 수 있습니다.
                </li>
              </ul>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-orange-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
              <h3 className="text-lg font-semibold text-gray-900">결제 정보</h3>
              <div className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    disabled={favoriteProcessing}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                      isFavoriteSheet
                        ? 'border-red-200 bg-red-50 text-red-500'
                        : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                    } ${favoriteProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-label={isFavoriteSheet ? '찜 해제' : '찜하기'}
                  >
                    <i className={`ri-heart-${isFavoriteSheet ? 'fill' : 'line'} text-xl`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">정가</span>
                  <span className="text-sm text-gray-400 line-through">{formatCurrency(event.original_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">이벤트가</span>
                  <span className="text-2xl font-extrabold text-red-500">{formatCurrency(event.discount_price)}</span>
                </div>
                <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-600">
                  이벤트 기간 중에는 다른 쿠폰이나 포인트 적용이 제한될 수 있습니다.
                </p>
                <button
                  onClick={handlePurchase}
                  disabled={!isActive || processing}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    !isActive || processing
                      ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                      : 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                  }`}
                >
                  {processing ? '결제 중...' : isActive ? '100원에 즉시 구매하기' : '이벤트 종료'}
                </button>
                <button
                  onClick={() => navigate('/event-sale')}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  다른 이벤트 보기
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      </div>
    </div>
  );
};

export default EventSaleDetailPage;

