import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import MainHeader from '../../components/common/MainHeader';
import { useSiteLanguage } from '../../hooks/useSiteLanguage';
import Seo from '../../components/Seo';
import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { startSheetPurchase } from '../../lib/payments';
import { BankTransferInfoModal, PaymentMethodSelector, PayPalPaymentModal } from '../../components/payments';
import { VirtualAccountInfoModal } from '../../components/payments/VirtualAccountInfoModal';
import type { PaymentMethod, PaymentMethodOption, VirtualAccountInfo } from '../../lib/payments';
import { useUserCredits } from '../../hooks/useUserCredits';

interface Collection {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  is_active: boolean;
  created_at: string;
  title_translations?: Record<string, string> | null;
  description_translations?: Record<string, string> | null;
}

interface CollectionSheet {
  id: string;
  collection_id: string;
  drum_sheet_id: string;
  drum_sheets?: {
    id: string;
    title: string;
    artist: string;
    thumbnail_url?: string;
    price: number;
  } | null;
}

const CollectionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { isKoreanSite } = useSiteLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [collectionSheets, setCollectionSheets] = useState<CollectionSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [virtualAccountInfo, setVirtualAccountInfo] = useState<VirtualAccountInfo | null>(null);
  const [showVirtualAccountModal, setShowVirtualAccountModal] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const { credits } = useUserCredits(user);

  // 현재 언어에 맞는 제목/설명 가져오기
  const getCollectionTitle = (collection: Collection): string => {
    const currentLang = i18n.language;
    const targetLang = currentLang === 'ko' ? 'ko' : 'en';
    
    if (targetLang === 'ko') {
      return collection.title;
    }
    
    return collection.title_translations?.['en'] || collection.title;
  };

  const getCollectionDescription = (collection: Collection): string => {
    const currentLang = i18n.language;
    const targetLang = currentLang === 'ko' ? 'ko' : 'en';
    
    if (targetLang === 'ko') {
      return collection.description || '';
    }
    
    return collection.description_translations?.['en'] || collection.description || '';
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (id) {
      loadCollection();
      loadCollectionSheets();
    }
  }, [id]);

  const loadCollection = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (collectionError) {
        if (collectionError.code === 'PGRST116') {
          setError(t('collectionsDetail.errors.collectionNotFound'));
        } else {
          setError(t('collectionsDetail.errors.loadError'));
        }
        return;
      }

      if (!data) {
        setError(t('collectionsDetail.errors.collectionNotAvailable'));
        return;
      }

      setCollection(data);
    } catch (err) {
      console.error('모음집 로드 오류:', err);
      setError(t('collectionsDetail.errors.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionSheets = async () => {
    if (!id) return;
    
    try {
      const { data, error: sheetsError } = await supabase
        .from('collection_sheets')
        .select(`
          id,
          collection_id,
          drum_sheet_id,
          drum_sheets (
            id,
            title,
            artist,
            thumbnail_url,
            price
          )
        `)
        .eq('collection_id', id);

      if (sheetsError) {
        console.error('모음집 악보 로드 오류:', sheetsError);
        return;
      }

      setCollectionSheets(data || []);
    } catch (err) {
      console.error('모음집 악보 로드 오류:', err);
    }
  };

  // 통화 로직 적용 (locale 기반)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname, i18n.language);

  const formatPrice = (price: number): string => {
    if (price === 0) return t('collectionsDetail.free');
    const convertedAmount = convertFromKrw(price, currency);
    return formatCurrencyUtil(convertedAmount, currency);
  };

  const calculateTotalIndividualPrice = (): number => {
    return collectionSheets.reduce((total, item) => {
      return total + (item.drum_sheets?.price || 0);
    }, 0);
  };

  if (loading) {
    return (
      <>
        <MainHeader user={user} />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <i className="ri-loader-4-line w-8 h-8 animate-spin text-blue-600 mx-auto mb-4"></i>
            <p className="text-gray-600">{t('collectionsDetail.loading')}</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !collection) {
    return (
      <>
        <MainHeader user={user} />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || t('collectionsDetail.errors.collectionNotFound')}</p>
            <button
              onClick={() => navigate('/collections')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('collectionsDetail.backToList')}
            </button>
          </div>
        </div>
      </>
    );
  }

  const totalIndividualPrice = calculateTotalIndividualPrice();
  const collectionPrice = collection.sale_price > 0 ? collection.sale_price : collection.original_price;
  const savings = totalIndividualPrice - collectionPrice;

  const handleBuyCollection = async () => {
    if (!user) {
      const redirectPath = window.location.pathname;
      navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    if (!collection || collectionSheets.length === 0) {
      alert(t('collectionsDetail.errors.noSheets'));
      return;
    }

    if (!isKoreanSite) {
      setShowPayPalModal(true);
      return;
    }

    setShowPaymentSelector(true);
  };

  const handlePaymentMethodSelect = async (method: PaymentMethod, option?: PaymentMethodOption) => {
    if (!user || !collection) return;

    setShowPaymentSelector(false);

    // 무통장입금 (수동) - 모달만 열기
    if (method === 'bank_transfer') {
      setShowBankTransferModal(true);
      return;
    }

    // PayPal - 모달만 열기
    if (method === 'paypal') {
      setShowPayPalModal(true);
      return;
    }

    setPurchasing(true);
    setPaymentProcessing(true);

    try {
      const items = collectionSheets
        .filter(item => item.drum_sheets)
        .map(item => ({
          sheetId: item.drum_sheets!.id,
          sheetTitle: item.drum_sheets!.title,
          price: item.drum_sheets!.price,
        }));

      if (items.length === 0) {
        alert(t('collectionsDetail.errors.noSheets'));
        setPurchasing(false);
        setPaymentProcessing(false);
        return;
      }

      const collectionTitle = getCollectionTitle(collection);
      const description = `${t('collectionsDetail.purchase.collection')}: ${collectionTitle}`;

      // 카카오페이
      if (method === 'kakaopay') {
        try {
          const orderResult = await startSheetPurchase({
            userId: user.id,
            items,
            amount: collectionPrice,
            paymentMethod: 'kakaopay',
            description,
            buyerName: user.email ?? null,
            buyerEmail: user.email ?? null,
          });

          const { requestKakaoPayPayment } = await import('../../lib/payments/portone');
          const paymentResult = await requestKakaoPayPayment({
            userId: user.id,
            amount: collectionPrice,
            orderId: orderResult.orderId,
            buyerEmail: user.email ?? undefined,
            buyerName: user.email ?? undefined,
            description,
            onSuccess: (response) => {
              console.log('[collection-detail] KakaoPay 결제 성공', response);
            },
            onError: (error) => {
              console.error('[collection-detail] KakaoPay 결제 실패', error);
              alert(t('collectionsDetail.purchase.error'));
              setPurchasing(false);
              setPaymentProcessing(false);
            },
          });

          if (!paymentResult.success) {
            throw new Error(paymentResult.error_msg || 'KakaoPay 결제가 실패했습니다.');
          }
        } catch (error) {
          console.error('KakaoPay 결제 오류:', error);
          alert(error instanceof Error ? error.message : t('collectionsDetail.purchase.error'));
        } finally {
          setPurchasing(false);
          setPaymentProcessing(false);
        }
        return;
      }

      // 신용카드, 무통장입금(가상계좌), 실시간 계좌이체 - KG이니시스
      if (method === 'card' || method === 'virtual_account' || method === 'transfer') {
        if (!option || !option.payMethod) {
          alert('결제 수단 정보가 올바르지 않습니다.');
          setPurchasing(false);
          setPaymentProcessing(false);
          return;
        }

        try {
          const result = await startSheetPurchase({
            userId: user.id,
            items,
            amount: collectionPrice,
            paymentMethod: 'inicis',
            inicisPayMethod: option.payMethod as 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER',
            description,
            buyerName: user.email ?? null,
            buyerEmail: user.email ?? null,
            onSuccess: (response) => {
              console.log('[collection-detail] KG이니시스 결제 성공', response);
              
              // 가상계좌인 경우 안내 모달 표시
              if (option.payMethod === 'VIRTUAL_ACCOUNT' && response.virtualAccountInfo) {
                setVirtualAccountInfo({
                  bankName: response.virtualAccountInfo.bankName,
                  accountNumber: response.virtualAccountInfo.accountNumber,
                  accountHolder: response.virtualAccountInfo.accountHolder,
                  depositor: response.virtualAccountInfo.accountHolder,
                  amount: collectionPrice,
                  expiresAt: response.virtualAccountInfo.expiresAt,
                });
                setShowVirtualAccountModal(true);
              }
              
              setPurchasing(false);
              setPaymentProcessing(false);
              // 가상계좌가 아닌 경우는 결제 완료 처리
              if (option.payMethod !== 'VIRTUAL_ACCOUNT') {
                alert(t('collectionsDetail.purchase.paymentWindowOpen') || '결제창이 열렸습니다.');
              }
            },
            onError: (error) => {
              console.error('[collection-detail] KG이니시스 결제 실패', error);
              setPurchasing(false);
              setPaymentProcessing(false);
              alert(error instanceof Error ? error.message : t('collectionsDetail.purchase.error'));
            },
          });
        } catch (error) {
          console.error('KG이니시스 결제 오류:', error);
          alert(error instanceof Error ? error.message : t('collectionsDetail.purchase.error'));
          setPurchasing(false);
          setPaymentProcessing(false);
        }
        return;
      }

      // 캐시 잔액 결제
      if (method === 'cash') {
        // 캐시 결제는 별도 처리 필요
        alert(t('collectionsDetail.purchase.cashNotSupported') || '캐시 결제는 준비 중입니다.');
        setPurchasing(false);
        setPaymentProcessing(false);
      }
    } catch (error) {
      console.error('모음집 구매 오류:', error);
      alert(error instanceof Error ? error.message : t('collectionsDetail.purchase.error'));
      setPurchasing(false);
      setPaymentProcessing(false);
    }
  };

  const handleBankTransferConfirm = async (depositorName: string) => {
    if (!user || !collection) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 필수값 검증
    const trimmedDepositorName = depositorName?.trim();
    if (!trimmedDepositorName) {
      alert('입금자명을 입력해 주세요.');
      return;
    }

    if (!collectionPrice || collectionPrice <= 0) {
      alert('결제 금액이 올바르지 않습니다.');
      return;
    }

    setPaymentProcessing(true);
    setPurchasing(true);

    try {
      const items = collectionSheets
        .filter(item => item.drum_sheets)
        .map(item => ({
          sheetId: item.drum_sheets!.id,
          sheetTitle: item.drum_sheets!.title,
          price: item.drum_sheets!.price,
        }));

      if (items.length === 0) {
        alert(t('collectionsDetail.errors.noSheets'));
        setPurchasing(false);
        setPaymentProcessing(false);
        return;
      }

      const collectionTitle = getCollectionTitle(collection);
      const description = `${t('collectionsDetail.purchase.collection')}: ${collectionTitle}`;

      const result = await startSheetPurchase({
        userId: user.id,
        items,
        amount: collectionPrice,
        paymentMethod: 'bank_transfer',
        description,
        buyerName: user.email ?? null,
        buyerEmail: user.email ?? null,
        depositorName: trimmedDepositorName,
      });

      // 성공 메시지
      if (result.virtualAccountInfo) {
        setVirtualAccountInfo(result.virtualAccountInfo);
        setShowBankTransferModal(false);
        setShowVirtualAccountModal(true);
      } else if (result.bankTransferInfo) {
        setBankTransferInfo(result.bankTransferInfo);
        // 모달은 이미 열려있으므로 정보만 업데이트
      } else {
        alert(t('collectionsDetail.purchase.bankTransferCreated') || '무통장 입금 주문이 생성되었습니다.');
        setShowBankTransferModal(false);
      }
    } catch (error) {
      console.error('[CollectionDetail] 무통장입금 구매 오류:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : t('collectionsDetail.purchase.error') || '주문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      
      alert(errorMessage);
    } finally {
      setPurchasing(false);
      setPaymentProcessing(false);
    }
  };

  const handlePayPalInitiate = async (elementId: string) => {
    if (!user || !collection) return;

    try {
      const items = collectionSheets
        .filter(item => item.drum_sheets)
        .map(item => ({
          sheetId: item.drum_sheets!.id,
          sheetTitle: item.drum_sheets!.title,
          price: item.drum_sheets!.price,
        }));

      if (items.length === 0) {
        alert(t('collectionsDetail.errors.noSheets'));
        return;
      }

      const collectionTitle = getCollectionTitle(collection);
      const description = `${t('collectionsDetail.purchase.collection')}: ${collectionTitle}`;

      await startSheetPurchase({
        userId: user.id,
        items,
        amount: collectionPrice,
        paymentMethod: 'paypal',
        description,
        buyerName: user.email ?? null,
        buyerEmail: user.email ?? null,
        elementId, // PayPal SPB 렌더링을 위한 컨테이너 ID 전달
      });
    } catch (error) {
      console.error('PayPal 결제 오류:', error);
      alert(error instanceof Error ? error.message : t('collectionsDetail.purchase.error'));
    }
  };

  return (
    <>
      <Seo
        title={getCollectionTitle(collection)}
        description={getCollectionDescription(collection)}
      />
      <MainHeader user={user} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => navigate('/collections')}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            {t('collectionsDetail.backToList')}
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 왼쪽: 모음집 정보 */}
            <div className="lg:col-span-2">
              {/* 썸네일 */}
              {collection.thumbnail_url && (
                <div className="mb-6 aspect-video w-full overflow-hidden bg-gray-100 rounded-xl relative">
                  <img
                    src={collection.thumbnail_url}
                    alt={getCollectionTitle(collection)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                  {/* 가성비 강조 배너 - 썸네일 하단 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white text-lg font-bold">
                      {i18n.language === 'ko' 
                        ? `${collectionSheets.length}곡을 단돈 ${formatPrice(collectionPrice)}에`
                        : `${collectionSheets.length} songs for just ${formatPrice(collectionPrice)}`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* 제목 및 설명 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-50 rounded">
                    {t('collectionsDetail.badge')}
                  </span>
                  {collection.discount_percentage > 0 && (
                    <span className="px-3 py-1 text-sm font-semibold text-red-600 bg-red-50 rounded">
                      {t('collectionsDetail.discount', { percentage: collection.discount_percentage })}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                  {getCollectionTitle(collection)}
                </h1>

                {/* 가성비 강조 문구 - 제목 하단 */}
                <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-lg font-bold text-blue-700">
                    {i18n.language === 'ko' 
                      ? `🎵 ${collectionSheets.length}곡을 단돈 ${formatPrice(collectionPrice)}에!`
                      : `🎵 ${collectionSheets.length} songs for just ${formatPrice(collectionPrice)}!`
                    }
                  </p>
                  {savings > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {i18n.language === 'ko'
                        ? `개별 구매 대비 ${formatPrice(savings)} 절약`
                        : `Save ${formatPrice(savings)} compared to individual purchase`
                      }
                    </p>
                  )}
                </div>

                {getCollectionDescription(collection) && (
                  <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap">
                    {getCollectionDescription(collection)}
                  </p>
                )}
              </div>

              {/* 포함된 악보 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {t('collectionsDetail.includedSheets.title')} ({collectionSheets.length}{t('collectionsDetail.includedSheets.number', { count: collectionSheets.length }).replace(collectionSheets.length.toString(), '')})
                </h2>
                <p className="text-gray-600 mb-6">
                  {t('collectionsDetail.includedSheets.description')}
                </p>

                {collectionSheets.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {t('collectionsDetail.includedSheets.empty')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {collectionSheets.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/sheet-detail/${item.drum_sheet_id}`)}
                        className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {item.drum_sheets?.thumbnail_url && (
                          <img
                            src={item.drum_sheets.thumbnail_url}
                            alt={item.drum_sheets.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {item.drum_sheets?.title}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">
                            {item.drum_sheets?.artist}
                          </p>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {formatPrice(item.drum_sheets?.price || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: 구매 정보 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {t('collectionsDetail.purchase.priceInfo')}
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {t('collectionsDetail.purchase.totalIndividual')}
                    </p>
                    <p className="text-xl font-semibold text-gray-500 line-through">
                      {totalIndividualPrice > 0 ? formatPrice(totalIndividualPrice) : t('collectionsDetail.purchase.noInfo')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {t('collectionsDetail.purchase.collectionPrice')}
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatPrice(collectionPrice)}
                    </p>
                  </div>

                  {savings > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-600 mb-1">
                        {t('collectionsDetail.purchase.save', { amount: formatPrice(savings) })}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleBuyCollection}
                  disabled={!collection.is_active || purchasing}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                    collection.is_active && !purchasing
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {purchasing
                    ? t('collectionsDetail.purchase.processing') || '처리 중...'
                    : collection.is_active
                    ? t('collectionsDetail.purchase.buyNow')
                    : t('collectionsDetail.purchase.inactive')}
                </button>

                {!collection.is_active && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    {t('collectionsDetail.purchase.note')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 결제 모달 */}
      <PaymentMethodSelector
        open={showPaymentSelector}
        amount={collectionPrice}
        onSelect={handlePaymentMethodSelect}
        onClose={() => setShowPaymentSelector(false)}
        context="buyNow"
        userCredits={credits}
      />

      <BankTransferInfoModal
        open={showBankTransferModal}
        amount={collectionPrice}
        userName={(user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined}
        onConfirm={handleBankTransferConfirm}
        onClose={() => {
          setShowBankTransferModal(false);
          setBankTransferInfo(null);
        }}
        processing={paymentProcessing}
        orderCreated={!!bankTransferInfo}
        successMessage={t('collectionsDetail.purchase.bankTransferCreated') || '무통장입금 계좌가 생성되었습니다. 입금을 완료해주세요.'}
      />

      <VirtualAccountInfoModal
        open={showVirtualAccountModal}
        virtualAccountInfo={virtualAccountInfo}
        amount={collectionPrice}
        onClose={() => {
          setShowVirtualAccountModal(false);
          setVirtualAccountInfo(null);
        }}
      />

      {showPayPalModal && collection && (
        <PayPalPaymentModal
          open={showPayPalModal}
          amount={collectionPrice}
          orderTitle={getCollectionTitle(collection)}
          onClose={() => setShowPayPalModal(false)}
          onSuccess={(response) => {
            setShowPayPalModal(false);
            // PayPal은 리다이렉트되므로 여기서 추가 처리 불필요할 수 있음
          }}
          onError={(error) => {
            console.error('PayPal 결제 오류:', error);
            alert(t('collectionsDetail.purchase.error'));
          }}
          initiatePayment={handlePayPalInitiate}
        />
      )}
    </>
  );
};

export default CollectionDetailPage;
