
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import React from 'react';
import UserSidebar from '../../components/feature/UserSidebar';
import { useCart } from '../../hooks/useCart';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import type { EventDiscountMap } from '../../lib/eventDiscounts';
import { buildEventDiscountMap, fetchEventDiscountList, purchaseEventDiscount } from '../../lib/eventDiscounts';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import MainHeader from '../../components/common/MainHeader';
import { processCashPurchase } from '../../lib/cashPurchases';
import { hasPurchasedSheet } from '../../lib/purchaseCheck';
import { BankTransferInfoModal, PaymentMethodSelector } from '../../components/payments';
import { startSheetPurchase } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { openCashChargeModal } from '../../lib/cashChargeModal';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

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
  const [topSheets, setTopSheets] = useState<DrumSheet[]>([]);
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
  const [eventDiscounts, setEventDiscounts] = useState<EventDiscountMap>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const [buyingSheetId, setBuyingSheetId] = useState<string | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [pendingPurchaseSheet, setPendingPurchaseSheet] = useState<DrumSheet | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [selectedTopSheetId, setSelectedTopSheetId] = useState<string | null>(null);
  const { i18n, t } = useTranslation();

  // 장르 목록 (순서대로)
  const genreList = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버'];

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

    // 카테고리 파라미터가 없고 검색어가 없으면 첫 번째 장르(가요)로 자동 이동
    if (!categoryParam && !searchParam.trim() && categories.length > 0) {
      const firstGenre = genreList[0]; // '가요'
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

  useEffect(() => {
    calculateTopSheets();
  }, [drumSheets, selectedCategory]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const completeOnlinePurchase = async (
    method: 'card' | 'bank_transfer',
    options?: { depositorName?: string },
  ) => {
    if (!user || !pendingPurchaseSheet) return;

    const sheet = pendingPurchaseSheet;
    const price = Math.max(
      0,
      (getEventForSheet(sheet.id)?.discount_price ?? sheet.price) ?? 0,
    );

    const result = await startSheetPurchase({
      userId: user.id,
      items: [{ sheetId: sheet.id, sheetTitle: sheet.title, price }],
      amount: price,
      paymentMethod: method,
      description: t('categories.purchaseDescription', { title: sheet.title }),
      buyerName: user.email ?? null,
      buyerEmail: user.email ?? null,
      // returnUrl은 productPurchase에서 자동으로 Edge Function URL 사용
      depositorName: options?.depositorName,
    });

    if (method === 'bank_transfer') {
      setBankTransferInfo(result.virtualAccountInfo ?? null);
      alert(t('categories.bankTransferCreated'));
    } else {
      setBankTransferInfo(null);
      alert(t('categories.paymentWindowOpen'));
    }
  };

  const handlePurchaseMethodSelect = async (method: 'cash' | 'card' | 'bank') => {
    if (!user || !pendingPurchaseSheet) return;

    const sheet = pendingPurchaseSheet;
    const sheetId = sheet.id;
    const event = getEventForSheet(sheetId);
    const price = Math.max(0, (event?.discount_price ?? sheet.price) ?? 0);

    setShowPaymentSelector(false);

    if (method === 'bank') {
      setShowBankTransferModal(true);
      return;
    }

    setPaymentProcessing(true);

    try {
      if (method === 'cash') {
        const result = await processCashPurchase({
          userId: user.id,
          totalPrice: price,
          description: t('categories.purchaseDescription', { title: sheet.title }),
          items: [{ sheetId, sheetTitle: sheet.title, price }],
          sheetIdForTransaction: sheetId,
        });

        if (!result.success) {
          if (result.reason === 'INSUFFICIENT_CREDIT') {
            alert(
              t('categories.insufficientCash', { 
                amount: result.currentCredits.toLocaleString(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US')
              }),
            );
            openCashChargeModal();
          }
          return;
        }

        if (event && event.status === 'active') {
          try {
            await purchaseEventDiscount(event);
          } catch (eventError) {
            console.warn('이벤트 할인 처리 중 경고:', eventError);
          }
        }

        alert(t('categories.purchaseComplete'));
        navigate('/my-orders');
        return;
      }

      await completeOnlinePurchase('card');
    } catch (error) {
      console.error('주문 처리 오류:', error);
      alert(error instanceof Error ? error.message : t('categories.purchaseError'));
    } finally {
      setPaymentProcessing(false);
      setBuyingSheetId(null);
      setPendingPurchaseSheet(null);
    }
  };

  const handleBankTransferConfirm = async (depositorName: string) => {
    if (!user || !pendingPurchaseSheet) return;

    setShowBankTransferModal(false);
    setPaymentProcessing(true);

    try {
      await completeOnlinePurchase('bank_transfer', { depositorName });
    } catch (error) {
      console.error('무통장입금 주문 처리 오류:', error);
      alert(error instanceof Error ? error.message : t('categories.purchaseError'));
    } finally {
      setPaymentProcessing(false);
      setBuyingSheetId(null);
      setPendingPurchaseSheet(null);
    }
  };

  const loadEventDiscounts = async () => {
    try {
      const data = await fetchEventDiscountList();
      setEventDiscounts(buildEventDiscountMap(data));
    } catch (err) {
      console.error('이벤트 할인 악보 정보 로드 오류:', err);
    }
  };

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
      await Promise.all([loadCategories(), loadDrumSheets(), loadEventDiscounts()]);
    } catch (error) {
      console.error('Data loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    if (!loading) {
      if (topSheets.length === 0) {
        setSelectedTopSheetId(null);
      } else if (selectedTopSheetId && !topSheets.some((sheet) => sheet.id === selectedTopSheetId)) {
        setSelectedTopSheetId(null);
      }
    }
  }, [loading, topSheets, selectedTopSheetId]);

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

  const calculateTopSheets = () => {
    let filtered = [...drumSheets];

    // 선택된 카테고리가 있으면 필터링
    if (selectedCategory) {
      filtered = filtered.filter((sheet) => sheet.category_id === selectedCategory);
    }

    // TOP 5는 최신순으로 표시 (인기도 점수는 추후 구현)
    const top5 = filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    setTopSheets(top5);
    
    // 선택된 악보가 없거나 리스트에 없으면 첫 번째로 설정
    if (top5.length > 0) {
      if (!selectedSheet || !top5.find(s => s.id === selectedSheet.id)) {
        setSelectedSheet(top5[0]);
      }
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
    if (user) {
      try {
        const alreadyPurchased = await hasPurchasedSheet(user.id, sheetId);
        if (alreadyPurchased) {
          const targetSheet =
            drumSheets.find((sheet) => sheet.id === sheetId) ||
            topSheets.find((sheet) => sheet.id === sheetId) ||
            selectedSheet;

          const title = targetSheet?.title || '';
          alert(t('categories.alreadyPurchased', { title }));
          return;
        }
      } catch (error) {
        console.error('장바구니 담기 전 구매 이력 확인 오류:', error);
        alert(t('categories.purchaseCheckError'));
        return;
      }
    }

    const success = await addToCart(sheetId);
    if (success) {
      alert(t('categories.addedToCart'));
    }
  };

  const handleBuyNow = async (sheetId: string) => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const sheet = drumSheets.find((item) => item.id === sheetId);
    if (!sheet) {
      alert(t('categories.sheetNotFound'));
      return;
    }

    setBuyingSheetId(sheetId);
    setBankTransferInfo(null);
    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, sheetId);
      if (alreadyPurchased) {
        alert(t('categories.alreadyPurchasedGeneric'));
        setBuyingSheetId(null);
        return;
      }

      setPendingPurchaseSheet(sheet);
      setShowPaymentSelector(true);
    } catch (error) {
      console.error('바로구매 사전 확인 오류:', error);
      alert(t('categories.purchaseCheckError'));
      setBuyingSheetId(null);
    } finally {
      // keep buyingSheetId while modal is open
    }
  };

  const handleToggleFavorite = async (sheetId: string) => {
    if (!user) {
      alert(t('categories.loginRequired'));
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
      alert(t('categories.favoriteError'));
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
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );

  const normalizeString = (str: string): string => {
    return str.replace(/\s+/g, '').toLowerCase();
  };

  const getEventForSheet = (sheetId: string) => eventDiscounts[sheetId];

  const getDisplayPrice = (sheet: DrumSheet) => {
    const event = getEventForSheet(sheet.id);
    return event ? event.discount_price : sheet.price;
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
  }, [drumSheets, searchTerm, selectedCategory, selectedDifficulty, priceRange, sortBy, selectedArtist, selectedAlbum, eventDiscounts]);

  // Pagination
  const totalPages = Math.ceil(filteredSheets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSheets = filteredSheets.slice(startIndex, endIndex);

  const selectedEventInfo = selectedSheet ? getEventForSheet(selectedSheet.id) : undefined;
  const selectedDisplayPrice = selectedSheet ? getDisplayPrice(selectedSheet) : 0;
  const selectedSheetIsFavorite = selectedSheet ? favoriteIds.has(selectedSheet.id) : false;
  const selectedSheetFavoriteLoading = selectedSheet ? favoriteLoadingIds.has(selectedSheet.id) : false;

  const handleMobileSheetSelect = (sheet: DrumSheet) => {
    setSelectedSheet(sheet);
    setIsMobileDetailOpen(true);
  };

  const closeMobileDetail = () => {
    setIsMobileDetailOpen(false);
    setSelectedSheet(null);
  };

  const handlePreviewOpen = (sheet: DrumSheet) => {
    const previewUrl = sheet.preview_image_url || sheet.pdf_url;
    if (!previewUrl) {
      alert('미리보기를 제공하지 않는 악보입니다.');
      return;
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleYoutubeOpen = (sheet: DrumSheet) => {
    if (!sheet.youtube_url) {
      alert('등록된 유튜브 영상이 없습니다.');
      return;
    }
    const href = sheet.youtube_url.startsWith('http')
      ? sheet.youtube_url
      : `https://www.youtube.com/watch?v=${sheet.youtube_url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="hidden md:block">
      <MainHeader user={user} />
      </div>

      {/* User Sidebar - 데스크톱 전용 */}
      <div className="hidden lg:block">
      <UserSidebar user={user} />
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden pt-[76px] pb-[96px] space-y-6">
        <div className="px-4 space-y-6">
          {bankTransferInfo ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-900">무통장입금 안내</h3>
                <button
                  type="button"
                  onClick={() => setBankTransferInfo(null)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  닫기
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <span className="font-medium text-gray-900">은행</span> {bankTransferInfo.bankName}
                </div>
                <div>
                  <span className="font-medium text-gray-900">계좌번호</span> {bankTransferInfo.accountNumber}
                </div>
                <div>
                  <span className="font-medium text-gray-900">예금주</span> {bankTransferInfo.depositor}
                </div>
                <div>
                  <span className="font-medium text-gray-900">입금금액</span>{' '}
                                    {formatCurrency(bankTransferInfo.amount ?? 0)}
                </div>
                {bankTransferInfo.expectedDepositor ? (
                  <div>
                    <span className="font-medium text-gray-900">입금자명</span>{' '}
                    <span className="text-blue-600 font-semibold">{bankTransferInfo.expectedDepositor}</span>
                  </div>
                ) : null}
                {bankTransferInfo.message ? (
                  <p className="text-xs text-gray-600">{bankTransferInfo.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {genreList.map((genre) => {
                const category = categories.find((cat) => cat.name === genre);
                const categoryId = category?.id || '';
                const isSelected = selectedCategory === categoryId;
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleCategorySelect(categoryId)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Top 5 */}
          {!loading && topSheets.length > 0 && (
            <div className="px-4 space-y-3">
              <h2 className="text-lg font-bold text-gray-900">TOP 5</h2>
              <div className="space-y-2">
                {topSheets.map((sheet, index) => {
                  const isActive = sheet.id === selectedTopSheetId;
                  const eventInfo = getEventForSheet(sheet.id);
                  const displayPrice = getDisplayPrice(sheet);
                  return (
                    <div key={sheet.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTopSheetId((prev) => (prev === sheet.id ? null : sheet.id));
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 transition ${
                          isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="text-sm font-semibold text-gray-500">{index + 1}</span>
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-bold text-gray-900">{sheet.title}</p>
                        <p className="truncate text-xs text-gray-500">{sheet.artist}</p>
                      </div>
                        </div>
                        <i className={`ri-arrow-${isActive ? 'up' : 'down'}-s-line text-gray-400 text-lg`} />
                      </button>
                      {isActive && (
                        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200">
                              <img
                                src={getThumbnailUrl(sheet)}
                                alt={sheet.title}
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                  const img = event.target as HTMLImageElement;
                                  img.src = generateDefaultThumbnail(320, 320);
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate text-sm font-bold text-gray-900">{sheet.title}</p>
                              <p className="truncate text-xs text-gray-500">{sheet.artist}</p>
                              <p className="truncate text-xs text-gray-400">{sheet.album_name || '앨범 정보 없음'}</p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {sheet.categories?.name || '기타'} · {sheet.difficulty || '난이도 정보 없음'}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1 text-right">
                              {eventInfo ? (
                                <>
                                  <span className="text-xs text-gray-400 line-through">
                                    {formatCurrency(sheet.price)}
                                  </span>
                                  <span className="text-lg font-extrabold text-blue-600">
                                    {formatCurrency(displayPrice)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-lg font-extrabold text-blue-600">
                                  {formatCurrency(displayPrice)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddToCart(sheet.id)}
                              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              장바구니
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBuyNow(sheet.id)}
                              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                            >
                              바로구매
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mobile Sheets List */}
          <div className="space-y-4">
            {loading && (
              <div className="py-16 text-center text-gray-500">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500" />
                악보를 불러오는 중입니다...
              </div>
            )}

            {!loading && paginatedSheets.length === 0 && (
              <div className="py-16 text-center text-gray-500">
                <i className="ri-file-music-line mb-4 text-4xl text-gray-300" />
                <p className="font-semibold text-gray-600">검색 결과가 없습니다.</p>
              </div>
            )}

            {!loading &&
              paginatedSheets.map((sheet) => {
                const eventInfo = getEventForSheet(sheet.id);
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
                      <p className="truncate text-xs text-gray-400">{sheet.album_name || '앨범 정보 없음'}</p>
                      <div className="pt-1 text-sm font-semibold text-blue-600">
                        {eventInfo ? (
                          <>
                            <span className="mr-2 text-xs text-gray-400 line-through">
                              {formatCurrency(sheet.price)}
                            </span>
                            {formatCurrency(displayPrice)}
                          </>
                        ) : (
                          formatCurrency(displayPrice)
                        )}
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
      {selectedSheet && isMobileDetailOpen && (
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
                {selectedSheet.album_name && <p>앨범: {selectedSheet.album_name}</p>}
                {selectedSheet.difficulty && <p>난이도: {selectedSheet.difficulty}</p>}
                {selectedSheet.page_count ? <p>페이지: {selectedSheet.page_count}p</p> : null}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-right">
                  {selectedEventInfo ? (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(selectedSheet.price)}
                      </span>
                      <span className="text-2xl font-extrabold text-red-500">
                        {formatCurrency(selectedDisplayPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-extrabold text-blue-600">
                      {formatCurrency(selectedDisplayPrice)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(selectedSheet.id)}
                  disabled={selectedSheetFavoriteLoading}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                    selectedSheetIsFavorite
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
                    악보 미리보기
                  </button>
                )}
                {selectedSheet.youtube_url && (
                  <button
                    type="button"
                    onClick={() => handleYoutubeOpen(selectedSheet)}
                    className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-red-600"
                  >
                    유튜브 재생
                  </button>
                )}
              </div>
              {bankTransferInfo ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                  <h4 className="font-semibold text-blue-900 mb-2">무통장입금 안내</h4>
                  <div className="space-y-1">
                    <p>은행: {bankTransferInfo.bankName}</p>
                    <p>계좌번호: {bankTransferInfo.accountNumber}</p>
                    <p>예금주: {bankTransferInfo.depositor}</p>
                    <p>입금금액: {formatCurrency(bankTransferInfo.amount ?? 0)}</p>
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
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  장바구니
                </button>
                <button
                  type="button"
                  onClick={() => handleBuyNow(selectedSheet.id)}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  바로 구매
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/sheet-detail/${selectedSheet.id}`)}
                className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                상세 페이지로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:block md:mr-0 lg:mr-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {bankTransferInfo ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-blue-900">무통장입금 안내</h3>
              <button
                type="button"
                onClick={() => setBankTransferInfo(null)}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                닫기
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <span className="font-medium text-gray-900">은행</span> {bankTransferInfo.bankName}
              </div>
              <div>
                <span className="font-medium text-gray-900">계좌번호</span> {bankTransferInfo.accountNumber}
              </div>
              <div>
                <span className="font-medium text-gray-900">예금주</span> {bankTransferInfo.depositor}
              </div>
              <div>
                <span className="font-medium text-gray-900">입금금액</span>{' '}
                {formatCurrency(bankTransferInfo.amount ?? 0)}
              </div>
              {bankTransferInfo.expectedDepositor ? (
                <div className="sm:col-span-2">
                  <span className="font-medium text-gray-900">입금자명</span>{' '}
                  <span className="text-blue-600 font-semibold">{bankTransferInfo.expectedDepositor}</span>
                </div>
              ) : null}
            </div>
            {bankTransferInfo.message ? (
              <p className="mt-3 text-xs text-gray-600">{bankTransferInfo.message}</p>
            ) : null}
          </div>
        ) : null}

        {/* 페이지 제목 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {selectedArtist ? `${selectedArtist}의 곡` : selectedAlbum ? `${selectedAlbum} 앨범` : '드럼 악보 카테고리'}
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
              ← 전체 악보로 돌아가기
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
              ← 전체 악보로 돌아가기
            </button>
          )}
          {!selectedArtist && !selectedAlbum && (
            <p className="text-gray-600">원하는 장르와 스타일의 드럼 악보를 찾아보세요</p>
          )}
        </div>

        {/* 장르 하위 메뉴 */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex flex-wrap gap-3">
            {genreList.map((genre) => {
              const category = categories.find(cat => cat.name === genre);
              const isSelected = selectedCategory === (category?.id || '');
              return (
                <button
                  key={genre}
                  onClick={() => {
                    const categoryId = category?.id || '';
                    handleCategorySelect(categoryId);
                  }}
                  className={`px-5 py-3 text-base font-semibold transition-all rounded-t-lg ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* TOP 5 섹션 */}
        {!loading && topSheets.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">TOP 5</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: TOP 5 리스트 */}
              <div className="space-y-2">
                {topSheets.map((sheet, index) => {
                  const isFavorite = favoriteIds.has(sheet.id);
                  const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => setSelectedSheet(sheet)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedSheet?.id === sheet.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-lg font-bold ${
                              selectedSheet?.id === sheet.id ? 'text-blue-600' : 'text-gray-400'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <img
                            src={getThumbnailUrl(sheet)}
                            alt={sheet.title}
                            className="w-12 h-12 object-cover rounded border border-gray-200 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{sheet.title}</p>
                            <p className="text-sm text-gray-600 truncate">{sheet.artist}</p>
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
                          aria-label={isFavorite ? '찜 해제' : '찜하기'}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 오른쪽: 선택된 악보 상세 정보 */}
              {selectedSheet && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4 mb-4">
                    <img
                      src={getThumbnailUrl(selectedSheet)}
                      alt={selectedSheet.title}
                      className="w-48 h-48 object-cover rounded-lg border border-gray-300 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedSheet.title}</h3>
                      <p className="text-gray-600 mb-2">{selectedSheet.artist}</p>
                      {selectedEventInfo && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 mb-3">
                          <span>🔥</span> 이벤트 할인악보 (100원)
                        </span>
                      )}
                      {selectedSheet.categories?.name && (
                        <p className="text-sm text-gray-500 mb-1">{selectedSheet.categories.name}</p>
                      )}
                      {selectedSheet.difficulty && (
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>
                            {selectedSheet.difficulty === 'beginner'
                              ? '초급'
                              : selectedSheet.difficulty === 'intermediate'
                              ? '중급'
                              : '고급'}
                            {selectedSheet.page_count && ` / ${selectedSheet.page_count}P`}
                          </p>
                          <p>
                            난이도 :{' '}
                            {selectedSheet.difficulty === 'beginner'
                              ? '초급'
                              : selectedSheet.difficulty === 'intermediate'
                              ? '중급'
                              : '고급'}
                          </p>
                          {selectedSheet.page_count && <p>페이지수 : {selectedSheet.page_count}페이지</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(selectedSheet.id)}
                        disabled={selectedSheetFavoriteLoading}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                          selectedSheetIsFavorite
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                        } ${selectedSheetFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label={selectedSheetIsFavorite ? '찜 해제' : '찜하기'}
                      >
                        <i className={`ri-heart-${selectedSheetIsFavorite ? 'fill' : 'line'} text-xl`} />
                      </button>
                      <button type="button" className="text-gray-400 hover:text-gray-600">
                        <i className="ri-information-line text-xl"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-end mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex flex-col items-end space-y-1">
                          {selectedEventInfo ? (
                            <>
                              <span className="text-sm text-gray-400 line-through">
                                {formatCurrency(selectedSheet.price)}
                              </span>
                              <span className="text-2xl font-extrabold text-red-500">
                                {formatCurrency(selectedDisplayPrice)}
                              </span>
                            </>
                          ) : (
                            <span className="text-2xl font-bold text-gray-900">
                              {formatCurrency(selectedDisplayPrice)}
                            </span>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isInCart(selectedSheet.id)}
                          onChange={() => handleAddToCart(selectedSheet.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-end">
                        <span className="font-bold text-gray-900">
                          TOTAL {formatCurrency(selectedDisplayPrice)}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAddToCart(selectedSheet.id)}
                          className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          장바구니 담기
                        </button>
                        <button
                          onClick={() => handleBuyNow(selectedSheet.id)}
                          disabled={buyingSheetId === selectedSheet.id}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {buyingSheetId === selectedSheet.id ? '구매 중...' : '바로 구매'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 필터 및 정렬 - 기본적으로 숨김 */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <i className="ri-filter-line w-4 h-4"></i>
                <span>필터</span>
                <i className={`ri-arrow-${showFilters ? 'up' : 'down'}-s-line w-4 h-4`}></i>
              </button>
              
              <button
                onClick={() => setShowSortFilter(!showSortFilter)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <i className="ri-sort-desc w-4 h-4"></i>
                <span>정렬</span>
                <i className={`ri-arrow-${showSortFilter ? 'up' : 'down'}-s-line w-4 h-4`}></i>
              </button>
            </div>
          </div>
          
          {/* 정렬 옵션 - 클릭시 표시 */}
          {showSortFilter && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">정렬:</label>
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
                  <option value="newest">최신순</option>
                  <option value="popular">인기순</option>
                  <option value="price-low">가격 낮은순</option>
                  <option value="price-high">가격 높은순</option>
                </select>
              </div>
            </div>
          )}
          
          {/* 확장 필터 */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-8"
                  >
                    <option value="">전체 카테고리</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">난이도</label>
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
                    <option value="">전체 난이도</option>
                    <option value="beginner">초급</option>
                    <option value="intermediate">중급</option>
                    <option value="advanced">고급</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">가격 범위</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      placeholder="최소"
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
                      placeholder="최대"
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
                  필터 초기화
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
                  <th className="w-[34%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">곡명</th>
                  <th className="w-[18%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">아티스트</th>
                  <th className="w-[24%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">앨범</th>
                  <th className="w-[24%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구매</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSheets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      악보가 없습니다.
                    </td>
                  </tr>
                ) : (
                paginatedSheets.map((sheet) => {
                  const eventInfo = getEventForSheet(sheet.id);
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
                            {eventInfo && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 flex-shrink-0 whitespace-nowrap">
                                이벤트 할인악보
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs flex-shrink-0">
                            {eventInfo ? (
                              <>
                                <span className="text-gray-400 line-through">
                                  {formatCurrency(sheet.price)}
                                </span>
                                <span className="font-semibold text-red-500">
                                  {formatCurrency(displayPrice)}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(displayPrice)}
                              </span>
                            )}
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
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                            isFavorite
                              ? 'border-red-200 bg-red-50 text-red-500'
                              : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                          } ${isFavoriteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                          aria-label={isFavorite ? '찜 해제' : '찜하기'}
                        >
                          <i className={`ri-heart-${isFavorite ? 'fill' : 'line'} text-lg`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(sheet.id);
                          }}
                          className="px-4 py-2.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                        >
                          장바구니
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleBuyNow(sheet.id);
                          }}
                          disabled={buyingSheetId === sheet.id || paymentProcessing}
                          className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {buyingSheetId === sheet.id
                            ? paymentProcessing
                              ? '결제 준비 중...'
                              : '구매 중...'
                            : '바로구매'}
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 1
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === totalPages
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">🎧 악보를 불러오는 중입니다. 잠시만 기다려주세요!</h3>
          </div>
        )}

        {/* 빈 상태 - 로딩이 완료되었고 결과가 없을 때만 표시 */}
        {!loading && paginatedSheets.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-file-music-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
          </div>
        )}
        </div>
      </div>

      <BankTransferInfoModal
        open={showBankTransferModal}
        amount={
          pendingPurchaseSheet
            ? Math.max(
                0,
                (getEventForSheet(pendingPurchaseSheet.id)?.discount_price ?? pendingPurchaseSheet.price) ?? 0,
              )
            : 0
        }
        userName={(user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined}
        onConfirm={handleBankTransferConfirm}
        onClose={() => {
          setShowBankTransferModal(false);
          setShowPaymentSelector(true);
        }}
      />

      <PaymentMethodSelector
        open={showPaymentSelector}
        amount={
          pendingPurchaseSheet
            ? Math.max(
                0,
                (
                  getEventForSheet(pendingPurchaseSheet.id)?.discount_price ?? pendingPurchaseSheet.price
                ) ?? 0,
              )
            : 0
        }
        onClose={() => {
          setShowPaymentSelector(false);
          setPendingPurchaseSheet(null);
          setBuyingSheetId(null);
          setPaymentProcessing(false);
        }}
        onSelect={handlePurchaseMethodSelect}
      />
    </div>
  );
};

export default CategoriesPage;
