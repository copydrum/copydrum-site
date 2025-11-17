import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import UserSidebar from '../../components/feature/UserSidebar';
import MainHeader from '../../components/common/MainHeader';
import type { EventDiscountSheet } from '../../lib/eventDiscounts';
import {
  fetchEventDiscountList,
  formatRemainingTime,
  getRemainingTime,
  isEventActive,
  purchaseEventDiscount,
} from '../../lib/eventDiscounts';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

const getStartCountdownLabel = (event: EventDiscountSheet, now: Date) => {
  const start = new Date(event.event_start).getTime();
  const diff = start - now.getTime();
  if (diff <= 0) return '곧 시작됩니다';
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `시작까지 ${days > 0 ? `${days}일 ` : ''}${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

const EventSalePage = () => {
  const [events, setEvents] = useState<EventDiscountSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const { i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ 
      amountKRW: value, 
      language: i18n.language,
      host: typeof window !== 'undefined' ? window.location.host : undefined
    }).formatted,
    [i18n.language],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const data = await fetchEventDiscountList();
        setEvents(data);
      } catch (error) {
        console.error('이벤트 할인 악보 목록 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setFavoriteLoadingIds(new Set());
      return;
    }

    try {
      const favorites = await fetchUserFavorites(user.id);
      setFavoriteIds(new Set(favorites.map((favorite) => favorite.sheet_id)));
      setFavoriteLoadingIds(new Set());
    } catch (error) {
      console.error('찜 목록 로드 오류:', error);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const activeEvents = useMemo(
    () =>
      events
        .filter((event) => isEventActive(event, now))
        .sort((a, b) => new Date(a.event_end).getTime() - new Date(b.event_end).getTime()),
    [events, now]
  );

  const scheduledEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === 'scheduled')
        .sort((a, b) => new Date(a.event_start).getTime() - new Date(b.event_start).getTime()),
    [events]
  );

  const endedEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === 'ended' || !event.is_active)
        .sort((a, b) => new Date(b.event_end).getTime() - new Date(a.event_end).getTime()),
    [events]
  );

  const handlePurchase = async (event: EventDiscountSheet) => {
    if (!user) {
      if (window.confirm('로그인이 필요합니다. 로그인 페이지로 이동할까요?')) {
        navigate('/login');
      }
      return;
    }

    setProcessingId(event.id);
    try {
      const result = await purchaseEventDiscount(event);
      alert(`${result.message}\n다운로드 페이지에서 악보를 확인하세요.`);
    } catch (error: any) {
      alert(error?.message || '결제 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const renderTimerLabel = (event: EventDiscountSheet) => {
    if (isEventActive(event, now)) {
      const remaining = getRemainingTime(event, now);
      if (remaining.totalMilliseconds <= 0) {
        return '판매 종료';
      }
      const dayLabel = remaining.days > 0 ? `${remaining.days}일 ` : '';
      return `⏰ 남은 시간 ${dayLabel}${formatRemainingTime(remaining)}`;
    }

    if (event.status === 'scheduled') {
      return getStartCountdownLabel(event, now);
    }

    return '판매 종료';
  };

  const handleToggleFavorite = async (sheetId?: string) => {
    if (!sheetId) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const wasFavorite = favoriteIds.has(sheetId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) {
        next.delete(sheetId);
      } else {
        next.add(sheetId);
      }
      return next;
    });

    setFavoriteLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(sheetId);
      return next;
    });

    try {
      const isNowFavorite = await toggleFavorite(sheetId, user.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isNowFavorite) {
          next.add(sheetId);
        } else {
          next.delete(sheetId);
        }
        return next;
      });
    } catch (error) {
      console.error('찜하기 처리 오류:', error);
      alert('찜하기 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) {
          next.add(sheetId);
        } else {
          next.delete(sheetId);
        }
        return next;
      });
    } finally {
      setFavoriteLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(sheetId);
        return next;
      });
    }
  };

  const renderEventCard = (event: EventDiscountSheet) => {
    const isActive = isEventActive(event, now);
    const timerLabel = renderTimerLabel(event);
    const sheetId = event.sheet_id;
    const isFavorite = sheetId ? favoriteIds.has(sheetId) : false;
    const isFavoriteLoading = sheetId ? favoriteLoadingIds.has(sheetId) : false;

    return (
      <article
        key={event.id}
        onClick={() => navigate(`/event-sale/${event.id}`)}
        className="group flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
      >
        <div className="relative overflow-hidden">
          <img
            src={event.thumbnail_url || generateDefaultThumbnail(480, 480)}
            alt={event.title || '이벤트 악보'}
            className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white shadow-lg">
            <span>🔥</span>
            100원 한정!
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(sheetId);
            }}
            disabled={isFavoriteLoading}
            className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
              isFavorite
                ? 'border-red-200 bg-red-50/90 text-red-500'
                : 'border-white/60 bg-black/30 text-white hover:border-red-200 hover:text-red-500 hover:bg-red-50/80'
            } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            aria-label={isFavorite ? '찜 해제' : '찜하기'}
          >
            <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-xl`} />
          </button>
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-800">
                판매 종료
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 px-6 py-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
            <p className="text-sm font-medium text-gray-500">{event.artist}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 line-through">{formatCurrency(event.original_price)}</span>
              <span className="text-3xl font-black text-red-500">100원</span>
            </div>
            {event.discount_percent !== null && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                {event.discount_percent}% 할인
              </span>
            )}
            <p
              className={`text-sm font-semibold ${
                isActive ? 'text-orange-600' : 'text-gray-400'
              }`}
            >
              {timerLabel}
            </p>
          </div>

          <div className="mt-auto flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/event-sale/${event.id}`);
              }}
              className="flex-1 rounded-xl border border-orange-200 px-4 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
            >
              상세 보기
            </button>
            <button
              disabled={!isActive || processingId === event.id}
              onClick={(e) => {
                e.stopPropagation();
                handlePurchase(event);
              }}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                !isActive || processingId === event.id
                  ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                  : 'bg-red-500 text-white shadow-lg hover:bg-red-600'
              }`}
            >
              {processingId === event.id ? '결제 중...' : isActive ? '즉시 구매하기' : '판매 종료'}
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <UserSidebar user={user} />

      <div className="md:mr-64">
        <div className="min-h-[calc(100vh-156px)] bg-gradient-to-b from-orange-100/60 via-white to-white pb-10 md:pb-12">
          <header className="relative overflow-hidden bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 py-14 text-white sm:py-16 md:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_rgba(255,59,48,0))]" />
            <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center">
              <span className="inline-flex items-center gap-3 rounded-full bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur">
                <span className="text-xl">🔥</span>
                단 100원으로 인기 드럼 악보 소장!
              </span>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
                100원 특가 악보 EVENT
              </h1>
              <p className="max-w-3xl text-base font-medium text-white/90 sm:text-lg md:text-xl">
                한정 기간 동안만 제공되는 초특가 드럼 악보를 놓치지 마세요. 인기 곡을 100원에 소장하고, 오늘 바로 연주에 도전해보세요.
              </p>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <section className="mb-12 text-center md:mb-16">
          <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-base font-semibold text-orange-600 shadow-lg sm:px-6 sm:py-3 sm:text-lg">
            <span className="text-xl sm:text-2xl">⏰</span> 실시간으로 갱신되는 타이머를 확인하세요!
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-gray-500 md:py-32">
            <i className="ri-loader-4-line w-10 h-10 animate-spin text-red-500" />
            <p className="mt-3 font-medium">이벤트 정보를 불러오는 중입니다...</p>
          </div>
        ) : (
          <>
            <section className="space-y-8">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">진행 중인 100원 특가</h2>
                  <p className="text-sm text-gray-500">현재 바로 구매 가능한 이벤트 악보입니다.</p>
                </div>
                <span className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-500">
                  총 {activeEvents.length}건 진행 중
                </span>
              </div>

              {activeEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-orange-300 bg-white/60 px-6 py-12 text-center text-gray-500 md:px-8 md:py-16">
                  현재 진행 중인 이벤트가 없습니다. 아래 예정된 이벤트를 확인해보세요!
                </div>
              ) : (
                <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {activeEvents.map(renderEventCard)}
                </div>
              )}
            </section>

            {scheduledEvents.length > 0 && (
              <section className="mt-16 space-y-8 md:mt-20">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">예정된 이벤트</h2>
                    <p className="text-sm text-gray-500">곧 시작될 이벤트를 미리 확인하고 알림을 준비하세요.</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-500">
                    예정 {scheduledEvents.length}건
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2 md:gap-8">
                  {scheduledEvents.map((event) => (
                    <article
                      key={event.id}
                      onClick={() => navigate(`/event-sale/${event.id}`)}
                      className="group flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <div className="relative overflow-hidden">
                        <img
                          src={event.thumbnail_url || generateDefaultThumbnail(480, 480)}
                          alt={event.title || '이벤트 악보'}
                          className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1 text-sm font-semibold text-white shadow-lg">
                          <span>⏳</span>
                          곧 시작
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 px-6 py-6">
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                          <p className="text-sm font-medium text-gray-500">{event.artist}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                            {getStartCountdownLabel(event, now)}
                          </p>
                          <p className="text-xs text-gray-500">
                            시작 {new Date(event.event_start).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <div className="mt-auto flex gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/event-sale/${event.id}`);
                            }}
                            className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                          >
                            상세 보기
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {endedEvents.length > 0 && (
              <section className="mt-16 space-y-6 md:mt-20">
                <h2 className="text-lg font-semibold text-gray-800 md:text-xl">종료된 이벤트</h2>
                <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                  {endedEvents.slice(0, 4).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-500"
                    >
                      <img
                        src={event.thumbnail_url || generateDefaultThumbnail(120, 120)}
                        alt={event.title || '이벤트 악보'}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-semibold text-gray-700">{event.title}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(event.event_start).toLocaleDateString()} ~{' '}
                          {new Date(event.event_end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default EventSalePage;

