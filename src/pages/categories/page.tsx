
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import React from 'react';
import { useCart } from '../../hooks/useCart';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import MainHeader from '../../components/common/MainHeader';
import { processCashPurchase } from '../../lib/cashPurchases';
import { hasPurchasedSheet } from '../../lib/purchaseCheck';
import { BankTransferInfoModal, PaymentMethodSelector, InsufficientCashModal, PayPalPaymentModal } from '../../components/payments';
import type { PaymentMethod } from '../../components/payments';
import { startSheetPurchase, buySheetNow } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { useTranslation } from 'react-i18next';

import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { useSiteLanguage } from '../../hooks/useSiteLanguage';
import { useBuyNow } from '../../hooks/useBuyNow';
import { useUserCredits } from '../../hooks/useUserCredits';
import Seo from '../../components/Seo';
import { buildCategorySeoStrings } from '../../lib/seo';
import { languageDomainMap } from '../../config/languageDomainMap';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  category_id: string;
  difficulty: string;
  price: number;
  tempo?: number;
  pdf_url: string;
  preview_image_url: string;
  is_featured: boolean;
  created_at: string;
  categories?: { name: string } | null;
  thumbnail_url?: string;
  album_name?: string;
  page_count?: number;
  youtube_url?: string | null;
}

