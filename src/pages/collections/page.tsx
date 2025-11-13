import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import UserSidebar from '../../components/feature/UserSidebar';
import MainHeader from '../../components/common/MainHeader';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';

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
  sheet_count?: number;
  category_id?: string | null;
  category_ids?: string[] | null;
  categories?: string[]; // 모음집에 포함된 악보들의 카테고리 ID 목록
}

interface Category {
  id: string;
  name: string;
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
  };
}

export default function CollectionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const navigate = useNavigate();

  // 장르 목록 (순서대로) - 마지막에 드럼레슨 추가
  const genreList = ['가요', '팝', '락', 'CCM', '트로트/성인가요', '재즈', 'J-POP', 'OST', '드럼솔로', '드럼커버', '드럼레슨'];

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    loadCategories();
    loadCollections();

    return () => subscription.unsubscribe();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 장르 순서에 맞게 정렬
      const sortedCategories = (data || []).sort((a, b) => {
        const indexA = genreList.indexOf(a.name);
        const indexB = genreList.indexOf(b.name);
        
        // 순서에 없는 경우 맨 뒤로
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
      });

      setCategories(sortedCategories);
    } catch (error) {
      console.error('카테고리 로드 오류:', error);
    }
  };

  const loadCollections = async () => {
    try {
      // 활성화된 모음집만 조회
      const { data, error } = await supabase
        .from('collections')
        .select('id, title, description, thumbnail_url, original_price, sale_price, discount_percentage, is_active, created_at, category_id, category_ids')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 각 모음집의 악보 개수 및 카테고리 조회
      const collectionsWithCount = await Promise.all(
        (data || []).map(async (collection) => {
          const categoryIdsFromDb = Array.isArray(collection.category_ids)
            ? collection.category_ids.filter((id: string | null) => !!id).map((id: string) => id)
            : [];
          
          let categoryIds = [...categoryIdsFromDb];

          if (categoryIds.length === 0 && collection.category_id) {
            categoryIds.push(collection.category_id);
          }

          // 악보 개수 조회
          const { count, error: countError } = await supabase
            .from('collection_sheets')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          if (countError) {
            console.error('악보 개수 조회 오류:', countError);
            return { ...collection, sheet_count: 0, categories: categoryIds };
          }

          // DB에 카테고리가 저장되어 있지 않은 경우 악보에서 추출 (호환용)
          if (categoryIds.length === 0) {
            const { data: collectionSheets, error: sheetsError } = await supabase
              .from('collection_sheets')
              .select(`
                drum_sheet_id,
                drum_sheets (
                  category_id
                )
              `)
              .eq('collection_id', collection.id);

            if (sheetsError) {
              console.error('카테고리 조회 오류:', sheetsError);
            } else {
              const legacyCategoryIds = new Set<string>();
              collectionSheets?.forEach((cs: any) => {
                if (cs.drum_sheets?.category_id) {
                  legacyCategoryIds.add(cs.drum_sheets.category_id);
                }
              });
              categoryIds = Array.from(legacyCategoryIds);
            }
          }

          return { 
            ...collection, 
            sheet_count: count || 0,
            categories: categoryIds
          };
        })
      );

      setCollections(collectionsWithCount);
    } catch (error) {
      console.error('모음집 로드 오류:', error);
    }
  };

  const getThumbnailUrl = (collection: Collection): string => {
    if (collection.thumbnail_url) {
      return collection.thumbnail_url;
    }
    return generateDefaultThumbnail(400, 400);
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  // 선택된 카테고리에 해당하는 모음집 필터링
  const filteredCollections = selectedCategory
    ? collections.filter(collection => 
        collection.categories?.includes(selectedCategory)
      )
    : collections;

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

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <MainHeader user={user} />

      {/* User Sidebar */}
      <UserSidebar user={user} />

      {/* Main Content */}
      <div className="mr-64">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">악보 모음집</h2>
            <p className="text-xl text-blue-100">테마별로 엄선한 특별한 드럼 악보 컬렉션을 만나보세요.</p>
          </div>
        </section>

        {/* Collections Grid */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 장르 필터 */}
            <div className="mb-8">
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    selectedCategory === ''
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  전체
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {filteredCollections.length === 0 ? (
              <div className="text-center py-16">
                <i className="ri-inbox-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 text-lg">
                  {selectedCategory ? '선택한 장르에 해당하는 모음집이 없습니다.' : '등록된 모음집이 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCollections.map((collection) => (
                  <div
                    key={collection.id}
                    onClick={() => navigate(`/collections/${collection.id}`)}
                    className="group bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-gray-200">
                      <img
                        src={getThumbnailUrl(collection)}
                        alt={collection.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = generateDefaultThumbnail(400, 400);
                        }}
                      />
                      {collection.discount_percentage > 0 && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full font-bold text-sm">
                          {collection.discount_percentage}% 할인
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {collection.title}
                      </h3>
                      {collection.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                      
                      {/* Sheet Count */}
                      <div className="flex items-center text-gray-500 text-sm mb-4">
                        <i className="ri-file-music-line mr-2"></i>
                        <span>{collection.sheet_count || 0}개의 악보</span>
                      </div>

                      {/* Price */}
                      <div className="flex items-center justify-between">
                        {collection.sale_price > 0 ? (
                          <div className="flex items-center space-x-2">
                            {collection.original_price > collection.sale_price && (
                              <span className="text-gray-400 line-through text-sm">
                                {formatPrice(collection.original_price)}원
                              </span>
                            )}
                            <span className="text-2xl font-bold text-blue-600">
                              {formatPrice(collection.sale_price)}원
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xl font-bold text-gray-900">
                            {collection.original_price > 0 ? `${formatPrice(collection.original_price)}원` : '무료'}
                          </span>
                        )}
                        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                          자세히 보기
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
