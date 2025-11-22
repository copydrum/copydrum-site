import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';

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
  const { t } = useTranslation();

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname);

  const formatCurrency = useCallback(
    (value: number) => {
      const converted = convertFromKrw(value, currency);
      return formatCurrencyUtil(converted, currency);
    },
    [currency],
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
          setError(t('eventSale.detail.notFound'));
        }
        setEvent(data);
      } catch (err) {
        console.error(t('eventSale.detail.loadError'), err);
        setError(t('eventSale.detail.loadErrorMessage'));
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
        console.error(t('eventSale.detail.purchase.favoriteLoadError'), err);
      }
    };

    loadFavoriteState();
  }, [user, event?.sheet_id]);

  const isActive = useMemo(() => (event ? isEventActive(event, now) : false), [event, now]);

  const remainingLabel = useMemo(() => {
    if (!event) return '';
    if (!isActive) {
      if (event.status === 'scheduled') {
        const start = new Date(event.event_start).toLocaleString();
        return t('eventSale.detail.eventInfo.startsAt', { date: start });
      }
      return t('eventSale.detail.eventInfo.ended');
    }
    const remaining = getRemainingTime(event, now);
    const dayLabel = remaining.days > 0 ? `${remaining.days}${t('eventSale.countdown.dayUnit')} ` : '';
    return `${t('eventSale.countdown.timeLeft')} ${dayLabel}${formatRemainingTime(remaining)}`;
  }, [event, isActive, now, t]);

  const handlePurchase = async () => {
    if (!event) return;
    if (!user) {
      if (window.confirm(t('eventSale.detail.purchase.loginRequired'))) {
        navigate('/login');
      }
      return;
    }

    if (!isActive) {
      alert(t('eventSale.detail.purchase.eventEnded'));
      return;
    }

    if (!event.sheet_id) {
      alert(t('eventSale.detail.purchase.sheetNotFound'));
      return;
    }

    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, event.sheet_id);
      if (alreadyPurchased) {
        alert(t('eventSale.detail.purchase.alreadyPurchased'));
        return;
      }
    } catch (error) {
      console.error(t('eventSale.detail.purchase.purchaseHistoryError'), error);
      alert(t('eventSale.detail.purchase.purchaseHistoryErrorMessage'));
      return;
    }

    setProcessing(true);
    try {
      const price = Math.max(0, event.discount_price ?? 0);

      const purchaseResult = await processCashPurchase({
        userId: user.id,
        totalPrice: price,
        description: t('eventSale.detail.purchase.purchaseDescription', {
          title: event.title ?? t('eventSale.detail.purchase.eventSheet'),
        }),
        items: [
          {
            sheetId: event.sheet_id,
            sheetTitle: event.title ?? t('eventSale.detail.purchase.eventSheet'),
            price,
          },
        ],
        sheetIdForTransaction: event.sheet_id,
      });

      if (!purchaseResult.success) {
        if (purchaseResult.reason === 'INSUFFICIENT_CREDIT') {
          alert(
            t('eventSale.detail.purchase.insufficientCredits', {
              balance: formatCurrency(purchaseResult.currentCredits),
            }),
          );
        }
        return;
      }

      const result = await purchaseEventDiscount(event);
      const message = result?.message ?? t('eventSale.detail.purchase.purchaseComplete');
      alert(message);
    } catch (err: any) {
      alert(err?.message || t('eventSale.detail.purchase.paymentError'));
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!event?.sheet_id) {
      return;
    }

    if (!user) {
      alert(t('eventSale.messages.loginRequired'));
      return;
    }

    setFavoriteProcessing(true);
    try {
      const favorite = await toggleFavorite(event.sheet_id, user.id);
      setIsFavoriteSheet(favorite);
    } catch (err) {
      console.error(t('eventSale.console.toggleFavoriteError'), err);
      alert(t('eventSale.detail.purchase.favoriteError'));
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
          <p className="mt-4 font-medium">{t('eventSale.detail.loading')}</p>
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
          <p className="text-lg font-semibold text-gray-700">{error || t('eventSale.detail.eventNotFound')}</p>
          <button
            onClick={() => navigate('/event-sale')}
            className="mt-6 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-600"
          >
            {t('eventSale.detail.backToList')}
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
                alt={event.title || t('eventSale.detail.eventSheet')}
                className="h-48 w-48 object-cover md:h-72 md:w-72"
              />
            </div>
            <div className="flex-1 space-y-4">
              <span className="inline-flex items-center gap-3 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">
                <span className="text-xl">🔥</span>
                {t('eventSale.detail.badge')}
              </span>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">{event.title}</h1>
              <p className="text-base font-medium text-white/90 md:text-lg">{event.artist}</p>
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <span className="text-sm text-white/80 line-through">
                  {t('eventSale.detail.originalPrice')} {formatCurrency(event.original_price)}
                </span>
                <span className="rounded-full bg-white px-4 py-1 text-2xl font-extrabold text-red-500 shadow-lg md:text-3xl">
                  {formatCurrency(event.discount_price ?? 0)}
                </span>
                {event.discount_percent !== null && (
                  <span className="rounded-full bg-red-500/20 px-4 py-1 text-sm font-semibold text-white">
                    {t('eventSale.detail.discountPercent', { percent: event.discount_percent })}
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
                    <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
                      {t('eventSale.detail.eventInfo.title')}
                    </h2>
                    <p className="text-sm text-gray-500">{t('eventSale.detail.eventInfo.description')}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-4 py-1 text-sm font-semibold ${isActive ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                      }`}
                  >
                    {isActive
                      ? t('eventSale.detail.eventInfo.status.active')
                      : event.status === 'scheduled'
                        ? t('eventSale.detail.eventInfo.status.scheduled')
                        : t('eventSale.detail.eventInfo.status.ended')}
                  </span>
                </div>

                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t('eventSale.detail.eventInfo.period')}
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {new Date(event.event_start).toLocaleString()} ~ {new Date(event.event_end).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t('eventSale.detail.eventInfo.timeLeft')}
                    </p>
                    <p className={`text-lg font-bold ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                      {remainingLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
                <h3 className="text-lg font-semibold text-gray-900">{t('eventSale.detail.features.title')}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line mt-1 text-green-500" />
                    {t('eventSale.detail.features.instantDownload')}
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line mt-1 text-green-500" />
                    {t('eventSale.detail.features.redownload')}
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line mt-1 text-green-500" />
                    {t('eventSale.detail.features.priceChange')}
                  </li>
                </ul>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-orange-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
                <h3 className="text-lg font-semibold text-gray-900">{t('eventSale.detail.payment.title')}</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      disabled={favoriteProcessing}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${isFavoriteSheet
                        ? 'border-red-200 bg-red-50 text-red-500'
                        : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                        } ${favoriteProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                      aria-label={isFavoriteSheet ? t('eventSale.detail.payment.unfavorite') : t('eventSale.detail.payment.favorite')}
                    >
                      <i className={`ri-heart-${isFavoriteSheet ? 'fill' : 'line'} text-xl`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('eventSale.detail.payment.originalPrice')}</span>
                    <span className="text-sm text-gray-400 line-through">{formatCurrency(event.original_price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{t('eventSale.detail.payment.eventPrice')}</span>
                    <span className="text-2xl font-extrabold text-red-500">{formatCurrency(event.discount_price ?? 0)}</span>
                  </div>
                  <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-600">
                    {t('eventSale.detail.payment.note')}
                  </p>
                  <button
                    onClick={handlePurchase}
                    disabled={!isActive || processing}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${!isActive || processing
                      ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                      : 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                      }`}
                  >
                    {processing
                      ? t('eventSale.detail.payment.processing')
                      : isActive
                        ? t('eventSale.detail.payment.buyNow')
                        : t('eventSale.detail.payment.eventEnded')}
                  </button>
                  <button
                    onClick={() => navigate('/event-sale')}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    {t('eventSale.detail.payment.viewOtherEvents')}
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