const CategoriesPage: React.FC = () => {
  // ... existing code ...

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drumSheets, setDrumSheets] = useState<DrumSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('category') || '');
  const [selectedSheet, setSelectedSheet] = useState<DrumSheet | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showSortFilter, setShowSortFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>(() => searchParams.get('sort') || 'newest');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>(() => searchParams.get('difficulty') || '');
  const [priceRange, setPriceRange] = useState(() => ({
    min: searchParams.get('priceMin') || '',
    max: searchParams.get('priceMax') || '',
  }));
  const [selectedArtist, setSelectedArtist] = useState<string>(() => searchParams.get('artist') || '');
  const [selectedAlbum, setSelectedAlbum] = useState<string>(() => searchParams.get('album') || '');
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    return Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  });
  const [itemsPerPage] = useState<number>(20);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const [buyingSheetId, setBuyingSheetId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [showInsufficientCashModal, setShowInsufficientCashModal] = useState(false);
  const [insufficientCashInfo, setInsufficientCashInfo] = useState<{ currentBalance: number; requiredAmount: number } | null>(null);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const { i18n, t } = useTranslation();
  const { isKoreanSite } = useSiteLanguage();

  // 통합 통화 로직 적용 (locale 기반)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname, i18n.language);

  // 장르 목록 (순서대로) - 한글 원본 (한글 사이트용)
  const genreListKo = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버'];

  // 영문 사이트용 장르 순서 (기준 순서)
  const genreListEn = ['팝', '락', '가요', '재즈', 'J-POP', 'OST', 'CCM', '트로트/성인가요', '드럼솔로', '드럼커버'];

  // 현재 언어에 맞는 장르 목록 가져오기
  // 한국어(ko)는 genreListKo, 영어(en)는 genreListEn, 나머지 모든 언어는 genreListEn(영어 순서) 사용
  const genreList = i18n.language === 'ko' ? genreListKo : genreListEn;

  // 카테고리 이름을 번역하는 함수
  const getCategoryName = (categoryName: string | null | undefined): string => {
    if (!categoryName) return t('categoriesPage.categories.other');
    if (i18n.language === 'ko') return categoryName;

    const categoryMap: Record<string, string> = {
      '가요': t('categoriesPage.categories.kpop'),
      '팝': t('categoriesPage.categories.pop'),
      '락': t('categoriesPage.categories.rock'),
      'CCM': t('categoriesPage.categories.ccm'),
      '트로트/성인가요': t('categoriesPage.categories.trot'),
      '재즈': t('categoriesPage.categories.jazz'),
      'J-POP': t('categoriesPage.categories.jpop'),
      'OST': t('categoriesPage.categories.ost'),
      '드럼솔로': t('categoriesPage.categories.drumSolo'),
      '드럼커버': t('categoriesPage.categories.drumCover'),
      '기타': t('categoriesPage.categories.other'),
    };

    return categoryMap[categoryName] || categoryName;
  };

  // 난이도 이름을 번역하는 함수
  const getDifficultyName = (difficulty: string | null | undefined): string => {
    if (!difficulty) return t('categoriesPage.difficultyNotSet');
    if (difficulty === 'beginner') return t('categoriesPage.beginner');
    if (difficulty === 'intermediate') return t('categoriesPage.intermediate');
    if (difficulty === 'advanced') return t('categoriesPage.advanced');
    return difficulty;
  };

  const { addToCart, isInCart } = useCart();

  const updateQueryParams = useCallback(
    (updates: Record<string, string | null | undefined>, options: { replace?: boolean } = {}) => {
      const newParams = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (key === 'page' && value === '1')
        ) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      setSearchParams(newParams, options);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search') || '';
    const sortParam = searchParams.get('sort') || 'newest';
    const difficultyParamRaw = searchParams.get('difficulty');
    const difficultyParam = difficultyParamRaw && difficultyParamRaw !== 'all' ? difficultyParamRaw : '';
    const priceMinParam = searchParams.get('priceMin') || '';
    const priceMaxParam = searchParams.get('priceMax') || '';
    const artistParam = searchParams.get('artist') || '';
    const albumParam = searchParams.get('album') || '';
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const normalizedPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

    // 카테고리 파라미터가 없고 검색어가 없으면 첫 번째 장르로 자동 이동
    if (!categoryParam && !searchParam.trim() && categories.length > 0) {
      const firstGenre = genreList[0];
      const firstCategory = categories.find(cat => cat.name === firstGenre);
      if (firstCategory) {
        setSelectedCategory(firstCategory.id);
        const newParams = new URLSearchParams(searchParams);
        newParams.set('category', firstCategory.id);
        newParams.delete('page');
        setSearchParams(newParams, { replace: true });
        return;
      }
    }

    const categoryValue = categoryParam || '';
    if (selectedCategory !== categoryValue) {
      setSelectedCategory(categoryValue);
    }
    if (searchTerm !== searchParam) {
      setSearchTerm(searchParam);
    }
    if (sortBy !== sortParam) {
      setSortBy(sortParam);
    }
    if (selectedDifficulty !== difficultyParam) {
      setSelectedDifficulty(difficultyParam);
    }
    if (priceRange.min !== priceMinParam || priceRange.max !== priceMaxParam) {
      setPriceRange({ min: priceMinParam, max: priceMaxParam });
    }
    if (selectedArtist !== artistParam) {
      setSelectedArtist(artistParam);
    }
    if (selectedAlbum !== albumParam) {
      setSelectedAlbum(albumParam);
    }
    if (currentPage !== normalizedPage) {
      setCurrentPage(normalizedPage);
    }
  }, [
    searchParams,
    categories,
    selectedCategory,
    searchTerm,
    sortBy,
    selectedDifficulty,
    priceRange,
    selectedArtist,
    selectedAlbum,
    currentPage,
  ]);


  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  // ✅ Buy Now는 useBuyNow 훅을 사용


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
    } catch (err) {
      console.error('찜 목록 로드 오류:', err);
    }
  }, [user]);

  const loadData = async () => {
    try {
      await Promise.all([loadCategories(), loadDrumSheets()]);
    } catch (error) {
      console.error('Data loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);


  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data ?? []);
    } catch (err) {
      console.error('Category loading error:', err);
    }
  };

  const loadDrumSheets = async () => {
    try {
      // 먼저 총 개수 확인 (활성화된 악보만)
      const { count: totalCount, error: countError } = await supabase
        .from('drum_sheets')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) {
        console.error('악보 개수 확인 오류:', countError);
        throw countError;
      }

      console.log(`📊 총 악보 개수: ${totalCount}개`);

      let allSheets: DrumSheet[] = [];
      let from = 0;
      const pageSize = 1000;
      const totalPages = Math.ceil((totalCount || 0) / pageSize);

      console.log(`악보 데이터 로드 시작... (총 ${totalPages}페이지 예상)`);

      // 1000개씩 페이지네이션하여 모든 데이터 가져오기
      for (let page = 0; page < totalPages; page++) {
        const to = from + pageSize - 1;
        console.log(`[${page + 1}/${totalPages}] 악보 데이터 로드 중: ${from} ~ ${to}`);

        const { data, error } = await supabase
          .from('drum_sheets')
          .select('id, title, artist, difficulty, price, category_id, tempo, pdf_url, preview_image_url, youtube_url, is_featured, created_at, thumbnail_url, album_name, page_count, categories (name)')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .range(from, to)
          .limit(pageSize);

        if (error) {
          console.error(`[${page + 1}/${totalPages}] 악보 데이터 로드 오류:`, error);
          console.error('에러 상세:', JSON.stringify(error, null, 2));
          throw error;
        }

        if (data && data.length > 0) {
          const normalizedSheets = (data as any[]).map((sheet) => {
            const normalizedCategory =
              Array.isArray(sheet?.categories) && sheet.categories.length > 0
                ? sheet.categories[0]
                : sheet?.categories ?? null;

            return {
              ...sheet,
              categories: normalizedCategory ? { name: normalizedCategory.name ?? '' } : null,
            } as DrumSheet;
          });

          allSheets = [...allSheets, ...normalizedSheets];
          console.log(`✅ [${page + 1}/${totalPages}] 현재까지 로드된 악보 수: ${allSheets.length}개 (이번 페이지: ${data.length}개)`);
          from += pageSize;
        } else {
          console.log(`⚠️ [${page + 1}/${totalPages}] 데이터가 없습니다.`);
          break;
        }
      }

      setDrumSheets(allSheets);
      console.log(`🎉 최종 로드 완료: 총 ${allSheets.length}개의 악보를 로드했습니다. (예상: ${totalCount}개)`);

      if (allSheets.length !== totalCount) {
        console.warn(`⚠️ 경고: 로드된 악보 수(${allSheets.length})와 총 개수(${totalCount})가 일치하지 않습니다.`);
      }
    } catch (err) {
      console.error('Drum sheets loading error:', err);
    }
  };


  const getThumbnailUrl = (sheet: DrumSheet): string => {
    if (sheet.thumbnail_url) {
      return sheet.thumbnail_url;
    }
    // Spotify에서 썸네일을 가져오지 못한 경우 기본 썸네일 생성
    return generateDefaultThumbnail(400, 400);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchTerm('');
    setCurrentPage(1);
    updateQueryParams(
      {
        category: categoryId || null,
        search: null,
        page: null,
      }
    );
  };

  const handleAddToCart = async (sheetId: string) => {
    if (!user) {
      const redirectPath = window.location.pathname + window.location.search;
      navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, sheetId);
      if (alreadyPurchased) {
        const targetSheet =
          drumSheets.find((sheet) => sheet.id === sheetId) ||
          selectedSheet;

        const title = targetSheet?.title || '';
        alert(t('categoriesPage.alreadyPurchased', { title }));
        return;
      }
    } catch (error) {
      console.error('장바구니 담기 전 구매 이력 확인 오류:', error);
      alert(t('categoriesPage.purchaseCheckError'));
      return;
    }

    await addToCart(sheetId);
  };

  const [buyingNowSheetId, setBuyingNowSheetId] = useState<string | null>(null);

  // ✅ 공유 useBuyNow 훅 사용
  const buyNow = useBuyNow(user);
  const handleBankTransferConfirm = buyNow.handleBankTransferConfirm;
  const { credits } = useUserCredits(user);

  const handleBuyNow = async (sheet: DrumSheet) => {
    await buyNow.handleBuyNow({
      id: sheet.id,
      title: sheet.title,
      price: Math.max(0, sheet.price ?? 0),
    });
  };



  const handleToggleFavorite = async (sheetId: string) => {
    if (!user) {
      alert(t('categoriesPage.loginRequired'));
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
      alert(t('categoriesPage.favoriteError'));
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

  // Helper function to remove spaces and convert to lowercase for fuzzy search
  // Helper function to remove spaces and convert to lowercase for fuzzy search
  const normalizeString = (str: string): string => {
    return str.replace(/\s+/g, '').toLowerCase();
  };

  const formatCurrency = (value: number) => {
    const convertedAmount = convertFromKrw(value, currency);
    return formatCurrencyUtil(convertedAmount, currency);
  };

  const getDisplayPrice = (sheet: DrumSheet) => {
    return sheet.price;
  };

  // Filtered sheets based on search, category, difficulty, price range, artist, album
  const filteredSheets = React.useMemo(() => {
    let filtered = [...drumSheets];

    // Search filter with space-insensitive matching
    if (searchTerm.trim()) {
      const normalizedSearch = normalizeString(searchTerm);

      filtered = filtered.filter(sheet => {
        const normalizedTitle = normalizeString(sheet.title);
        const normalizedArtist = normalizeString(sheet.artist);
        const normalizedCategory = sheet.categories?.name ? normalizeString(sheet.categories.name) : '';

        // Search in individual fields (title, artist, category)
        const matchesIndividual =
          normalizedTitle.includes(normalizedSearch) ||
          normalizedArtist.includes(normalizedSearch) ||
          normalizedCategory.includes(normalizedSearch);

        // Search in combined artist + title (e.g., "아이유 넘지 못할 산이 있거든")
        const combinedArtistTitle = normalizedArtist + normalizedTitle;
        const matchesCombined = combinedArtistTitle.includes(normalizedSearch);

        return matchesIndividual || matchesCombined;
      });
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(sheet => sheet.category_id === selectedCategory);
    }

    // Artist filter
    if (selectedArtist) {
      filtered = filtered.filter(sheet => sheet.artist === selectedArtist);
    }

    // Album filter
    if (selectedAlbum) {
      filtered = filtered.filter(sheet => sheet.album_name === selectedAlbum);
    }

    // Difficulty filter
    if (selectedDifficulty && selectedDifficulty !== 'all') {
      filtered = filtered.filter(sheet => sheet.difficulty === selectedDifficulty);
    }

    // Price range filter
    if (priceRange.min) {
      const minPrice = parseInt(priceRange.min, 10);
      if (!Number.isNaN(minPrice)) {
        filtered = filtered.filter(sheet => getDisplayPrice(sheet) >= minPrice);
      }
    }
    if (priceRange.max) {
      const maxPrice = parseInt(priceRange.max, 10);
      if (!Number.isNaN(maxPrice)) {
        filtered = filtered.filter(sheet => getDisplayPrice(sheet) <= maxPrice);
      }
    }

    // Sort
    let sorted = [...filtered];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'price-low':
        sorted.sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
        break;
      case 'price-high':
        sorted.sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
        break;
      case 'popular':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // 최신순 정렬
        break;
      default:
        break;
    }

    return sorted;
  }, [drumSheets, searchTerm, selectedCategory, selectedDifficulty, priceRange, sortBy, selectedArtist, selectedAlbum]);

  // Pagination
  const totalPages = Math.ceil(filteredSheets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSheets = filteredSheets.slice(startIndex, endIndex);

  const selectedDisplayPrice = selectedSheet ? getDisplayPrice(selectedSheet) : 0;
  const selectedSheetIsFavorite = selectedSheet ? favoriteIds.has(selectedSheet.id) : false;
  const selectedSheetFavoriteLoading = selectedSheet ? favoriteLoadingIds.has(selectedSheet.id) : false;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateQueryParams(
      {
        page: page > 1 ? String(page) : null,
      }
    );
  };

  const handleMobileSheetSelect = (sheet: DrumSheet) => {
    // 모바일: 상세페이지로 이동
    navigate(`/sheet-detail/${sheet.id}`);
  };

  const closeMobileDetail = () => {
    setIsMobileDetailOpen(false);
    setSelectedSheet(null);
  };

  const handlePreviewOpen = (sheet: DrumSheet) => {
    const previewUrl = sheet.preview_image_url || sheet.pdf_url;
    if (!previewUrl) {
      alert(t('categoriesPage.noPreview'));
      return;
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleYoutubeOpen = (sheet: DrumSheet) => {
    if (!sheet.youtube_url) {
      alert(t('categoriesPage.noYoutubeVideo'));
      return;
    }
    const href = sheet.youtube_url.startsWith('http')
      ? sheet.youtube_url
      : `https://www.youtube.com/watch?v=${sheet.youtube_url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  // Build SEO strings
  const selectedCategoryObj = categories.find(cat => cat.id === selectedCategory);
  const categoryName = selectedCategoryObj ? getCategoryName(selectedCategoryObj.name) : '';
  const categorySeo = categoryName ? buildCategorySeoStrings(categoryName, t) : {
    title: t('categoriesPage.title') || 'Categories | COPYDRUM',
    description: t('categoriesPage.description') || 'Browse all drum sheet music categories',
  };
  
  // Build canonical URL
  const baseUrl = languageDomainMap[i18n.language as keyof typeof languageDomainMap] || (typeof window !== 'undefined' ? window.location.origin : '');
  const canonicalUrl = baseUrl ? `${baseUrl}/categories${selectedCategory ? `?category=${selectedCategory}` : ''}` : '/categories';

  return (
    <div className="min-h-screen bg-white">
      {/* SEO Meta Tags */}
      <Seo
        title={categorySeo.title}
        description={categorySeo.description}
        canonicalUrl={canonicalUrl}
        locale={i18n.language}
      />
      
      <div className="hidden md:block">
        <MainHeader user={user} />
      </div>


      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* 모바일 장르 탭 - 헤더 바로 아래 */}
        <div className="sticky top-[76px] z-40 bg-white border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-2 px-4 py-3">
            {genreList.map((genreKo) => {
              const category = categories.find((cat) => cat.name === genreKo);
              if (!category) return null;
              
              const isActive = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setCurrentPage(1);
                    updateQueryParams({
                      category: category.id,
                      page: null,
                    });
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getCategoryName(genreKo)}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="pt-4 pb-[96px] px-4 space-y-6">
          {buyNow.bankTransferInfo ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900">{t('categoriesPage.bankTransferInfo')}</h3>
                <button
                  type="button"
                  onClick={() => buyNow.closeBankTransferModal()}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  {t('categoriesPage.close')}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.bank')}</span> {buyNow.bankTransferInfo.bankName}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.accountNumber')}</span> {buyNow.bankTransferInfo.accountNumber}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.accountHolder')}</span> {buyNow.bankTransferInfo.depositor}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.depositAmount')}</span>{' '}
                  {formatCurrency(buyNow.bankTransferInfo.amount ?? 0)}
                </div>
                {buyNow.bankTransferInfo.expectedDepositor ? (
                  <div>
                    <span className="font-medium text-gray-900">{t('categoriesPage.depositorName')}</span>{' '}
                    <span className="text-blue-600 font-semibold">{buyNow.bankTransferInfo.expectedDepositor}</span>
                  </div>
                ) : null}
                {buyNow.bankTransferInfo.message ? (
                  <p className="text-xs text-gray-600">{buyNow.bankTransferInfo.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 현재 선택된 카테고리 표시 (모바일) */}
          {!loading && selectedCategory && (
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {(() => {
                  const category = categories.find(cat => cat.id === selectedCategory);
                  return category ? getCategoryName(category.name) : '';
                })()}
              </h2>
            </div>
          )}

          {/* Mobile Sheets List */}
          <div className="space-y-4">
            {loading && (
              <div className="py-16 text-center text-gray-500">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
                {t('categoriesPage.loadingSheets')}
              </div>
            )}

            {!loading && paginatedSheets.length === 0 && (
              <div className="py-16 text-center text-gray-500">
                <i className="ri-file-music-line mb-4 text-4xl text-gray-300" />
                <p className="font-semibold text-gray-600">{t('categoriesPage.noSearchResults')}</p>
              </div>
            )}

            {!loading &&
              paginatedSheets.map((sheet) => {
                const displayPrice = getDisplayPrice(sheet);
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => handleMobileSheetSelect(sheet)}
                    className="flex w-full items-start gap-4 rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
                  >
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200">
                      <img
                        src={getThumbnailUrl(sheet)}
                        alt={sheet.title}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          const img = event.target as HTMLImageElement;
                          img.src = generateDefaultThumbnail(400, 400);
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-bold text-gray-900">{sheet.title}</p>
                      <p className="truncate text-xs text-gray-500">{sheet.artist}</p>
                      <p className="truncate text-xs text-gray-400">{sheet.album_name || t('categoriesPage.albumInfoNotFound')}</p>
                      <div className="pt-1 text-sm font-semibold text-blue-600">
                        {formatCurrency(displayPrice)}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Mobile Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <i className="ri-arrow-left-s-line text-lg" />
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 disabled:opacity-50"
                disabled={currentPage === totalPages}
              >
                <i className="ri-arrow-right-s-line text-lg" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Bottom Sheet */}
      {
        selectedSheet && isMobileDetailOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
            <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{selectedSheet.title}</h3>
                <button
                  type="button"
                  onClick={closeMobileDetail}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-fill text-2xl" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl">
                  <img
                    src={getThumbnailUrl(selectedSheet)}
                    alt={selectedSheet.title}
                    className="w-full object-cover"
                    onError={(event) => {
                      const img = event.target as HTMLImageElement;
                      img.src = generateDefaultThumbnail(640, 480);
                    }}
                  />
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">{selectedSheet.artist}</p>
                  {selectedSheet.album_name && <p>{t('categoriesPage.albumLabel')}: {selectedSheet.album_name}</p>}
                  {selectedSheet.difficulty && <p>{t('categoriesPage.difficultyLabel')}: {getDifficultyName(selectedSheet.difficulty)}</p>}
                  {selectedSheet.page_count ? <p>{t('categoriesPage.pageLabel')}: {selectedSheet.page_count}{t('categoriesPage.pageUnit')}</p> : null}
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-right">
                    <span className="text-2xl font-extrabold text-blue-600">
                      {formatCurrency(selectedDisplayPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(selectedSheet.id)}
                    disabled={selectedSheetFavoriteLoading}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${selectedSheetIsFavorite
                      ? 'border-red-200 bg-red-50 text-red-500'
                      : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                      } ${selectedSheetFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <i className={`ri-heart-${selectedSheetIsFavorite ? 'fill' : 'line'} text-xl`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedSheet.preview_image_url || selectedSheet.pdf_url) && (
                    <button
                      type="button"
                      onClick={() => handlePreviewOpen(selectedSheet)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {t('categoriesPage.previewSheet')}
                    </button>
                  )}
                  {selectedSheet.youtube_url && (
                    <button
                      type="button"
                      onClick={() => handleYoutubeOpen(selectedSheet)}
                      className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-red-600"
                    >
                      {t('categoriesPage.playYoutube')}
                    </button>
                  )}
                </div>
                {buyNow.bankTransferInfo ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                    <h4 className="font-semibold text-blue-900 mb-2">{t('categoriesPage.bankTransferInfo')}</h4>
                    <div className="space-y-1">
                      <p>{t('categoriesPage.bank')}: {buyNow.bankTransferInfo.bankName}</p>
                      <p>{t('categoriesPage.accountNumber')}: {buyNow.bankTransferInfo.accountNumber}</p>
                      <p>{t('categoriesPage.accountHolder')}: {buyNow.bankTransferInfo.depositor}</p>
                      <p>{t('categoriesPage.depositAmount')}: {formatCurrency(buyNow.bankTransferInfo.amount ?? 0)}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleAddToCart(selectedSheet.id);
                      closeMobileDetail();
                    }}
                    disabled={selectedSheet && isInCart(selectedSheet.id)}
                    className={`flex-1 sheet-action-btn btn-cart ${selectedSheet && isInCart(selectedSheet.id) ? 'opacity-60' : ''}`}
                  >
                    {t('categoriesPage.addToCart')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSheet) {
                        handleBuyNow(selectedSheet);
                      }
                      closeMobileDetail();
                    }}
                    disabled={selectedSheet && buyingNowSheetId === selectedSheet.id}
                    className="flex-1 sheet-action-btn btn-buy"
                  >
                    {selectedSheet && buyingNowSheetId === selectedSheet.id
                      ? t('sheet.buyNowProcessing') || '처리 중...'
                      : t('sheet.buyNow')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/sheet-detail/${selectedSheet.id}`)}
                  className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {t('categoriesPage.goToDetail')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Desktop Layout */}
      <div className="hidden md:block ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {buyNow.bankTransferInfo ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900">{t('categoriesPage.bankTransferInfo')}</h3>
                <button
                  type="button"
                  onClick={() => buyNow.closeBankTransferModal()}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  {t('categoriesPage.close')}
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.bank')}</span> {buyNow.bankTransferInfo.bankName}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.accountNumber')}</span> {buyNow.bankTransferInfo.accountNumber}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.accountHolder')}</span> {buyNow.bankTransferInfo.depositor}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{t('categoriesPage.depositAmount')}</span>{' '}
                  {formatCurrency(buyNow.bankTransferInfo.amount ?? 0)}
                </div>
                {buyNow.bankTransferInfo.expectedDepositor ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-gray-900">{t('categoriesPage.depositorName')}</span>{' '}
                    <span className="text-blue-600 font-semibold">{buyNow.bankTransferInfo.expectedDepositor}</span>
                  </div>
                ) : null}
              </div>
              {buyNow.bankTransferInfo.message ? (
                <p className="mt-3 text-xs text-gray-600">{buyNow.bankTransferInfo.message}</p>
              ) : null}
            </div>
          ) : null}

          {/* 페이지 제목 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {selectedArtist ? `${selectedArtist}${t('categoriesPage.artistSongs')}` : selectedAlbum ? `${selectedAlbum} ${t('categoriesPage.album')}` : t('categoriesPage.pageTitle')}
            </h1>
            {selectedArtist && (
              <button
                onClick={() => {
                  setSelectedArtist('');
                  setCurrentPage(1);
                  updateQueryParams(
                    {
                      artist: null,
                      page: null,
                    }
                  );
                }}
                className="text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                {t('categoriesPage.backToAllSheets')}
              </button>
            )}
            {selectedAlbum && (
              <button
                onClick={() => {
                  setSelectedAlbum('');
                  setCurrentPage(1);
                  updateQueryParams(
                    {
                      album: null,
                      page: null,
                    }
                  );
                }}
                className="text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                {t('categoriesPage.backToAllSheets')}
              </button>
            )}
            {!selectedArtist && !selectedAlbum && (
              <p className="text-gray-600">{t('categoriesPage.pageDescription')}</p>
            )}
          </div>

          {/* 현재 선택된 카테고리 표시 */}
          {!loading && selectedCategory && (
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {(() => {
                  const category = categories.find(cat => cat.id === selectedCategory);
                  return category ? getCategoryName(category.name) : '';
                })()}
              </h2>
            </div>
          )}

          {/* 필터 및 정렬 - 기본적으로 숨김 */}
          {!loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <i className="ri-filter-line text-sm"></i>
                  <span>{t('categoriesPage.filter')}</span>
                  <i className={`ri-arrow-${showFilters ? 'up' : 'down'}-s-line text-sm`}></i>
                </button>

                <button
                  onClick={() => setShowSortFilter(!showSortFilter)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <i className="ri-sort-desc text-sm"></i>
                  <span>{t('categoriesPage.sort')}</span>
                  <i className={`ri-arrow-${showSortFilter ? 'up' : 'down'}-s-line text-sm`}></i>
                </button>
              </div>

              {/* 정렬 옵션 - 클릭시 표시 */}
              {showSortFilter && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">{t('categoriesPage.sortLabel')}</label>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSortBy(value);
                        setCurrentPage(1);
                        updateQueryParams(
                          {
                            sort: value === 'newest' ? null : value,
                            page: null,
                          }
                        );
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-8"
                    >
                      <option value="newest">{t('categoriesPage.sortNewest')}</option>
                      <option value="popular">{t('categoriesPage.sortPopular')}</option>
                      <option value="price-low">{t('categoriesPage.sortPriceLow')}</option>
                      <option value="price-high">{t('categoriesPage.sortPriceHigh')}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 확장 필터 */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('categoriesPage.categoryLabel')}</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => handleCategorySelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-8"
                      >
                        <option value="">{t('categoriesPage.allCategories')}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('categoriesPage.difficultyLabelFilter')}</label>
                      <select
                        value={selectedDifficulty}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDifficulty(value);
                          setCurrentPage(1);
                          updateQueryParams(
                            {
                              difficulty: value || null,
                              page: null,
                            }
                          );
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-8"
                      >
                        <option value="">{t('categoriesPage.allDifficulties')}</option>
                        <option value="beginner">{t('categoriesPage.beginner')}</option>
                        <option value="intermediate">{t('categoriesPage.intermediate')}</option>
                        <option value="advanced">{t('categoriesPage.advanced')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('categoriesPage.priceRange')}</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          placeholder={t('categoriesPage.min')}
                          value={priceRange.min}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPriceRange((prev) => ({ ...prev, min: value }));
                            setCurrentPage(1);
                            updateQueryParams(
                              {
                                priceMin: value,
                                page: null,
                              }
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <span className="text-gray-500">~</span>
                        <input
                          type="number"
                          placeholder={t('categoriesPage.max')}
                          value={priceRange.max}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPriceRange((prev) => ({ ...prev, max: value }));
                            setCurrentPage(1);
                            updateQueryParams(
                              {
                                priceMax: value,
                                page: null,
                              }
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        handleCategorySelect('');
                        setSelectedDifficulty('');
                        setPriceRange({ min: '', max: '' });
                        updateQueryParams(
                          {
                            difficulty: null,
                            priceMin: null,
                            priceMax: null,
                            page: null,
                          }
                        );
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      {t('categoriesPage.resetFilters')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 악보 목록 - 리스트 형식 */}
          {!loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[34%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('categoriesPage.tableTitle')}</th>
                    <th className="w-[18%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('categoriesPage.tableArtist')}</th>
                    <th className="w-[24%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('categoriesPage.tableAlbum')}</th>
                    <th className="w-[24%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('categoriesPage.tablePurchase')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSheets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        {t('categoriesPage.noSheets')}
                      </td>
                    </tr>
                  ) : (
                    paginatedSheets.map((sheet) => {
                      const displayPrice = getDisplayPrice(sheet);
                      const isFavorite = favoriteIds.has(sheet.id);
                      const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                      return (
                        <tr key={sheet.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <img
                                src={getThumbnailUrl(sheet)}
                                alt={sheet.title}
                                className="w-12 h-12 object-cover rounded border border-gray-200 cursor-pointer flex-shrink-0"
                                onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                              />
                              <div className="flex flex-col space-y-1 min-w-0 flex-1">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <i className="ri-file-music-line text-gray-400 flex-shrink-0"></i>
                                  <span
                                    className="block truncate text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                                    title={sheet.title}
                                    onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                                  >
                                    {sheet.title}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs flex-shrink-0">
                                  <span className="font-semibold text-gray-700">
                                    {formatCurrency(displayPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span
                              className="block truncate text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                              onClick={() => {
                                setSelectedArtist(sheet.artist);
                                setCurrentPage(1);
                                updateQueryParams(
                                  {
                                    artist: sheet.artist,
                                    page: null,
                                  }
                                );
                              }}
                            >
                              {sheet.artist}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span
                              className="block truncate text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                              title={sheet.album_name || '-'}
                              onClick={() => {
                                if (sheet.album_name) {
                                  setSelectedAlbum(sheet.album_name);
                                  setCurrentPage(1);
                                  updateQueryParams(
                                    {
                                      album: sheet.album_name,
                                      page: null,
                                    }
                                  );
                                }
                              }}
                            >
                              {sheet.album_name || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(sheet.id);
                                }}
                                disabled={isFavoriteLoading}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${isFavorite
                                  ? 'border-red-200 bg-red-50 text-red-500'
                                  : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                                  } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                aria-label={isFavorite ? t('categoriesPage.favoriteRemove') : t('categoriesPage.favoriteAdd')}
                              >
                                <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(sheet.id);
                                }}
                                disabled={isInCart(sheet.id)}
                                className={`sheet-action-btn btn-cart ${isInCart(sheet.id) ? 'opacity-60' : ''}`}
                              >
                                {t('categoriesPage.addToCart')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBuyNow(sheet);
                                }}
                                disabled={buyingNowSheetId === sheet.id}
                                className="sheet-action-btn btn-buy"
                              >
                                {buyingNowSheetId === sheet.id ? t('sheet.buyNowProcessing') || '처리 중...' : t('sheet.buyNow')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center space-x-2">
              <button
                onClick={() => {
                  const previousPage = Math.max(1, currentPage - 1);
                  setCurrentPage(previousPage);
                  updateQueryParams(
                    {
                      page: previousPage > 1 ? String(previousPage) : null,
                    }
                  );
                }}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // 현재 페이지 주변 2페이지씩만 표시
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page);
                        updateQueryParams(
                          {
                            page: page > 1 ? String(page) : null,
                          }
                        );
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 3 ||
                  page === currentPage + 3
                ) {
                  return (
                    <span key={page} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}

              <button
                onClick={() => {
                  const nextPage = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(nextPage);
                  updateQueryParams(
                    {
                      page: nextPage > 1 ? String(nextPage) : null,
                    }
                  );
                }}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          )}

          {/* 로딩 중 */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('categoriesPage.loadingSheetsMessage')}</h3>
            </div>
          )}

          {/* 빈 상태 - 로딩이 완료되었고 결과가 없을 때만 표시 */}
          {!loading && paginatedSheets.length === 0 && (
            <div className="text-center py-12">
              <i className="ri-file-music-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('categoriesPage.noSearchResults')}</h3>
              <p className="text-gray-600">{t('categoriesPage.tryDifferentSearch')}</p>
            </div>
          )}
        </div>
      </div>


      {/* ✅ 공유 useBuyNow 훅의 모달들 */}
      <PaymentMethodSelector
        open={buyNow.showPaymentSelector}
        amount={buyNow.pendingSheet ? buyNow.pendingSheet.price : 0}
        onSelect={buyNow.handlePaymentMethodSelect}
        onClose={buyNow.closePaymentSelector}
        context="buyNow"
        userCredits={credits}
      />

      <BankTransferInfoModal
        open={buyNow.showBankTransferModal}
        amount={buyNow.pendingSheet ? buyNow.pendingSheet.price : 0}
        userName={(user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined}
        onConfirm={buyNow.handleBankTransferConfirm}
        onClose={buyNow.closeBankTransferModal}
        processing={buyNow.paymentProcessing}
        orderCreated={!!buyNow.bankTransferInfo}
        successMessage={t('categoriesPage.bankTransferCreated') || '무통장입금 계좌가 생성되었습니다. 입금을 완료해주세요.'}
      />

      {buyNow.showPayPalModal && buyNow.pendingSheet && (
        <PayPalPaymentModal
          open={buyNow.showPayPalModal}
          amount={buyNow.pendingSheet.price}
          orderTitle={buyNow.pendingSheet.title}
          onClose={buyNow.closePayPalModal}
          onSuccess={(response) => {
            buyNow.closePayPalModal();
            // PayPal은 리다이렉트되므로 여기서 추가 처리 불필요할 수 있음
          }}
          onError={(error) => {
            console.error('PayPal 결제 오류:', error);
            alert(t('categoriesPage.purchaseError'));
          }}
          initiatePayment={buyNow.handlePayPalInitiate}
        />
      )}


      {
        insufficientCashInfo && (
          <InsufficientCashModal
            open={showInsufficientCashModal}
            currentBalance={insufficientCashInfo.currentBalance}
            requiredAmount={insufficientCashInfo.requiredAmount}
            onClose={() => {
              setShowInsufficientCashModal(false);
              setInsufficientCashInfo(null);
            }}
          />
        )
      }
    </div >
  );
};

export default CategoriesPage;
