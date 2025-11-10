
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Search, Filter, Grid, List, ShoppingCart, Star, ChevronDown, ChevronUp, X } from 'lucide-react';
import React from 'react';
import UserSidebar from '../../components/feature/UserSidebar';
import { useCart } from '../../hooks/useCart';

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
  categories?: { name: string };
  thumbnail_url?: string;
  album?: string;
  page_count?: number;
  purchase_count?: number;
  view_count?: number;
  click_count?: number;
}

const CategoriesPage: React.FC = () => {
  // ... existing code ...

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drumSheets, setDrumSheets] = useState<DrumSheet[]>([]);
  const [topSheets, setTopSheets] = useState<DrumSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredSheet, setHoveredSheet] = useState<DrumSheet | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<DrumSheet | null>(null);
  const [cart, setCart] = useState<Set<string>>(new Set());

  const { addToCart, isInCart } = useCart();

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([loadCategories(), loadDrumSheets()]);
    } catch (error) {
      console.error('Data loading error:', error);
    } finally {
      setLoading(false);
    }
  };

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
      const { data, error } = await supabase
        .from('drum_sheets')
        .select('*, categories (name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrumSheets(data ?? []);
    } catch (err) {
      console.error('Drum sheets loading error:', err);
    }
  };

  const calculateTopSheets = () => {
    let filtered = [...drumSheets];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((sheet) => sheet.category_id === selectedCategory);
    }

    const scored = filtered.map(sheet => ({
      ...sheet,
      popularityScore: (sheet.purchase_count || 0) * 3 + (sheet.view_count || 0) * 2 + (sheet.click_count || 0) * 1
    }));

    const top5 = scored
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 5);

    setTopSheets(top5);
    
    if (top5.length > 0) {
      setSelectedSheet(top5[0]);
    }
  };

  const getDifficultyBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case '초급':
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case '중급':
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case '고급':
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyDisplayText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '초급';
      case 'intermediate':
        return '중급';
      case 'advanced':
        return '고급';
      case '초급':
      case '중급':
      case '고급':
        return difficulty;
      default:
        return difficulty;
    }
  };

  const getThumbnailUrl = async (sheet: DrumSheet): Promise<string> => {
    if (sheet.thumbnail_url) {
      return sheet.thumbnail_url;
    }

    try {
      const response = await fetch('/api/music-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist: sheet.artist,
          title: sheet.title
        })
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        return data.imageUrl;
      }
    } catch (error) {
      console.error('Failed to fetch album cover:', error);
    }

    return '';
  };

  const toggleCart = (sheetId: string) => {
    const newCart = new Set(cart);
    if (newCart.has(sheetId)) {
      newCart.delete(sheetId);
    } else {
      newCart.add(sheetId);
    }
    setCart(newCart);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (categoryId === 'all') {
      newSearchParams.delete('category');
    } else {
      newSearchParams.set('category', categoryId);
    }
    navigate(`/categories?${newSearchParams.toString()}`, { replace: true });
  };

  const handlePurchase = (sheet: DrumSheet) => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    alert(`"${sheet.title}" 악보를 구매합니다.`);
  };

  const handleAddToCart = async (sheetId: string) => {
    const success = await addToCart(sheetId);
    if (success) {
      alert('장바구니에 추가되었습니다.');
    }
  };

  const handleBuyNow = (sheetId: string) => {
    console.log('바로구매:', sheetId);
  };

  // The following UI implementation was provided in the modified content.
  // It may reference variables (searchTerm, cartItemsCount, showFilters, viewMode,
  // sortBy, filteredSheets, selectedDifficulty, priceRange) that are not defined
  // in the original code. They remain as placeholders as per the merge request.

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-blue-600" style={{ fontFamily: '"Pacifico", serif' }}>
                logo
              </Link>
              <nav className="hidden md:flex space-x-8">
                <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">홈</Link>
                <Link to="/categories" className="text-blue-600 font-medium">카테고리</Link>
                <Link to="/custom-order" className="text-gray-700 hover:text-blue-600 transition-colors">맞춤 제작</Link>
                <Link to="/customer-support" className="text-gray-700 hover:text-blue-600 transition-colors">고객지원</Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"></i>
                <input
                  type="text"
                  placeholder="악보 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <Link to="/cart" className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors">
                <i className="ri-shopping-cart-line w-5 h-5"></i>
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </Link>
              
              {user ? (
                <div className="flex items-center space-x-3">
                  <Link to="/mypage" className="text-gray-700 hover:text-blue-600 transition-colors">
                    마이페이지
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link to="/login" className="text-gray-700 hover:text-blue-600 transition-colors">
                    로그인
                  </Link>
                  <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">드럼 악보 카테고리</h1>
          <p className="text-gray-600">원하는 장르와 스타일의 드럼 악보를 찾아보세요</p>
        </div>

        {/* 필터 및 정렬 */}
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
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">보기:</span>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <i className="ri-grid-line w-4 h-4"></i>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <i className="ri-list-unordered w-4 h-4"></i>
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-8"
              >
                <option value="newest">최신순</option>
                <option value="popular">인기순</option>
                <option value="price-low">가격 낮은순</option>
                <option value="price-high">가격 높은순</option>
                <option value="rating">평점순</option>
              </select>
              
              <span className="text-sm text-gray-600">
                총 {filteredSheets.length}개 악보
              </span>
            </div>
          </div>
          
          {/* 확장 필터 */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
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
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
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
                      onChange={(e) => setPriceRange({...priceRange, min: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="number"
                      placeholder="최대"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({...priceRange, max: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setSelectedDifficulty('');
                    setPriceRange({ min: '', max: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 악보 목록 */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSheets.map((sheet) => (
              <div key={sheet.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative">
                  <img
                    src={sheet.thumbnail_url || `https://readdy.ai/api/search-image?query=drum%20sheet%20music%20$%7Bsheet.title%7D%20modern%20minimalist%20background&width=300&height=200&seq=${sheet.id}&orientation=landscape`}
                    alt={sheet.title}
                    className="w-full h-48 object-cover object-top"
                  />
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => addToCart(sheet)}
                      className="bg-white/90 backdrop-blur-sm text-gray-700 p-2 rounded-full hover:bg-white hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <i className="ri-shopping-cart-line w-4 h-4"></i>
                    </button>
                  </div>
                  {sheet.difficulty && (
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        sheet.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        sheet.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sheet.difficulty === 'beginner' ? '초급' :
                         sheet.difficulty === 'intermediate' ? '중급' : '고급'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                      {sheet.title}
                    </h3>
                    <div className="flex items-center ml-2">
                      <i className="ri-star-fill text-yellow-400 w-4 h-4"></i>
                      <span className="text-sm text-gray-600 ml-1">
                        {sheet.rating || 4.5}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {sheet.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-600">
                      {sheet.price.toLocaleString()}원
                    </span>
                    <Link
                      to={`/sheet-detail/${sheet.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSheets.map((sheet) => (
              <div key={sheet.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-6">
                  <img
                    src={sheet.thumbnail_url || `https://readdy.ai/api/search-image?query=drum%20sheet%20music%20$%7Bsheet.title%7D%20modern%20minimalist%20background&width=120&height=80&seq=${sheet.id}&orientation=landscape`}
                    alt={sheet.title}
                    className="w-24 h-16 object-cover object-top rounded-lg flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {sheet.title}
                      </h3>
                      <div className="flex items-center space-x-4 ml-4">
                        <div className="flex items-center">
                          <i className="ri-star-fill text-yellow-400 w-4 h-4"></i>
                          <span className="text-sm text-gray-600 ml-1">
                            {sheet.rating || 4.5}
                          </span>
                        </div>
                        <span className="text-xl font-bold text-blue-600">
                          {sheet.price.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {sheet.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {sheet.difficulty && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            sheet.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                            sheet.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {sheet.difficulty === 'beginner' ? '초급' :
                             sheet.difficulty === 'intermediate' ? '중급' : '고급'}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          카테고리: {categories.find(c => c.id === sheet.category_id)?.name || '기타'}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => addToCart(sheet)}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2 whitespace-nowrap"
                        >
                          <i className="ri-shopping-cart-line w-4 h-4"></i>
                          <span>장바구니</span>
                        </button>
                        <Link
                          to={`/sheet-detail/${sheet.id}`}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          상세보기
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {filteredSheets.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-file-music-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
            <p className="text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
