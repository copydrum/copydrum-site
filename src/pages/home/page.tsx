
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import UserSidebar from '../../components/feature/UserSidebar';
import { useNavigate } from 'react-router-dom';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import {
  buildEventDiscountMap,
  fetchEventDiscountList,
  fetchActiveEventDiscounts,
  formatRemainingTime,
  getRemainingTime,
  isEventActive,
} from '../../lib/eventDiscounts';
import type { EventDiscountMap, EventDiscountSheet } from '../../lib/eventDiscounts';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';
import { getActiveCurrency } from '../../lib/payments/getActiveCurrency';
import { convertPriceForLocale } from '../../lib/pricing/convertForLocale';
import { formatCurrency as formatCurrencyUi } from '../../lib/pricing/formatCurrency';

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  price: number;
  thumbnail_url?: string;
  youtube_url?: string;
  is_featured?: boolean;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  created_at: string;
  sheet_count?: number;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestSheets, setLatestSheets] = useState<DrumSheet[]>([]);
  const [popularSheets, setPopularSheets] = useState<DrumSheet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const navigate = useNavigate();
  const [eventDiscounts, setEventDiscounts] = useState<EventDiscountMap>({});
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [activeEvents, setActiveEvents] = useState<EventDiscountSheet[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventCarouselIndex, setEventCarouselIndex] = useState(0);
  const [slidesPerView, setSlidesPerView] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const { i18n, t } = useTranslation();

  const loadLatestSheets = useCallback(async () => {
    try {
      const query = supabase
        .from('drum_sheets')
        .select('id, title, artist, price, thumbnail_url, youtube_url, category_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12);

      const { data, error } = await query;

      if (error) throw error;
      setLatestSheets(data || []);
    } catch (error) {
      console.error(t('home.console.latestSheetsLoadError'), error);
    }
  }, [t]);

  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name');

      if (error) throw error;
      
      // Genre order matching category page
      const genreOrder = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버'];
      
      // Filter out drum lesson category
      const filteredCategories = (data || []).filter(cat => cat.name !== '드럼레슨');
      
      // Sort by genre order
      const sortedCategories = filteredCategories.sort((a, b) => {
        const indexA = genreOrder.indexOf(a.name);
        const indexB = genreOrder.indexOf(b.name);
        
        // Move items not in order to the end
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });
      
      setCategories(sortedCategories);
    } catch (error) {
      console.error(t('home.console.categoryLoadError'), error);
    }
  }, [t]);

  const loadEventDiscounts = useCallback(async () => {
    try {
      const data = await fetchEventDiscountList();
      setEventDiscounts(buildEventDiscountMap(data));
    } catch (error) {
      console.error(t('home.console.eventDiscountLoadError'), error);
    }
  }, [t]);

  const loadCollections = useCallback(async () => {
    try {
      setCollectionsLoading(true);
      const { data, error } = await supabase
        .from('collections')
        .select(
          'id, title, description, thumbnail_url, original_price, sale_price, discount_percentage, created_at, is_active'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      const rawCollections = data || [];
      const collectionsWithCount = await Promise.all(
        rawCollections.map(async (collection: any) => {
          const { count, error: countError } = await supabase
            .from('collection_sheets')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          if (countError) {
            console.error(t('home.console.collectionSheetCountError'), countError);
          }

          const { is_active: _isActive, ...rest } = collection;

          return {
            ...rest,
            sheet_count: count || 0,
          } as Collection;
        })
      );

      setCollections(collectionsWithCount);
    } catch (error) {
      console.error(t('home.console.collectionLoadError'), error);
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, [t]);

  const loadActiveEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const data = await fetchActiveEventDiscounts();
      const nowDate = new Date();
      const sortedActiveEvents = (data || [])
        .filter((event) => isEventActive(event, nowDate))
        .sort((a, b) => new Date(a.event_end).getTime() - new Date(b.event_end).getTime())
        .slice(0, 4);

      setActiveEvents(sortedActiveEvents);
      setEventCarouselIndex(0);
    } catch (error) {
      console.error(t('home.console.activeEventLoadError'), error);
      setActiveEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [t]);

  const loadPopularSheets = useCallback(async () => {
    try {
      let query = supabase
        .from('drum_sheets')
        .select('id, title, artist, price, thumbnail_url, youtube_url, is_featured, category_id')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      // 선택된 장르가 있으면 필터링
      if (selectedGenre) {
        query = query.eq('category_id', selectedGenre);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPopularSheets(data || []);
    } catch (error) {
      console.error(t('home.console.popularSheetsLoadError'), error);
    }
  }, [selectedGenre, t]);

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
      console.error(t('home.console.favoritesLoadError'), error);
    }
  }, [user, t]);

  useEffect(() => {
    let isMounted = true;

    const initializeUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        setUser(currentUser ?? null);
        setLoading(false);
      } catch (error) {
        console.error(t('home.console.userInfoLoadError'), error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [t]);

  useEffect(() => {
    loadLatestSheets();
  }, [loadLatestSheets]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadEventDiscounts();
  }, [loadEventDiscounts]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    loadActiveEvents();
  }, [loadActiveEvents]);

  useEffect(() => {
    // Reload popular sheets when selected genre changes
    loadPopularSheets();
  }, [loadPopularSheets]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateSlidesPerView = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const width = window.innerWidth;

      if (width >= 1536) {
        setSlidesPerView(4);
      } else if (width >= 1024) {
        setSlidesPerView(3);
      } else if (width >= 768) {
        setSlidesPerView(2);
      } else {
        setSlidesPerView(1);
      }
    };

    updateSlidesPerView();
    window.addEventListener('resize', updateSlidesPerView);

    return () => window.removeEventListener('resize', updateSlidesPerView);
  }, []);

  useEffect(() => {
    if (!activeEvents.length) {
      setEventCarouselIndex(0);
      return;
    }

    const maxIndex = Math.max(activeEvents.length - slidesPerView, 0);

    setEventCarouselIndex((prev) => (prev > maxIndex ? 0 : prev));

    if (maxIndex === 0 || slidesPerView <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setEventCarouselIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3000);

    return () => clearInterval(interval);
  }, [activeEvents, slidesPerView]);

  const getThumbnailUrl = (sheet: DrumSheet): string => {
    if (sheet.youtube_url) {
      const videoId = extractVideoId(sheet.youtube_url);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    if (sheet.thumbnail_url) {
      return sheet.thumbnail_url;
    }
    // 이미지가 없을 경우 기본 썸네일 생성
    return generateDefaultThumbnail(400, 400);
  };

  const extractVideoId = (url: string): string => {
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
  };

  // 100-yen event section: Currency formatting
  // For Japanese locale (ja), display prices as JPY (¥100)
  // For Korean locale (ko), keep KRW (₩100)
  // For other locales (en, etc.), use existing behavior
  const formatCurrency = useCallback(
    (value: number) => {
      const locale = i18n.language;
      
      // Japanese site: use JPY formatting
      if (locale === 'ja') {
        const currency = getActiveCurrency();
        const convertedPrice = convertPriceForLocale(value, locale, currency);
        return formatCurrencyUi(convertedPrice, 'JPY');
      }
      
      // Korean site: keep existing KRW behavior
      if (locale === 'ko') {
        return formatPrice({ 
          amountKRW: value, 
          language: locale,
          host: typeof window !== 'undefined' ? window.location.host : undefined
        }).formatted;
      }
      
      // Other locales (en, etc.): use existing behavior
      return formatPrice({ 
        amountKRW: value, 
        language: locale,
        host: typeof window !== 'undefined' ? window.location.host : undefined
      }).formatted;
    },
    [i18n.language],
  );
  const getEventForSheet = (sheetId: string) => eventDiscounts[sheetId];
  const getDisplayPrice = (sheet: DrumSheet) => {
    const event = getEventForSheet(sheet.id);
    return event ? event.discount_price : sheet.price;
  };
  const effectiveSlidesPerView = Math.min(slidesPerView, activeEvents.length || 1);
  const maxCarouselIndex = Math.max(activeEvents.length - effectiveSlidesPerView, 0);
  const carouselTranslate = (eventCarouselIndex * 100) / effectiveSlidesPerView;
  const eventCardBasis = `${100 / effectiveSlidesPerView}%`;
  const canSlide = maxCarouselIndex > 0;
  const totalCarouselDots = maxCarouselIndex + 1;
  const collectionsToDisplay = collections.slice(0, 3);

  const handlePrevEventSlide = () => {
    if (!canSlide) return;
    setEventCarouselIndex((prev) => (prev === 0 ? maxCarouselIndex : prev - 1));
  };

  const handleNextEventSlide = () => {
    if (!canSlide) return;
    setEventCarouselIndex((prev) => (prev >= maxCarouselIndex ? 0 : prev + 1));
  };

  const handleToggleFavorite = async (sheetId: string) => {
    if (!user) {
      alert(t('home.loginRequired'));
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
      console.error(t('home.console.favoriteToggleError'), error);
      alert(t('home.favoriteError'));
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


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('message.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <MainHeader user={user} />
      </div>

      {/* Desktop User Sidebar */}
      <div className="hidden lg:block">
        <UserSidebar user={user} />
      </div>

      {/* Hero Section - 전체 폭 */}
      <div className="lg:mr-64">
        <section 
          className="relative bg-cover bg-center bg-no-repeat h-[320px] sm:h-[380px] md:h-[480px] lg:h-[500px] bg-gray-900 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/banner1.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              {/* Mobile Version */}
              <div className="max-w-xl md:hidden text-center space-y-4">
                <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  {t('home.banner.title').split('\n').map((line, idx) => (
                    <span key={idx}>
                      {line}
                      {idx < t('home.banner.title').split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </h2>
                <div className="text-white text-base sm:text-lg leading-relaxed space-y-1">
                  <p>{t('home.banner.subtitle1')}</p>
                  <p>{t('home.banner.subtitle2')}</p>
                  <p>{t('home.banner.subtitle3')}</p>
                </div>
                <button 
                  onClick={() => window.location.href = '/categories'}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 sm:px-8 sm:py-3 rounded-full hover:from-blue-700 hover:to-purple-700 font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 shadow-lg"
                >
                  {t('home.banner.browseButton')}
                </button>
              </div>
              {/* PC Version */}
              <div className="hidden md:block max-w-2xl text-left space-y-6">
                <h2 className="text-5xl font-bold text-white leading-tight">
                  {t('home.banner.title').split('\n').map((line, idx) => (
                    <span key={idx}>
                      {line}
                      {idx < t('home.banner.title').split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </h2>
                <div className="text-white text-xl leading-relaxed space-y-1">
                  <p>{t('home.banner.subtitle1')}</p>
                  <p>{t('home.banner.subtitle2')}</p>
                  <p>{t('home.banner.subtitle3')}</p>
                </div>
                <button 
                  onClick={() => window.location.href = '/categories'}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full hover:from-blue-700 hover:to-purple-700 font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 shadow-lg"
                >
                  {t('home.banner.browseButton')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:mr-64">
        {/* Latest Sheets */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{t('home.latestSheets')}</h3>
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="text-sm font-semibold text-gray-500 hover:text-blue-600"
                >
                  {t('common.showMore')}
                </button>
              </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
                {latestSheets.map((sheet) => {
                  const eventInfo = getEventForSheet(sheet.id);
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                      className="relative flex w-48 flex-shrink-0 cursor-pointer flex-col"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <img
                          src={getThumbnailUrl(sheet)}
                          alt={sheet.title}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = generateDefaultThumbnail(400, 400);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                        {eventInfo && (
                          <div className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                            {t('home.eventSale')}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                            isFavorite
                              ? 'border-red-200 bg-red-50/90 text-red-500'
                              : 'border-white/60 bg-black/30 text-white hover:border-red-200 hover:text-red-500 hover:bg-red-50/80'
                          } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 text-center text-white">
                          <h4 className="text-base font-bold line-clamp-2">{sheet.title}</h4>
                          <p className="text-xs text-white/80 line-clamp-1">{sheet.artist}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden md:block">
              <h3 className="mb-8 text-center text-3xl font-bold text-gray-900">{t('home.latestSheets')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {latestSheets.map((sheet) => {
                  const eventInfo = getEventForSheet(sheet.id);
                  const displayPrice = getDisplayPrice(sheet);
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                      className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg"
                    >
                      <img
                        src={getThumbnailUrl(sheet)}
                        alt={sheet.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = generateDefaultThumbnail(400, 400);
                        }}
                      />
                      {eventInfo && (
                        <div className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                          {t('home.eventSale')}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleFavorite(sheet.id);
                        }}
                        disabled={isFavoriteLoading}
                        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                          isFavorite
                            ? 'border-red-200 bg-red-50/90 text-red-500'
                            : 'border-white/60 bg-black/30 text-white hover:border-red-200 hover:text-red-500 hover:bg-red-50/80'
                        } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                      >
                        <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-3 text-center">
                        <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{sheet.title}</h4>
                        <p className="text-white text-xs line-clamp-1">{sheet.artist}</p>
                        {eventInfo && (
                          <p className="mt-1 text-xs font-semibold text-red-300">
                            {formatCurrency(displayPrice)} ({t('home.originalPrice')} {formatCurrency(sheet.price)})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Event Sale Carousel */}
        <section className="py-12 md:py-16 bg-gradient-to-r from-orange-50 via-white to-orange-100 rounded-3xl md:rounded-none -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
                <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">{t('home.eventSaleTitle')}</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900 leading-snug">
                      {t('home.eventSaleSubtitle').split('\n').map((line, idx) => (
                        <span key={idx}>
                          {line}
                          {idx < t('home.eventSaleSubtitle').split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {t('home.eventSaleDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/event-sale')}
                  className="inline-flex w-full items-center justify-center rounded-full border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-500 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                >
                  {t('home.viewAllEvents')}
                  <i className="ri-arrow-right-line ml-2 text-base" />
                </button>
              </div>

              {eventsLoading ? (
                <div className="py-12 text-center text-gray-500">
                  <i className="ri-loader-4-line mx-auto mb-2 block h-10 w-10 animate-spin text-orange-500" />
                  <p className="text-sm font-medium">{t('home.loadingEvents')}</p>
                </div>
              ) : activeEvents.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-orange-300 bg-white/70 px-6 py-10 text-center text-gray-600">
                  <i className="ri-music-2-line mb-4 text-4xl text-orange-300" />
                  <p className="text-base font-semibold">{t('home.noActiveEvents')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('home.noActiveEventsSub')}</p>
                </div>
              ) : (
                <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
                  {activeEvents.map((event) => {
                    const remaining = getRemainingTime(event, now);
                    const isActiveNow = isEventActive(event, now);
                    return (
                      <article
                        key={event.id}
                        onClick={() => navigate(`/event-sale/${event.id}`)}
                        className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-orange-100"
                      >
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={event.thumbnail_url || generateDefaultThumbnail(480, 480)}
                            alt={event.title || t('home.eventSale')}
                            className="h-full w-full object-cover transition duration-500 hover:scale-105"
                          />
                          <div className="absolute left-4 top-4 rounded-full bg-red-500/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                            {t('home.eventSale')}
                          </div>
                          {!isActiveNow && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                              {t('home.saleEnded')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 px-5 py-5 text-center">
                          <div className="space-y-1">
                            <h4 className="text-lg font-bold text-gray-900">
                              {t('home.eventSaleSubtitle').split('\n').map((line, idx) => (
                                <span key={idx}>
                                  {line}
                                  {idx < t('home.eventSaleSubtitle').split('\n').length - 1 && <br />}
                                </span>
                              ))}
                            </h4>
                            <p className="text-sm font-medium text-gray-500">{event.artist}</p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-center gap-3">
                              <span className="text-sm text-gray-400 line-through">
                                {formatCurrency(event.original_price)}
                              </span>
                              <span className="text-xl font-extrabold text-red-500">
                                {formatCurrency(event.discount_price)}
                              </span>
                            </div>
                            {event.discount_percent !== null && (
                              <span className="mt-2 inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                                {t('home.discount', { percent: event.discount_percent })}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-xs font-semibold ${isActiveNow ? 'text-orange-600' : 'text-gray-400'}`}
                          >
                            {remaining.totalMilliseconds > 0
                              ? t('home.remainingTime', { 
                                  days: remaining.days > 0 ? t('home.remainingDays', { count: remaining.days }) : '',
                                  time: formatRemainingTime(remaining)
                                })
                              : t('home.saleEnded')}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden md:block">
              <div className="mb-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-500 uppercase tracking-wide">{t('home.eventSaleEvent')}</p>
                  <h3 className="mt-2 text-3xl font-bold text-gray-900">{t('home.eventSaleSubtitleFull')}</h3>
                  <p className="mt-3 text-gray-600">
                    {t('home.eventSaleDescriptionFull')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/event-sale')}
                  className="inline-flex items-center justify-center rounded-full border border-orange-200 bg-white px-6 py-3 text-sm font-semibold text-orange-500 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                >
                  {t('home.viewAllEvents')}
                  <i className="ri-arrow-right-line ml-2 text-base" />
                </button>
              </div>

              {eventsLoading ? (
                <div className="py-24 text-center text-gray-500">
                  <i className="ri-loader-4-line w-10 h-10 animate-spin text-orange-500 mx-auto mb-2" />
                  <p className="font-medium">{t('home.loadingEventsFull')}</p>
                </div>
              ) : activeEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-orange-300 bg-white/70 px-10 py-16 text-center text-gray-600">
                  <i className="ri-music-2-line text-5xl text-orange-300 mb-4" />
                  <p className="text-lg font-semibold">{t('home.noActiveEventsFull')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('home.noActiveEventsSubFull')}</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handlePrevEventSlide}
                      disabled={!canSlide}
                      className={`absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/80 p-3 shadow-lg transition hover:bg-white lg:block ${
                        canSlide ? 'text-orange-500 hover:text-orange-600' : 'text-gray-300 cursor-not-allowed'
                      }`}
                      aria-label={t('home.prevSlide')}
                    >
                      <i className="ri-arrow-left-s-line text-2xl" />
                    </button>
                    <div className="overflow-hidden">
                      <div
                        className="flex transition-transform duration-500 ease-out"
                        style={{ transform: `translateX(-${carouselTranslate}%)` }}
                      >
                        {activeEvents.map((event) => {
                          const remaining = getRemainingTime(event, now);
                          const isActiveNow = isEventActive(event, now);
                          return (
                            <div
                              key={event.id}
                              className="px-2 sm:px-3 lg:px-4"
                              style={{ flex: `0 0 ${eventCardBasis}` }}
                            >
                              <article
                                className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-orange-100 transition hover:-translate-y-1 hover:shadow-2xl"
                                onClick={() => navigate(`/event-sale/${event.id}`)}
                              >
                                <div className="relative h-56 overflow-hidden">
                                  <img
                                    src={event.thumbnail_url || generateDefaultThumbnail(480, 480)}
                                    alt={event.title || t('home.eventSale')}
                                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                                  />
                                  <div className="absolute left-4 top-4 rounded-full bg-red-500/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                                    {t('home.eventSale')}
                                  </div>
                                  {!isActiveNow && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                                      {t('home.saleEnded')}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col gap-4 px-6 py-6">
                                  <div className="space-y-1">
                                    <h4 className="text-xl font-bold text-gray-900 line-clamp-1">{event.title}</h4>
                                    <p className="text-sm font-medium text-gray-500 line-clamp-1">{event.artist}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-400 line-through">
                                        {formatCurrency(event.original_price)}
                                      </span>
                                      <span className="text-2xl font-extrabold text-red-500">
                                        {formatCurrency(event.discount_price)}
                                      </span>
                                    </div>
                                    {event.discount_percent !== null && (
                                      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                                        {t('home.discount', { percent: event.discount_percent })}
                                      </span>
                                    )}
                                    <p
                                      className={`text-sm font-semibold ${isActiveNow ? 'text-orange-600' : 'text-gray-400'}`}
                                    >
                                      {remaining.totalMilliseconds > 0
                                        ? t('home.remainingTime', { 
                                            days: remaining.days > 0 ? t('home.remainingDays', { count: remaining.days }) : '',
                                            time: formatRemainingTime(remaining)
                                          })
                                        : t('home.saleEnded')}
                                    </p>
                                  </div>
                                  <div className="mt-auto flex gap-3">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/event-sale/${event.id}`);
                                      }}
                                      className="flex-1 rounded-xl border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-500 transition hover:bg-orange-50 hover:text-orange-600"
                                    >
                                      {t('home.viewDetails')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/event-sale/${event.id}`);
                                      }}
                                      className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-600"
                                    >
                                      {t('home.buyNow')}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextEventSlide}
                      disabled={!canSlide}
                      className={`absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/80 p-3 shadow-lg transition hover:bg-white lg:block ${
                        canSlide ? 'text-orange-500 hover:text-orange-600' : 'text-gray-300 cursor-not-allowed'
                      }`}
                      aria-label={t('home.nextSlide')}
                    >
                      <i className="ri-arrow-right-s-line text-2xl" />
                    </button>
                  </div>
                  {totalCarouselDots > 1 && (
                    <div className="mt-8 flex justify-center gap-2">
                      {Array.from({ length: totalCarouselDots }).map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setEventCarouselIndex(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            eventCarouselIndex === index ? 'w-10 bg-orange-500' : 'w-2.5 bg-orange-200 hover:bg-orange-300'
                          }`}
                          aria-label={t('home.slideNumber', { number: index + 1 })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Popular Sheets */}
        <section className="py-12 md:py-16 bg-gray-50 rounded-3xl md:rounded-none -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{t('home.popularSheets')}</h3>
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="text-sm font-semibold text-gray-500 hover:text-blue-600"
                >
                  {t('home.viewAll')}
                </button>
              </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
                {popularSheets.slice(0, 10).map((sheet) => {
                  const eventInfo = getEventForSheet(sheet.id);
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                      className="relative flex w-48 flex-shrink-0 cursor-pointer flex-col"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <img
                          src={getThumbnailUrl(sheet)}
                          alt={sheet.title}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = generateDefaultThumbnail(400, 400);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        {eventInfo && (
                          <div className="absolute left-3 top-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                            {t('home.eventSale')}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border ${
                            isFavorite
                              ? 'border-red-200 bg-red-50 text-red-500'
                              : 'border-white/60 bg-black/30 text-white hover:border-red-200 hover:text-red-500 hover:bg-red-50/80'
                          } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-base`} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 text-center text-white">
                          <h4 className="text-base font-bold line-clamp-2">{sheet.title}</h4>
                          <p className="text-xs text-white/80 line-clamp-1">{sheet.artist}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden md:block">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-3xl font-bold text-gray-900">{t('home.popularSheets')}</h3>
                <a href="/categories" className="text-sm text-gray-500 hover:text-gray-700">
                  {t('home.showMore')} &gt;
                </a>
              </div>

              {/* Genre filter */}
              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGenre('')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    selectedGenre === ''
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t('home.all')}
                </button>
                {categories.map((category) => {
                  // Translate genre name
                  const getGenreName = (genreKo: string): string => {
                    const genreMap: Record<string, string> = {
                      '가요': t('category.kpop'),
                      '팝': t('category.pop'),
                      '락': t('category.rock'),
                      'CCM': t('category.ccm'),
                      '트로트/성인가요': t('category.trot'),
                      '재즈': t('category.jazz'),
                      'J-POP': t('category.jpop'),
                      'OST': t('category.ost'),
                      '드럼솔로': t('category.drumSolo'),
                      '드럼커버': t('category.drumCover'),
                    };
                    
                    return genreMap[genreKo] || genreKo;
                  };
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedGenre(category.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        selectedGenre === category.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {getGenreName(category.name)}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {popularSheets.slice(0, 5).map((sheet, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3;
                    const eventInfo = getEventForSheet(sheet.id);
                    const displayPrice = getDisplayPrice(sheet);
                    const isFavorite = favoriteIds.has(sheet.id);
                    const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                    return (
                      <div
                        key={sheet.id}
                        onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                        className="group flex items-center justify-between gap-4 rounded-lg p-3 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg cursor-pointer"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <div className="relative flex-shrink-0">
                            {isTop3 && (
                              <div className="absolute -top-2 -left-2 rounded px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 z-10">
                                {t('home.best')}
                              </div>
                            )}
                            <div className="flex h-12 w-12 items-center justify-center">
                              <span
                                className={`text-2xl font-bold transition-colors duration-300 ${
                                  isTop3 ? 'text-blue-600 group-hover:text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
                                }`}
                              >
                                {rank}
                              </span>
                            </div>
                          </div>
                          <img
                            src={getThumbnailUrl(sheet)}
                            alt={sheet.title}
                            className="h-16 w-16 flex-shrink-0 rounded object-cover transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = generateDefaultThumbnail(400, 400);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="mb-1 truncate text-sm font-bold text-gray-900 transition-colors duration-300 group-hover:text-blue-600">
                              {sheet.title}
                            </h4>
                            <p className="truncate text-xs text-gray-600 transition-colors duration-300 group-hover:text-gray-800">
                              {sheet.artist}
                            </p>
                            {eventInfo && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                  {t('home.eventSale')}
                                </span>
                                <span className="text-xs font-semibold text-red-500">{formatCurrency(displayPrice)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                            isFavorite
                              ? 'border-red-200 bg-red-50 text-red-500'
                              : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                          } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-4">
                  {popularSheets.slice(5, 10).map((sheet, index) => {
                    const rank = index + 6;
                    const eventInfo = getEventForSheet(sheet.id);
                    const displayPrice = getDisplayPrice(sheet);
                    const isFavorite = favoriteIds.has(sheet.id);
                    const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                    return (
                      <div
                        key={sheet.id}
                        onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                        className="group flex items-center justify-between gap-4 rounded-lg p-3 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg cursor-pointer"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
                            <span className="text-2xl font-bold text-gray-600 transition-colors duration-300 group-hover:text-gray-800">
                              {rank}
                            </span>
                          </div>
                          <img
                            src={getThumbnailUrl(sheet)}
                            alt={sheet.title}
                            className="h-16 w-16 flex-shrink-0 rounded object-cover transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = generateDefaultThumbnail(400, 400);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="mb-1 truncate text-sm font-bold text-gray-900 transition-colors duration-300 group-hover:text-blue-600">
                              {sheet.title}
                            </h4>
                            <p className="truncate text-xs text-gray-600 transition-colors duration-300 group-hover:text-gray-800">
                              {sheet.artist}
                            </p>
                            {eventInfo && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                  {t('home.eventSale')}
                                </span>
                                <span className="text-xs font-semibold text-red-500">{formatCurrency(displayPrice)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                            isFavorite
                              ? 'border-red-200 bg-red-50 text-red-500'
                              : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                          } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collections Preview */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-base font-semibold uppercase tracking-wide text-blue-500">{t('home.collections')}</p>
                  <h3 className="mt-1 text-2xl font-bold text-gray-900 leading-snug">
                    {t('home.collectionsSubtitle').split('\n').map((line, idx) => (
                      <span key={idx}>
                        {line}
                        {idx < t('home.collectionsSubtitle').split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {t('home.collectionsDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/collections')}
                  className="inline-flex w-full items-center justify-center rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {t('home.viewAllCollections')}
                  <i className="ri-arrow-right-line ml-2 text-base" />
                </button>
              </div>

              {collectionsLoading ? (
                <div className="py-12 text-center text-gray-500">
                  <i className="ri-loader-4-line mx-auto mb-2 block h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm font-medium">{t('home.loadingCollections')}</p>
                </div>
              ) : collectionsToDisplay.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-6 py-10 text-center text-gray-600">
                  <i className="ri-folder-music-line mb-4 text-4xl text-blue-300" />
                  <p className="text-base font-semibold">{t('home.noCollections')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('home.noCollectionsSub')}</p>
                </div>
              ) : (
                <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
                  {collectionsToDisplay.map((collection) => {
                    const hasSalePrice =
                      collection.sale_price > 0 &&
                      (collection.original_price === 0 || collection.sale_price < collection.original_price);
                    const displayPrice =
                      collection.sale_price > 0 ? collection.sale_price : Math.max(collection.original_price, 0);
                    return (
                      <article
                        key={collection.id}
                        onClick={() => navigate(`/collections/${collection.id}`)}
                        className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-blue-100"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <img
                            src={collection.thumbnail_url || generateDefaultThumbnail(640, 480)}
                            alt={collection.title}
                            className="h-full w-full object-cover transition duration-500 hover:scale-105"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = generateDefaultThumbnail(640, 480);
                            }}
                          />
                          {collection.discount_percentage > 0 && (
                            <div className="absolute right-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow">
                              {t('home.discount', { percent: collection.discount_percentage })}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 px-5 py-5">
                          <h4 className="text-lg font-bold text-gray-900 line-clamp-2">{collection.title}</h4>
                          {collection.description && (
                            <p className="text-sm text-gray-500 line-clamp-2">{collection.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <i className="ri-drum-line text-base text-blue-500" />
                            <span>{t('home.songsIncluded', { count: collection.sheet_count || 0 })}</span>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <div>
                              {hasSalePrice && collection.original_price > 0 && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(collection.original_price)}
                                </span>
                              )}
                              <p className="text-xl font-extrabold text-blue-600">
                                {formatCurrency(displayPrice)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/collections/${collection.id}`);
                              }}
                              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              {t('home.viewDetailsCollection')}
                              <i className="ri-arrow-right-line ml-2" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden md:block">
              <div className="mb-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-base font-semibold uppercase tracking-wide text-blue-500">{t('home.collections')}</p>
                  <h3 className="mt-2 text-3xl font-bold text-gray-900 leading-snug">
                    {t('home.collectionsSubtitle').split('\n').map((line, idx) => (
                      <span key={idx}>
                        {line}
                        {idx < t('home.collectionsSubtitle').split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </h3>
                  <p className="mt-3 text-gray-600">
                    {t('home.collectionsDescriptionFull')}
                  </p>
                </div>
                <a
                  href="/collections"
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {t('home.viewAllCollections')}
                  <i className="ri-arrow-right-line ml-2 text-base" />
                </a>
              </div>

              {collectionsLoading ? (
                <div className="py-24 text-center text-gray-500">
                  <i className="ri-loader-4-line w-10 h-10 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="font-medium">{t('home.loadingCollections')}</p>
                </div>
              ) : collectionsToDisplay.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 px-10 py-16 text-center text-gray-600">
                  <i className="ri-folder-music-line text-5xl text-blue-300 mb-4" />
                  <p className="text-lg font-semibold">{t('home.noCollections')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('home.noCollectionsSub')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {collectionsToDisplay.map((collection) => {
                    const hasSalePrice =
                      collection.sale_price > 0 &&
                      (collection.original_price === 0 || collection.sale_price < collection.original_price);
                    const displayPrice =
                      collection.sale_price > 0 ? collection.sale_price : Math.max(collection.original_price, 0);
                    return (
                      <article
                        key={collection.id}
                        onClick={() => navigate(`/collections/${collection.id}`)}
                        className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-blue-100 transition hover:-translate-y-1 hover:shadow-2xl cursor-pointer"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <img
                            src={collection.thumbnail_url || generateDefaultThumbnail(640, 480)}
                            alt={collection.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = generateDefaultThumbnail(640, 480);
                            }}
                          />
                          {collection.discount_percentage > 0 && (
                            <div className="absolute right-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow">
                              {t('home.discount', { percent: collection.discount_percentage })}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-4 px-6 py-6">
                          <div className="space-y-2">
                            <h4 className="text-xl font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600">
                              {collection.title}
                            </h4>
                            {collection.description && (
                              <p className="text-sm text-gray-500 line-clamp-2">{collection.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <i className="ri-drum-line text-base text-blue-500" />
                            <span>{t('home.songsIncluded', { count: collection.sheet_count || 0 })}</span>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex flex-col">
                              {hasSalePrice && collection.original_price > 0 && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(collection.original_price)}
                                </span>
                              )}
                              <span className="text-2xl font-extrabold text-blue-600">
                                {formatCurrency(displayPrice)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/collections/${collection.id}`);
                              }}
                              className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              {t('home.viewDetailsCollection')}
                              <i className="ri-arrow-right-line ml-2" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">{t('home.featuresTitle')}</h3>
              <p className="text-lg text-gray-600">{t('home.featuresSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-file-edit-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">{t('home.customOrderTitle')}</h4>
                <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: t('home.customOrderDescription') }} />
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-price-tag-3-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">{t('home.eventSaleTitle')}</h4>
                <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: t('home.eventSaleDescription') }} />
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-download-cloud-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">{t('home.instantDownloadTitle')}</h4>
                <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: t('home.instantDownloadDescription') }} />
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Custom Order CTA */}
      <div className="lg:mr-64">
        <section className="bg-blue-600 text-center text-white">
          <div className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">{t('home.customOrderCTATitle')}</h3>
            {/* Mobile Version */}
            <div className="md:hidden text-lg sm:text-xl text-blue-100 mb-8 space-y-1">
              <p>{t('home.customOrderCTADescription')}</p>
              <p>{t('home.customOrderCTADescription2')}</p>
            </div>
            {/* PC Version */}
            <div className="hidden md:block text-xl text-blue-100 mb-8 space-y-1">
              <p>{t('home.customOrderCTADescription')}</p>
              <p>{t('home.customOrderCTADescription2')}</p>
            </div>
            <button 
              onClick={() => navigate('/custom-order')}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 font-semibold text-lg whitespace-nowrap cursor-pointer transition-colors shadow-lg"
            >
              {t('home.customOrderCTAButton')}
            </button>
          </div>
        </section>
      </div>

      {/* Footer (PC) */}
      <div className="hidden md:block lg:mr-64">
        <Footer />
      </div>

      {/* Business info link (Mobile) */}
      <div className="md:hidden px-4 sm:px-6 lg:px-8 py-8 text-center space-y-2">
        <button
          type="button"
          onClick={() => navigate('/company/business-info')}
          className="text-sm font-semibold text-gray-700 underline underline-offset-4"
        >
          {t('home.businessInfo')} &gt;
        </button>
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} COPYDRUM. All rights reserved.</p>
      </div>
    </div>
  );
}
