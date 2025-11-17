import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import UserSidebar from '../../components/feature/UserSidebar';
import MainHeader from '../../components/common/MainHeader';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { processCashPurchase } from '../../lib/cashPurchases';
import { splitPurchasedSheetIds } from '../../lib/purchaseCheck';
import { useTranslation } from 'react-i18next';
import { getTranslatedText } from '../../lib/translationHelpers';
import { formatPrice } from '../../lib/priceFormatter';

interface Collection {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  is_active: boolean;
  category_id?: string | null;
  category_ids?: string[] | null;
  created_at?: string;
  title_translations?: Record<string, string> | null;
  description_translations?: Record<string, string> | null;
}

interface Category {
  id: string;
  name: string;
}

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  price: number;
  difficulty?: string | null;
  thumbnail_url?: string | null;
}

interface CollectionSheet {
  id: string;
  collection_id: string;
  drum_sheet_id: string;
  drum_sheets?: DrumSheet | null;
}

const genreList = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버', '드럼레슨'];

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collectionSheets, setCollectionSheets] = useState<CollectionSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: currentLanguage }).formatted,
    [currentLanguage],
  );

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!collectionId) {
      setError('요청하신 모음집 정보가 없습니다.');
      setLoading(false);
      return;
    }

    const loadCollectionDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: collectionData, error: collectionError } = await supabase
          .from('collections')
          .select('id, title, description, thumbnail_url, original_price, sale_price, discount_percentage, is_active, category_id, category_ids, created_at, title_translations, description_translations')
          .eq('id', collectionId)
          .maybeSingle();

        if (collectionError) {
          throw collectionError;
        }

        if (!collectionData) {
          setError('요청하신 모음집을 찾을 수 없습니다.');
          setCollection(null);
          return;
        }

        const rawCategoryIds = Array.isArray(collectionData.category_ids)
          ? collectionData.category_ids.filter((id): id is string => Boolean(id))
          : [];

        if (rawCategoryIds.length === 0 && collectionData.category_id) {
          rawCategoryIds.push(collectionData.category_id);
        }

        if (rawCategoryIds.length > 0) {
          const { data: categoryRows, error: categoryError } = await supabase
            .from('categories')
            .select('id, name')
            .in('id', rawCategoryIds);

          if (categoryError) {
            console.error('카테고리 로드 오류:', categoryError);
            setCategories([]);
          } else {
            const sortedCategories = [...(categoryRows ?? [])].sort((a, b) => {
              const indexA = genreList.indexOf(a.name);
              const indexB = genreList.indexOf(b.name);

              if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });

            setCategories(sortedCategories);
          }
        } else {
          setCategories([]);
        }

        setCollection(collectionData);

        const { data: sheetRows, error: sheetsError } = await supabase
          .from('collection_sheets')
          .select(`
            id,
            collection_id,
            drum_sheet_id,
            drum_sheets!inner (
              id,
              title,
              artist,
              price,
              difficulty,
              thumbnail_url,
              is_active
            )
          `)
          .eq('collection_id', collectionId);

        if (sheetsError) {
          throw sheetsError;
        }

        // 비활성 악보 필터링
        const activeSheets = (sheetRows ?? []).filter(
          (row: any) => row.drum_sheets?.is_active === true
        );

        setCollectionSheets(activeSheets);
      } catch (err) {
        console.error('모음집 상세 정보 로드 오류:', err);
        setError('모음집 정보를 불러오는 중 문제가 발생했습니다.');
        setCollection(null);
        setCollectionSheets([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    loadCollectionDetail();
  }, [collectionId]);

  const translatedTitle = useMemo(() => {
    if (!collection) return '';
    return getTranslatedText(collection.title_translations, currentLanguage, collection.title);
  }, [collection, currentLanguage]);

  const translatedDescription = useMemo(() => {
    if (!collection) return '';
    return getTranslatedText(
      collection.description_translations,
      currentLanguage,
      collection.description ?? '',
    );
  }, [collection, currentLanguage]);

  const hasTranslatedDescription = translatedDescription.trim().length > 0;

  const sheetsWithDetails = useMemo(() => {
    return collectionSheets
      .map((item) => item.drum_sheets)
      .filter((sheet): sheet is DrumSheet => Boolean(sheet));
  }, [collectionSheets]);

  const totalIndividualPrice = useMemo(() => {
    return sheetsWithDetails.reduce((sum, sheet) => sum + (sheet.price || 0), 0);
  }, [sheetsWithDetails]);

  const finalPrice = useMemo(() => {
    if (!collection) return 0;
    if (collection.sale_price > 0) {
      return collection.sale_price;
    }
    return collection.original_price > 0 ? collection.original_price : 0;
  }, [collection]);

  const savings = useMemo(() => {
    if (totalIndividualPrice === 0 || finalPrice === 0) return 0;
    return Math.max(totalIndividualPrice - finalPrice, 0);
  }, [finalPrice, totalIndividualPrice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">모음집을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || '모음집 정보를 찾을 수 없습니다.'}</h1>
          <p className="text-gray-600 mb-6">요청하신 악보 모음집이 존재하지 않거나 비활성화되었습니다.</p>
          <button
            onClick={() => navigate('/collections')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            모음집 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const displayPriceLabel =
    finalPrice > 0 ? formatCurrency(finalPrice) : collection.original_price > 0 ? formatCurrency(collection.original_price) : '무료';

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!collection) return;

    const sheetDetails = sheetsWithDetails.filter((sheet) => !!sheet?.id);

    if (sheetDetails.length === 0) {
      alert('모음집에 포함된 악보 정보를 찾을 수 없습니다.');
      return;
    }

    const sheetIds = sheetDetails.map((sheet) => sheet.id);

    try {
      const { purchasedSheetIds } = await splitPurchasedSheetIds(user.id, sheetIds);
      if (purchasedSheetIds.length > 0) {
        const purchasedTitles = sheetDetails
          .filter((sheet) => purchasedSheetIds.includes(sheet.id))
          .map((sheet) => `- ${sheet.title}`);

        const duplicatesText =
          purchasedTitles.length > 0
            ? purchasedTitles.join('\n')
            : purchasedSheetIds.map((id) => `- ${id}`).join('\n');

        alert(
          [
            '이미 구매하신 악보가 모음집에 포함되어 있어 중복 구매가 불가능합니다.',
            '',
            '중복된 악보 목록:',
            duplicatesText,
            '',
            '구매 내역을 마이페이지에서 확인해주세요.',
          ].join('\n'),
        );
        return;
      }
    } catch (error) {
      console.error('모음집 구매 이력 확인 오류:', error);
      alert('구매 이력 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setPurchasing(true);
    try {
      const price = Math.max(0, finalPrice);
      const purchaseItems = sheetDetails.map((sheet) => ({
          sheetId: sheet.id,
          sheetTitle: sheet.title ?? '악보',
          price: sheet.price ?? 0,
        }));

      const purchaseResult = await processCashPurchase({
        userId: user.id,
        totalPrice: price,
        description: `악보 모음집 구매: ${collection.title}`,
        items: purchaseItems,
        sheetIdForTransaction: null,
      });

      if (!purchaseResult.success) {
        if (purchaseResult.reason === 'INSUFFICIENT_CREDIT') {
          alert(
            `보유 캐쉬가 부족합니다.\n현재 잔액: ${purchaseResult.currentCredits.toLocaleString('ko-KR')}P\n캐쉬를 충전한 뒤 다시 시도해주세요.`,
          );
        }
        return;
      }

      alert('구매가 완료되었습니다. 마이페이지에서 콘텐츠를 확인하세요.');
    } catch (error) {
      console.error('구매 오류:', error);
      alert('구매 중 오류가 발생했습니다.');
    } finally {
      setPurchasing(false);
    }
  };

  const isActiveCollection = collection.is_active;

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      {/* Top Header */}
      <MainHeader user={user} />

      {/* User Sidebar */}
      <UserSidebar user={user} />

      <div className={user ? 'md:mr-64' : ''}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
          <button
            onClick={() => navigate('/collections')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <i className="ri-arrow-left-line text-lg" />
            <span>모음집 목록으로 돌아가기</span>
          </button>
        </div>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 md:pb-16">
          <div className="grid gap-8 lg:grid-cols-[2fr,1fr] lg:gap-10">
            <div className="space-y-8">
              <article className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="relative aspect-[16/9] bg-gray-100">
                  <img
                    src={collection.thumbnail_url || generateDefaultThumbnail(800, 600)}
                    alt={translatedTitle}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const target = event.target as HTMLImageElement;
                      target.src = generateDefaultThumbnail(800, 600);
                    }}
                  />
                  {collection.discount_percentage > 0 && (
                    <div className="absolute top-5 right-5 rounded-full bg-red-500 px-4 py-2 text-white font-semibold shadow-lg">
                      {collection.discount_percentage}% 할인
                    </div>
                  )}
                </div>
                <div className="px-6 py-8 space-y-6 md:px-8 md:py-10">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
                      <i className="ri-album-line" />
                      악보 모음집
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">{translatedTitle}</h2>
                    {hasTranslatedDescription && (
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm md:text-base">
                        {translatedDescription}
                      </p>
                    )}
                  </div>

                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <span
                          key={category.id}
                          className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="rounded-2xl bg-blue-50 px-5 py-4">
                    <p className="text-sm font-semibold text-blue-600">포함된 악보 수</p>
                    <p className="mt-2 text-2xl font-extrabold text-blue-700 md:text-3xl">
                      {sheetsWithDetails.length}곡
                    </p>
                  </div>
                </div>
              </article>

              <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
                <header className="border-b border-gray-100 px-6 py-5 md:px-8 md:py-6">
                  <h3 className="text-lg font-semibold text-gray-900 md:text-xl">포함된 악보</h3>
                  <p className="mt-1 text-sm text-gray-500">모음집에 포함된 모든 악보를 확인하고 원하는 악보를 바로 살펴보세요.</p>
                </header>

                <div className="divide-y divide-gray-100">
                  {sheetsWithDetails.length === 0 ? (
                    <div className="px-6 py-10 text-center text-gray-500 md:px-8 md:py-12">
                      <i className="ri-inbox-line text-4xl text-gray-300 mb-3" />
                      <p className="text-sm">아직 모음집에 포함된 악보가 없습니다.</p>
                    </div>
                  ) : (
                    collectionSheets.map((item, index) => {
                      const sheet = item.drum_sheets;
                      if (!sheet) {
                        return null;
                      }

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 transition hover:bg-gray-50 cursor-pointer md:px-8 md:py-6"
                          onClick={() => navigate(`/sheet-detail/${sheet.id}`)}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-50 text-blue-600 font-semibold">
                              {index + 1}
                            </div>
                            <img
                              src={sheet.thumbnail_url || generateDefaultThumbnail(200, 200)}
                              alt={sheet.title}
                              className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                              onError={(event) => {
                                const target = event.target as HTMLImageElement;
                                target.src = generateDefaultThumbnail(200, 200);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{sheet.title}</p>
                              <p className="text-sm text-gray-500 truncate">{sheet.artist}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:min-w-[200px]">
                            {sheet.difficulty && (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                난이도 {sheet.difficulty}
                              </span>
                            )}
                            <span className="text-sm font-semibold text-blue-600">
                              {sheet.price > 0 ? formatCurrency(sheet.price) : '무료'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-6 shadow-sm md:px-6 md:py-8">
                <h3 className="text-lg font-semibold text-blue-900">모음집 가격 정보</h3>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between text-sm text-blue-800">
                    <span>개별 악보 총 합계</span>
                    <span className="font-semibold line-through">{totalIndividualPrice > 0 ? formatCurrency(totalIndividualPrice) : '정보 없음'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-blue-800">
                    <span>모음집 판매가</span>
                    <span className="text-xl font-bold text-blue-700 md:text-2xl">{displayPriceLabel}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-600">
                      <span>지금 구매 시</span>
                      <span>{formatCurrency(savings)} 절약!</span>
                    </div>
                  )}
                </div>

                {/* 구매 버튼 */}
                {isActiveCollection ? (
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="w-full bg-blue-600 text-white py-3 px-5 rounded-2xl hover:bg-blue-700 font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-colors shadow-lg md:py-4 md:px-6 md:text-lg"
                    >
                      {purchasing ? '처리 중...' : '바로구매'}
                    </button>
                    
                    <p className="text-sm text-gray-500 text-center">
                      모음집은 할인된 가격으로 바로구매만 가능합니다.
                    </p>
                  </div>
                ) : (
                  <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-red-500">
                    현재 비활성화된 모음집입니다. 관리자에게 문의해 주세요.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white px-5 py-5 shadow-sm space-y-4 md:px-6 md:py-6">
                <h4 className="text-lg font-semibold text-gray-900">다른 페이지 탐색</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/categories')}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                  >
                    악보 카테고리 보기
                  </button>
                  <button
                    onClick={() => navigate('/event-sale')}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                  >
                    이벤트 할인 악보
                  </button>
                  <button
                    onClick={() => navigate('/custom-order')}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                  >
                    주문 제작 문의
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {/* Mobile Sticky Purchase Bar */}
      <div className="md:hidden">
        {isActiveCollection ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.15)] backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-600">모음집 가격</p>
                <p className="text-lg font-bold text-gray-900">{displayPriceLabel}</p>
                {savings > 0 ? (
                  <p className="text-[11px] text-green-600">개별 구매 대비 {formatCurrency(savings)} 절약</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing}
                className={`flex flex-1 items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow transition ${
                  purchasing ? 'opacity-60' : 'hover:bg-blue-700'
                }`}
              >
                {purchasing ? '처리 중...' : '바로구매'}
              </button>
            </div>
          </div>
        ) : (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-red-200 bg-white px-4 py-3 text-center text-sm font-semibold text-red-500 shadow-[0_-4px_12px_rgba(248,113,113,0.25)]">
            현재 비활성화된 모음집입니다.
          </div>
        )}
      </div>
    </div>
  );
}


