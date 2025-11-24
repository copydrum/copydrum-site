
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import { useTranslation } from 'react-i18next';
import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { useSiteLanguage } from '../../hooks/useSiteLanguage';

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


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestSheets, setLatestSheets] = useState<DrumSheet[]>([]);
  const [popularSheets, setPopularSheets] = useState<DrumSheet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const { i18n, t } = useTranslation();
  const { isKoreanSite } = useSiteLanguage();

  const loadLatestSheets = useCallback(async () => {
    try {
      // 장르 필터링: 한국 사이트는 '가요'(K-POP), 글로벌 사이트는 '팝'(Pop)
      const targetGenreName = isKoreanSite ? '가요' : '팝';
      
      // 카테고리에서 해당 장르 ID 찾기
      const targetCategory = categories.find(cat => cat.name === targetGenreName);
      
      let query = supabase
        .from('drum_sheets')
        .select('id, title, artist, price, thumbnail_url, youtube_url, category_id')
        .eq('is_active', true);

      // 카테고리를 찾았으면 해당 장르로 필터링
      if (targetCategory) {
        query = query.eq('category_id', targetCategory.id);
      }

      query = query.order('created_at', { ascending: false }).limit(12);

      const { data, error } = await query;

      if (error) throw error;
      setLatestSheets(data || []);
    } catch (error) {
      console.error(t('home.console.latestSheetsLoadError'), error);
    }
  }, [t, categories, isKoreanSite]);

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


  const loadPopularSheets = useCallback(async () => {
    // 장르가 선택되지 않았으면 요청하지 않음
    if (!selectedGenre) {
      setPopularSheets([]);
      return;
    }

    try {
      const query = supabase
        .from('drum_sheets')
        .select('id, title, artist, price, thumbnail_url, youtube_url, is_featured, category_id')
        .eq('is_active', true)
        .eq('category_id', selectedGenre)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      const { data, error } = await query;

      if (error) throw error;
      setPopularSheets(data || []);
    } catch (error) {
      console.error(t('home.console.popularSheetsLoadError'), error);
      setPopularSheets([]);
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
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    // 카테고리가 로드된 후에 최신 악보 로드 (장르 필터링을 위해 카테고리 필요)
    if (categories.length > 0) {
      loadLatestSheets();
    }
  }, [loadLatestSheets, categories.length]);

  useEffect(() => {
    // Popular Sheets에서 첫 번째 장르를 자동 선택 (카테고리 로드 후, selectedGenre가 비어있을 때만)
    if (categories.length > 0 && !selectedGenre) {
      // 글로벌 사이트용 장르 순서 정의
      const globalGenreOrder = ['팝', '락', '가요', '재즈', 'J-POP', 'OST', 'CCM', '트로트/성인가요', '드럼솔로', '드럼커버'];
      
      // 한국 사이트는 기존 categories 순서 사용, 글로벌 사이트는 새로운 순서 사용
      const sortedCategories = isKoreanSite
        ? categories
        : [...categories].sort((a, b) => {
            const indexA = globalGenreOrder.indexOf(a.name);
            const indexB = globalGenreOrder.indexOf(b.name);
            // 순서에 없는 항목은 끝으로
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
      
      // 첫 번째 장르 자동 선택
      if (sortedCategories.length > 0) {
        setSelectedGenre(sortedCategories[0].id);
      }
    }
  }, [categories, isKoreanSite, selectedGenre]);


  useEffect(() => {
    // 장르가 선택된 경우에만 인기 악보 로드
    if (selectedGenre) {
      loadPopularSheets();
    }
  }, [loadPopularSheets, selectedGenre]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

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
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname);

  const formatCurrency = useCallback(
    (value: number) => {
      const converted = convertFromKrw(value, currency);
      return formatCurrencyUtil(converted, currency);
    },
    [currency],
  );

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

      {/* Main Content */}
      <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8 ">
        {/* Latest Sheets - 최상단에 배치 */}
        <section className="py-6 md:py-12">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{t('home.latestSheets')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {latestSheets.slice(0, 6).map((sheet) => {
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                      className="relative flex cursor-pointer flex-col"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <img
                          src={getThumbnailUrl(sheet)}
                          alt={sheet.title}
                          className="h-full w-full object-cover transition-transform duration-300"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = generateDefaultThumbnail(400, 400);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${isFavorite
                            ? 'border-red-200 bg-red-50/90 text-red-500'
                            : 'border-white/60 bg-black/30 text-white'
                            } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-base`} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 text-center text-white">
                          <h4 className="text-sm font-bold line-clamp-2 leading-tight">{sheet.title}</h4>
                          <p className="text-xs text-white/80 line-clamp-1 mt-0.5">{sheet.artist}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors"
                >
                  {t('home.showMore')}
                </button>
              </div>
            </div>

            <div className="hidden md:block">
              <h3 className="mb-8 text-left text-3xl font-bold text-gray-900">{t('home.latestSheets')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {latestSheets.map((sheet) => {
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
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleFavorite(sheet.id);
                        }}
                        disabled={isFavoriteLoading}
                        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${isFavorite
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Popular Sheets */}
        <section className="py-12 md:py-16 bg-gray-50 rounded-3xl md:rounded-none -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{t('home.popularSheets')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {popularSheets.slice(0, 6).map((sheet) => {
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                      className="relative flex cursor-pointer flex-col"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-2xl">
                        <img
                          src={getThumbnailUrl(sheet)}
                          alt={sheet.title}
                          className="h-full w-full object-cover transition-transform duration-300"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = generateDefaultThumbnail(400, 400);
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${isFavorite
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-white/60 bg-black/30 text-white'
                            } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-base`} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 text-center text-white">
                          <h4 className="text-sm font-bold line-clamp-2 leading-tight">{sheet.title}</h4>
                          <p className="text-xs text-white/80 line-clamp-1 mt-0.5">{sheet.artist}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors"
                >
                  {t('home.showMore')}
                </button>
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
                {(() => {
                  // 글로벌 사이트용 장르 순서 정의
                  const globalGenreOrder = ['팝', '락', '가요', '재즈', 'J-POP', 'OST', 'CCM', '트로트/성인가요', '드럼솔로', '드럼커버'];
                  
                  // 한국 사이트는 기존 categories 순서 사용, 글로벌 사이트는 새로운 순서 사용
                  const sortedCategories = isKoreanSite
                    ? categories
                    : [...categories].sort((a, b) => {
                        const indexA = globalGenreOrder.indexOf(a.name);
                        const indexB = globalGenreOrder.indexOf(b.name);
                        // 순서에 없는 항목은 끝으로
                        if (indexA === -1 && indexB === -1) return 0;
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                      });

                  return sortedCategories.map((category) => {
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
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedGenre === category.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {getGenreName(category.name)}
                      </button>
                    );
                  });
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {popularSheets.slice(0, 5).map((sheet, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3;
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
                                className={`text-2xl font-bold transition-colors duration-300 ${isTop3 ? 'text-blue-600 group-hover:text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
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
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isFavorite
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
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(sheet.id);
                          }}
                          disabled={isFavoriteLoading}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isFavorite
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

      </div>

      {/* Custom Order CTA */}
      <div className="">
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

      {/* Hero Section - 최하단으로 이동 */}
      <div>
        <section
          className="relative bg-cover bg-center bg-no-repeat h-[280px] sm:h-[320px] md:h-[380px] lg:h-[400px] bg-gray-900 overflow-hidden"
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
              <div className="max-w-xl md:hidden text-center space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {t('home.banner.title').split('\n').map((line, idx) => (
                    <span key={idx}>
                      {line}
                      {idx < t('home.banner.title').split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </h2>
                <div className="text-white text-sm sm:text-base leading-relaxed space-y-1">
                  <p>{t('home.banner.subtitle1')}</p>
                  <p>{t('home.banner.subtitle2')}</p>
                  <p>{t('home.banner.subtitle3')}</p>
                </div>
                <button
                  onClick={() => window.location.href = '/categories'}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-full hover:from-blue-700 hover:to-purple-700 font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 shadow-lg text-sm sm:text-base"
                >
                  {t('home.banner.browseButton')}
                </button>
              </div>
              {/* PC Version */}
              <div className="hidden md:block max-w-2xl text-left space-y-4">
                <h2 className="text-4xl font-bold text-white leading-tight">
                  {t('home.banner.title').split('\n').map((line, idx) => (
                    <span key={idx}>
                      {line}
                      {idx < t('home.banner.title').split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </h2>
                <div className="text-white text-lg leading-relaxed space-y-1">
                  <p>{t('home.banner.subtitle1')}</p>
                  <p>{t('home.banner.subtitle2')}</p>
                  <p>{t('home.banner.subtitle3')}</p>
                </div>
                <button
                  onClick={() => window.location.href = '/categories'}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-full hover:from-blue-700 hover:to-purple-700 font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 shadow-lg"
                >
                  {t('home.banner.browseButton')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer (PC) */}
      <div className="hidden md:block ">
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
