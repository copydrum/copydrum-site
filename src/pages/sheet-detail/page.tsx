
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Download, Star, ShoppingCart, Music, Clock, DollarSign, ZoomIn, Eye, X } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import UserSidebar from '../../components/feature/UserSidebar';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import type { EventDiscountSheet } from '../../lib/eventDiscounts';
import { fetchEventDiscountBySheetId, isEventActive, purchaseEventDiscount } from '../../lib/eventDiscounts';
import { processCashPurchase } from '../../lib/cashPurchases';
import { isFavorite, toggleFavorite } from '../../lib/favorites';
import { hasPurchasedSheet } from '../../lib/purchaseCheck';
import { BankTransferInfoModal, PaymentMethodSelector } from '../../components/payments';
import { startSheetPurchase } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { openCashChargeModal } from '../../lib/cashChargeModal';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  category_id: string;
  difficulty: string;
  price: number;
  pdf_url: string;
  preview_image_url: string;
  thumbnail_url: string;
  youtube_url: string;
  album_name?: string;
  page_count?: number;
  tempo?: number;
  is_featured: boolean;
  created_at: string;
  categories?: { name: string } | null;
}

export default function SheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sheet, setSheet] = useState<DrumSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const { addToCart, isInCart, cartItems } = useCart();
  const [eventDiscount, setEventDiscount] = useState<EventDiscountSheet | null>(null);
  const [isFavoriteSheet, setIsFavoriteSheet] = useState(false);
  const [favoriteProcessing, setFavoriteProcessing] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const eventIsActive = eventDiscount ? isEventActive(eventDiscount) : false;
  const displayPrice = sheet ? (eventDiscount && eventIsActive ? eventDiscount.discount_price : sheet.price) : 0;
  const { i18n, t } = useTranslation();
  const formatCurrency = (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted;

  useEffect(() => {
    checkAuth();
    if (id) {
      loadSheetDetail(id);
    }
  }, [id]);

  useEffect(() => {
    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadFavoriteState = async () => {
      if (!user || !id) {
        setIsFavoriteSheet(false);
        return;
      }

      try {
        const favorite = await isFavorite(id, user.id);
        setIsFavoriteSheet(favorite);
      } catch (error) {
        console.error('찜 상태 로드 오류:', error);
      }
    };

    loadFavoriteState();
  }, [user, id]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const loadSheetDetail = async (sheetId: string) => {
    try {
      const { data, error } = await supabase
        .from('drum_sheets')
        .select('id, title, artist, difficulty, price, category_id, pdf_url, preview_image_url, thumbnail_url, youtube_url, album_name, page_count, tempo, is_featured, created_at, categories (name)')
        .eq('id', sheetId)
        .single();

      if (error) throw error;
      
      const normalizedCategory =
        Array.isArray((data as any)?.categories) && (data as any)?.categories.length > 0
          ? (data as any)?.categories[0]
          : (data as any)?.categories ?? null;

      const normalizedSheet = {
        ...(data as unknown as Partial<DrumSheet>),
        categories: normalizedCategory ? { name: normalizedCategory.name ?? '' } : null,
      } as DrumSheet;

      setSheet(normalizedSheet);

      try {
        const event = await fetchEventDiscountBySheetId(sheetId);
        setEventDiscount(event);
      } catch (eventError) {
        console.error('이벤트 할인 악보 정보 로드 오류:', eventError);
        setEventDiscount(null);
      }
    } catch (error) {
      console.error('악보 상세 정보 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getDifficultyBadgeColor = (difficulty: string) => {
    const normalizedDifficulty = (difficulty || '').toLowerCase().trim();
    switch (normalizedDifficulty) {
      case 'beginner':
      case '초급':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
      case '중급':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
      case '고급':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyDisplayText = (difficulty: string) => {
    const normalizedDifficulty = (difficulty || '').toLowerCase().trim();
    switch (normalizedDifficulty) {
      case 'beginner':
        return t('sheetDetail.difficulty.beginner');
      case 'intermediate':
        return t('sheetDetail.difficulty.intermediate');
      case 'advanced':
        return t('sheetDetail.difficulty.advanced');
      default:
        return difficulty || t('sheetDetail.difficulty.notSet');
    }
  };

  const getSheetPrice = () => {
    if (!sheet) return 0;
    const basePrice = eventDiscount && eventIsActive ? eventDiscount.discount_price : sheet.price;
    return Math.max(0, basePrice ?? 0);
  };

  const completeOnlinePurchase = async (
    method: 'card' | 'bank_transfer',
    options?: { depositorName?: string },
  ) => {
    if (!user || !sheet) return;

    const price = getSheetPrice();

    const result = await startSheetPurchase({
      userId: user.id,
      items: [{ sheetId: sheet.id, sheetTitle: sheet.title, price }],
      amount: price,
      paymentMethod: method,
      description: t('sheetDetail.purchaseDescription', { title: sheet.title }),
      buyerName: user.email ?? null,
      buyerEmail: user.email ?? null,
      // returnUrl은 productPurchase에서 자동으로 Edge Function URL 사용
      depositorName: options?.depositorName,
    });

    if (method === 'bank_transfer') {
      setBankTransferInfo(result.virtualAccountInfo ?? null);
      alert(t('sheetDetail.bankTransferCreated'));
    } else {
      setBankTransferInfo(null);
      alert(t('sheetDetail.paymentWindowOpen'));
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!sheet) return;

    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, sheet.id);
      if (alreadyPurchased) {
        alert(t('sheetDetail.alreadyPurchased'));
        return;
      }
    } catch (error) {
      console.error('구매 이력 확인 오류:', error);
      alert(t('sheetDetail.purchaseCheckError'));
      return;
    }

    setShowPaymentSelector(true);
  };

  const handlePaymentMethodSelect = async (method: 'cash' | 'card' | 'bank') => {
    if (!user || !sheet) return;

    setShowPaymentSelector(false);

    if (method === 'bank') {
      setShowBankTransferModal(true);
      return;
    }

    setPurchasing(true);
    setPaymentProcessing(true);

    const price = getSheetPrice();

    try {
      if (method === 'cash') {
        const purchaseResult = await processCashPurchase({
          userId: user.id,
          totalPrice: price,
          description: t('sheetDetail.purchaseDescription', { title: sheet.title }),
          items: [{ sheetId: sheet.id, sheetTitle: sheet.title, price }],
          sheetIdForTransaction: sheet.id,
        });

        if (!purchaseResult.success) {
          if (purchaseResult.reason === 'INSUFFICIENT_CREDIT') {
            alert(
              t('sheetDetail.insufficientCash', { 
                amount: purchaseResult.currentCredits.toLocaleString(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US')
              }),
            );
            openCashChargeModal();
          }
          return;
        }

        let message = t('sheetDetail.purchaseComplete');

        if (eventDiscount && eventIsActive) {
          try {
            const eventResult = await purchaseEventDiscount(eventDiscount);
            if (eventResult?.message) {
              message = eventResult.message;
            }
          } catch (eventError) {
            console.warn('이벤트 할인 처리 중 경고:', eventError);
          }
        }

        alert(t('sheetDetail.purchaseCompleteMessage', { message }));
        return;
      }

      if (method === 'card') {
        await completeOnlinePurchase('card');
      }
    } catch (error) {
      console.error('구매 오류:', error);
      alert(error instanceof Error ? error.message : '구매 중 오류가 발생했습니다.');
    } finally {
      setPurchasing(false);
      setPaymentProcessing(false);
    }
  };

  const handleBankTransferConfirm = async (depositorName: string) => {
    if (!user || !sheet) return;

    setShowBankTransferModal(false);
    setPurchasing(true);
    setPaymentProcessing(true);

    try {
      await completeOnlinePurchase('bank_transfer', { depositorName });
    } catch (error) {
      console.error('무통장입금 구매 오류:', error);
      alert(error instanceof Error ? error.message : t('sheetDetail.purchaseError'));
    } finally {
      setPurchasing(false);
      setPaymentProcessing(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!sheet) return;

    try {
      const alreadyPurchased = await hasPurchasedSheet(user.id, sheet.id);
      if (alreadyPurchased) {
        alert(t('sheetDetail.alreadyPurchased'));
        return;
      }
    } catch (error) {
      console.error('장바구니 담기 전 구매 이력 확인 오류:', error);
      alert(t('sheetDetail.purchaseCheckError'));
      return;
    }

    const success = await addToCart(sheet.id);
    if (success) {
      alert(t('sheetDetail.addedToCart'));
    }
  };

  const handleToggleFavorite = async () => {
    if (!id) {
      return;
    }

    if (!user) {
      alert(t('sheetDetail.loginRequired'));
      return;
    }

    setFavoriteProcessing(true);
    try {
      const favorite = await toggleFavorite(id, user.id);
      setIsFavoriteSheet(favorite);
    } catch (error) {
      console.error('찜하기 처리 오류:', error);
      alert(t('sheetDetail.favoriteError'));
    } finally {
      setFavoriteProcessing(false);
    }
  };

  const downloadPdf = async () => {
    if (!sheet?.pdf_url) return;

    try {
      const response = await fetch(sheet.pdf_url);
      const blob = await response.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${sheet.title} - ${sheet.artist}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('다운로드 오류:', error);
      alert(t('sheetDetail.downloadError'));
    }
  };

  // 썸네일 이미지 URL 가져오기
  const getThumbnailUrl = () => {
    if (!sheet) return '';

    // 1. 유튜브 URL이 있는 경우 유튜브 썸네일 우선 사용
    if (sheet.youtube_url) {
      const videoId = extractVideoId(sheet.youtube_url);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    // 2. 데이터베이스에 저장된 썸네일 URL 확인
    if (sheet.thumbnail_url) {
      return sheet.thumbnail_url;
    }
    
    // 3. 기본 썸네일 생성
    return generateDefaultThumbnail(400, 400);
  };

  // 미리보기 이미지 생성 함수
  const getPreviewImageUrl = (sheet: DrumSheet) => {
    if (sheet.preview_image_url) {
      return sheet.preview_image_url;
    }
    
    // 더 안정적인 이미지 생성 프롬프트
    const prompt = `Professional drum sheet music notation page with clear black musical notes on white paper background, drum symbols and rhythmic patterns, clean layout, high quality music manuscript paper, readable notation symbols, minimalist design, no text overlays, studio lighting`;
    
    return `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28prompt%29%7D&width=600&height=800&seq=preview-${sheet.id}&orientation=portrait`;
  };

  // 이미지 로드 실패 시 대체 이미지
  const handlePreviewImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    // 더 간단한 대체 이미지
    const fallbackPrompt = `Clean white paper with black musical notes, drum notation symbols, simple music sheet design, high contrast, professional quality`;
    img.src = `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28fallbackPrompt%29%7D&width=600&height=800&seq=fallback-${Date.now()}&orientation=portrait`;
  };

  // 유튜브 URL에서 비디오 ID 추출 함수
  const extractVideoId = (url: string): string => {
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">악보를 찾을 수 없습니다</h1>
          <button
            onClick={() => navigate('/categories')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer"
          >
            카테고리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main Header */}
      <MainHeader user={user} />

      {/* User Sidebar - 로그인 시 항상 표시 */}
      <UserSidebar user={user} />

      {/* Main Content - 로그인 시 사이드바 공간 확보 */}
      <div className={user ? 'md:mr-64' : ''}>
        {/* Back Button */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/categories');
              }
            }}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>카테고리로 돌아가기</span>
          </button>
        </div>

        {/* Main Content */}
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
                  {formatCurrency(bankTransferInfo.amount ?? getSheetPrice())}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Thumbnail Image */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <img
                  src={getThumbnailUrl()}
                  alt={`${sheet.title} ${sheet.youtube_url ? '유튜브 썸네일' : '앨범 커버'}`}
                  className="w-full h-auto object-cover object-top"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = generateDefaultThumbnail(400, 400);
                  }}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
                      <Music className="w-4 h-4 text-blue-800" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 mb-1">
                      {sheet.youtube_url ? '유튜브 썸네일' : '앨범 커버'}
                    </h4>
                    <p className="text-sm text-blue-700">
                      {getThumbnailUrl() ? 
                        (sheet.youtube_url ? 
                          '위 이미지는 해당 곡의 유튜브 썸네일입니다.' :
                          '위 이미지는 해당 곡의 앨범 커버입니다.'
                        ) :
                        '썸네일 정보가 없습니다.'
                      } 
                      실제 악보 미리보기는 아래에서 확인하실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            
            {/* 유튜브 링크 버튼 */}
            {sheet.youtube_url && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-800">유튜브에서 보기</h4>
                      <p className="text-sm text-red-700">이 악보의 연주 영상을 확인해보세요</p>
                    </div>
                  </div>
                  <a
                    href={sheet.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>유튜브 보기</span>
                  </a>
                </div>
              </div>
            )}
            </div>

            {/* Sheet Info */}
            <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{sheet.title}</h1>
                {sheet.is_featured && (
                  <Star className="w-6 h-6 text-yellow-500 fill-current" />
                )}
              </div>
              <p className="text-xl text-gray-600 mb-2">{sheet.artist}</p>
              {sheet.album_name && (
                <p className="text-lg text-gray-500 mb-2">앨범: {sheet.album_name}</p>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center space-x-1">
                  <Music className="w-4 h-4" />
                  <span>{sheet.categories?.name}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>악기파트 : 드럼</span>
                </span>
              </div>
            </div>

            {/* Difficulty Badge & Additional Info */}
            <div className="flex items-center space-x-4 mb-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDifficultyBadgeColor(sheet.difficulty)}`}>
                {getDifficultyDisplayText(sheet.difficulty)}
              </span>
              {sheet.page_count && (
                <span className="text-sm text-gray-600">
                  <i className="ri-file-line mr-1"></i>
                  {sheet.page_count}페이지
                </span>
              )}
              {sheet.tempo && (
                <span className="text-sm text-gray-600">
                  <i className="ri-speed-line mr-1"></i>
                  {sheet.tempo} BPM
                </span>
              )}
            </div>

            {eventDiscount && (
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                {eventIsActive ? (
                  <p>
                    100원 특가 이벤트 진행 중!{' '}
                    <span className="font-semibold">
                      {new Date(eventDiscount.event_start).toLocaleString('ko-KR')} ~ {new Date(eventDiscount.event_end).toLocaleString('ko-KR')}
                    </span>
                  </p>
                ) : eventDiscount.status === 'scheduled' ? (
                  <p>
                    {new Date(eventDiscount.event_start).toLocaleString('ko-KR')}부터 100원 특가 이벤트가 시작됩니다.
                  </p>
                ) : (
                  <p>이벤트가 종료되었습니다. 정상가로 구매하실 수 있습니다.</p>
                )}
              </div>
            )}

            {/* Price */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  {eventDiscount && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                      <span>🔥</span>
                      {eventIsActive ? '이벤트 할인악보' : eventDiscount.status === 'scheduled' ? '이벤트 예정' : '이벤트 종료'}
                    </span>
                  )}
                  <div className="flex flex-col">
                    {eventDiscount && eventIsActive && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(sheet.price)}
                      </span>
                    )}
                    <span className={`text-3xl font-bold ${eventDiscount && eventIsActive ? 'text-red-500' : 'text-blue-600'}`}>
                      {formatCurrency(displayPrice)}
                    </span>
                    {eventDiscount && !eventIsActive && (
                      <span className="text-xs text-gray-500 mt-1">
                        {eventDiscount.status === 'scheduled'
                          ? `${new Date(eventDiscount.event_start).toLocaleString('ko-KR')}부터 100원으로 이벤트가 시작됩니다.`
                          : '이벤트가 종료되어 정상가로 판매됩니다.'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-2">즉시 다운로드</p>
                  <p className="text-sm text-gray-500">PDF 형식</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  disabled={favoriteProcessing}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                    isFavoriteSheet
                      ? 'border-red-200 bg-red-50 text-red-500'
                      : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                  } ${favoriteProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-label={isFavoriteSheet ? '찜 해제' : '찜하기'}
                >
                  <i className={`ri-heart-${isFavoriteSheet ? 'fill' : 'line'} text-xl`} />
                </button>
              </div>
              <button
                onClick={handlePurchase}
                disabled={purchasing || paymentProcessing}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-colors"
              >
                {paymentProcessing
                  ? '결제 준비 중...'
                  : purchasing
                  ? '처리 중...'
                  : eventDiscount && eventIsActive
                  ? '100원 즉시 구매'
                  : '바로구매'}
              </button>
              
              <button
                onClick={handleAddToCart}
                disabled={!user || isInCart(sheet.id)}
                className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center space-x-2 whitespace-nowrap cursor-pointer transition-colors ${
                  isInCart(sheet.id) 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span>{isInCart(sheet.id) ? '장바구니에 담김' : '장바구니 담기'}</span>
              </button>
              
              <button
                onClick={() => setShowPreviewModal(true)}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Eye className="w-5 h-5" />
                <span>악보 미리보기</span>
              </button>
            </div>

            {/* Features */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">포함 내용</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>고품질 PDF 악보</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>인쇄 가능한 형식</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>즉시 다운로드</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>평생 이용 가능</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>가사없음</span>
                </li>
              </ul>
            </div>

            </div>
          </div>

          {/* 유튜브 영상 섹션 (유튜브 URL이 있는 경우) */}
          {sheet.youtube_url && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8 mt-12">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>연주 영상</span>
              </h3>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${extractVideoId(sheet.youtube_url)}`}
                  title={`${sheet.title} - ${sheet.artist} 연주 영상`}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-gray-600">이 악보의 연주 영상을 확인해보세요</p>
                <a
                  href={sheet.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>유튜브에서 보기</span>
                </a>
              </div>
            </div>
          )}

          {/* 악보 미리보기 섹션 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">악보 미리보기</h3>
            <div className="relative">
              <div className="aspect-[3/4] bg-gray-50 rounded-lg overflow-hidden relative">
                <img
                  src={getPreviewImageUrl(sheet)}
                  alt={`${sheet.title} 악보 미리보기`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setShowPreviewModal(true)}
                  onError={handlePreviewImageError}
                />
                
                {/* 하단 흐림 효과 */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/90 via-white/60 to-transparent"></div>
                
                {/* 미리보기 안내 */}
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <p className="text-sm text-gray-700 font-medium bg-white/80 rounded px-3 py-2">
                    전체 악보는 구매 후 확인 가능합니다
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowPreviewModal(true)}
                className="mt-4 w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                미리보기 확대
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 미리보기 확대 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">악보 미리보기</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <img
                  src={getPreviewImageUrl(sheet)}
                  alt={`${sheet.title} 악보 미리보기`}
                  className="w-full h-auto rounded"
                  onError={handlePreviewImageError}
                />
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-white/95 via-white/70 to-transparent"></div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-600 mb-4">전체 악보를 보려면 구매해주세요</p>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  구매하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-16">
        <Footer />
      </div>

      <BankTransferInfoModal
        open={showBankTransferModal}
        amount={getSheetPrice()}
        userName={(user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined}
        onConfirm={handleBankTransferConfirm}
        onClose={() => {
          setShowBankTransferModal(false);
          setShowPaymentSelector(true);
        }}
      />

      <PaymentMethodSelector
        open={showPaymentSelector}
        amount={getSheetPrice()}
        onClose={() => setShowPaymentSelector(false)}
        onSelect={handlePaymentMethodSelect}
      />
    </div>
  );
}