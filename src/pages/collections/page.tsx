import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import MainHeader from '../../components/common/MainHeader';
import { useSiteLanguage } from '../../hooks/useSiteLanguage';
import Seo from '../../components/Seo';
import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';

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
  category_id?: string;
  category_ids?: string[];
  title_translations?: Record<string, string> | null;
  description_translations?: Record<string, string> | null;
}

interface Category {
  id: string;
  name: string;
}

const CollectionsPage = () => {
  const { t, i18n } = useTranslation();
  const { isKoreanSite } = useSiteLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 현재 언어에 맞는 제목/설명 가져오기
  const getCollectionTitle = (collection: Collection): string => {
    const currentLang = i18n.language;
    // 한국어 페이지에서는 한국어, 나머지는 영어
    const targetLang = currentLang === 'ko' ? 'ko' : 'en';
    
    if (targetLang === 'ko') {
      return collection.title;
    }
    
    // 영어 번역이 있으면 사용, 없으면 한국어 기본값
    return collection.title_translations?.['en'] || collection.title;
  };

  const getCollectionDescription = (collection: Collection): string => {
    const currentLang = i18n.language;
    const targetLang = currentLang === 'ko' ? 'ko' : 'en';
    
    if (targetLang === 'ko') {
      return collection.description || '';
    }
    
    // 영어 번역이 있으면 사용, 없으면 한국어 기본값
    return collection.description_translations?.['en'] || collection.description || '';
  };

  // 장르 목록 (순서대로) - 한글 원본 (한글 사이트용)
  const genreListKo = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버'];
  // 영문 사이트용 장르 순서 (기준 순서)
  const genreListEn = ['팝', '락', '가요', '재즈', 'J-POP', 'OST', 'CCM', '트로트/성인가요', '드럼솔로', '드럼커버'];
  // 현재 언어에 맞는 장르 목록 가져오기
  const genreList = i18n.language === 'ko' ? genreListKo : genreListEn;

  // 장르 이름을 번역하는 함수
  const getGenreName = (genreKo: string): string => {
    if (i18n.language === 'ko') return genreKo;

    const genreMap: Record<string, string> = {
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
    };

    return genreMap[genreKo] || genreKo;
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

  // 카테고리 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .neq('name', '드럼레슨');

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('카테고리 로드 오류:', error);
      }
    };

    loadCategories();
  }, []);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data || []).map((collection: any) => ({
        ...collection,
        category_ids: collection.category_ids || (collection.category_id ? [collection.category_id] : [])
      }));
      setAllCollections(normalized);
    } catch (error) {
      console.error('모음집 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 선택된 카테고리에 따라 모음집 필터링
  useEffect(() => {
    if (selectedCategory === 'all') {
      setCollections(allCollections);
    } else {
      const filtered = allCollections.filter((collection) => {
        return collection.category_id === selectedCategory || 
               (collection.category_ids && collection.category_ids.includes(selectedCategory));
      });
      setCollections(filtered);
    }
  }, [selectedCategory, allCollections]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // 통화 로직 적용 (locale 기반)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = getSiteCurrency(hostname, i18n.language);

  const formatPrice = useCallback((price: number): string => {
    if (price === 0) return t('collectionsPage.collection.free');
    const convertedAmount = convertFromKrw(price, currency);
    return formatCurrencyUtil(convertedAmount, currency);
  }, [currency, t]);

  const handleCollectionClick = (collectionId: string) => {
    navigate(`/collections/${collectionId}`);
  };

  return (
    <>
      <Seo
        title={t('collectionsPage.title')}
        description={t('collectionsPage.subtitle')}
      />
      <MainHeader user={user} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('collectionsPage.title')}
            </h1>
            <p className="text-gray-600">
              {t('collectionsPage.subtitle')}
            </p>
          </div>

          {/* 장르 필터 */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {t('collectionsPage.filter.all')}
              </button>
              {genreList.map((genreKo) => {
                const category = categories.find((cat) => cat.name === genreKo);
                if (!category) return null;

                const isActive = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {getGenreName(genreKo)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 모음집 목록 */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <i className="ri-loader-4-line w-8 h-8 animate-spin text-blue-600"></i>
              <span className="ml-2 text-gray-600">{t('collectionsPage.loading')}</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('collectionsPage.empty.noCollections')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => handleCollectionClick(collection.id)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  {/* 썸네일 */}
                  {collection.thumbnail_url && (
                    <div className="aspect-video w-full overflow-hidden bg-gray-100">
                      <img
                        src={collection.thumbnail_url}
                        alt={getCollectionTitle(collection)}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* 내용 */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded">
                        {t('collectionsPage.collection.badge')}
                      </span>
                      {collection.discount_percentage > 0 && (
                        <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded">
                          {t('collectionsPage.collection.discount', { percentage: collection.discount_percentage })}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300">
                      {getCollectionTitle(collection)}
                    </h3>

                    {getCollectionDescription(collection) && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 group-hover:text-gray-700 transition-colors duration-300">
                        {getCollectionDescription(collection)}
                      </p>
                    )}

                    {/* 가격 */}
                    <div className="flex items-center justify-between">
                      <div>
                        {collection.sale_price > 0 ? (
                          <div>
                            <span className="text-2xl font-bold text-gray-900">
                              {formatPrice(collection.sale_price)}
                            </span>
                            {collection.original_price > collection.sale_price && (
                              <span className="ml-2 text-sm text-gray-500 line-through">
                                {formatPrice(collection.original_price)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-gray-900">
                            {formatPrice(collection.original_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CollectionsPage;
