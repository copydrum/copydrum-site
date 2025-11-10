
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import UserSidebar from '../../components/feature/UserSidebar';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 사용자 상태 확인
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const featuredSheets = [
    {
      id: 1,
      title: "Rock Ballad Collection",
      artist: "Various Artists",
      price: "₩15,000",
      difficulty: "중급",
      image: "https://readdy.ai/api/search-image?query=Professional%20drum%20sheet%20music%20collection%20with%20rock%20ballad%20style%2C%20clean%20white%20background%2C%20musical%20notes%20and%20drum%20symbols%20visible%2C%20modern%20minimalist%20design%2C%20high%20quality%20paper%20texture&width=300&height=400&seq=1&orientation=portrait"
    },
    {
      id: 2,
      title: "Jazz Fusion Beats",
      artist: "Modern Jazz Masters",
      price: "₩18,000",
      difficulty: "고급",
      image: "https://readdy.ai/api/search-image?query=Jazz%20fusion%20drum%20sheet%20music%20with%20complex%20rhythms%2C%20clean%20white%20background%2C%20sophisticated%20musical%20notation%2C%20professional%20layout%2C%20elegant%20typography&width=300&height=400&seq=2&orientation=portrait"
    },
    {
      id: 3,
      title: "Pop Hits 2024",
      artist: "Chart Toppers",
      price: "₩12,000",
      difficulty: "초급",
      image: "https://readdy.ai/api/search-image?query=Modern%20pop%20music%20drum%20sheets%2C%20bright%20clean%20background%2C%20contemporary%20musical%20notation%2C%20colorful%20accents%2C%20trendy%20design%20elements&width=300&height=400&seq=3&orientation=portrait"
    },
    {
      id: 4,
      title: "Metal Madness",
      artist: "Heavy Hitters",
      price: "₩20,000",
      difficulty: "고급",
      image: "https://readdy.ai/api/search-image?query=Heavy%20metal%20drum%20sheet%20music%20with%20intense%20rhythms%2C%20dark%20themed%20but%20clean%20background%2C%20bold%20musical%20notation%2C%20powerful%20design%20elements&width=300&height=400&seq=4&orientation=portrait"
    },
    {
      id: 5,
      title: "Latin Rhythms",
      artist: "Salsa Masters",
      price: "₩16,000",
      difficulty: "중급",
      image: "https://readdy.ai/api/search-image?query=Latin%20percussion%20and%20drum%20sheet%20music%2C%20warm%20colored%20clean%20background%2C%20rhythmic%20patterns%20visible%2C%20cultural%20musical%20elements%2C%20vibrant%20design&width=300&height=400&seq=5&orientation=portrait"
    },
    {
      id: 6,
      title: "Blues Foundation",
      artist: "Classic Blues",
      price: "₩14,000",
      difficulty: "초급",
      image: "https://readdy.ai/api/search-image?query=Blues%20drum%20sheet%20music%20with%20traditional%20patterns%2C%20vintage%20style%20clean%20background%2C%20classic%20musical%20notation%2C%20timeless%20design%20elements&width=300&height=400&seq=6&orientation=portrait"
    }
  ];

  const categories = [
    { name: "록", icon: "ri-music-fill", count: 45 },
    { name: "재즈", icon: "ri-music-2-fill", count: 32 },
    { name: "팝", icon: "ri-headphone-fill", count: 67 },
    { name: "메탈", icon: "ri-fire-fill", count: 28 },
    { name: "라틴", icon: "ri-rhythm-fill", count: 23 },
    { name: "블루스", icon: "ri-guitar-fill", count: 19 }
  ];

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
      {/* Top Header - Logo & Search */}
      <div className="bg-white border-b border-gray-200">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${user ? 'max-w-5xl' : 'max-w-7xl'}`}>
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: '"Pacifico", serif' }}>
                카피드럼
              </h1>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="곡명, 아티스트, 장르로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:outline-none pr-14 shadow-lg hover:shadow-xl transition-all duration-300 bg-white placeholder-gray-400"
                />
                <button className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 cursor-pointer transition-colors duration-200 group-hover:text-blue-500">
                  <i className="ri-search-line text-2xl"></i>
                </button>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <i className="ri-shopping-cart-line text-xl"></i>
              </button>
              {!user && (
                <a 
                  href="/auth/login"
                  className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 whitespace-nowrap cursor-pointer font-medium"
                >
                  로그인
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${user ? 'max-w-5xl' : 'max-w-7xl'}`}>
          <div className="flex items-center justify-center space-x-12 py-5">
            <a href="/" className="relative text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer group">
              홈
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="/categories" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              악보 카테고리
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="/custom-order" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              주문제작
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="#" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              신규 악보
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="#" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              인기 악보
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="#" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              무료 샘플
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
            <a href="/customer-support" className="relative text-gray-700 hover:text-blue-600 font-bold text-lg whitespace-nowrap cursor-pointer transition-colors duration-200 group">
              고객지원
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
            </a>
          </div>
        </div>
      </nav>

      {/* User Sidebar - 로그인 시 항상 표시 */}
      <UserSidebar user={user} />

      {/* Main Content - 로그인 시 사이드바 공간 확보 */}
      <div className={user ? 'mr-64' : ''}>
        {/* Hero Section */}
        <section 
          className="relative bg-cover bg-center bg-no-repeat h-96"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://readdy.ai/api/search-image?query=Professional%20drummer%20playing%20drums%20in%20modern%20recording%20studio%2C%20dramatic%20lighting%2C%20musical%20atmosphere%2C%20high%20quality%20equipment%2C%20inspiring%20creative%20environment%2C%20wide%20angle%20view&width=1200&height=400&seq=7&orientation=landscape')`
          }}
        >
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-bold text-white mb-4">
                  프로 드러머를 위한<br />
                  최고의 드럼 악보
                </h2>
                <p className="text-xl text-gray-200 mb-8">
                  전문가가 제작한 고품질 드럼 악보를 PDF로 즉시 다운로드하세요
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold whitespace-nowrap cursor-pointer">
                    악보 둘러보기
                  </button>
                  <button className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-gray-900 font-semibold whitespace-nowrap cursor-pointer">
                    무료 샘플 보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">장르별 악보</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {categories.map((category, index) => (
                <a 
                  key={index} 
                  href={`/categories?category=${category.name}`}
                  className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className={`${category.icon} text-blue-600 text-xl`}></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                  <p className="text-sm text-gray-600">{category.count}개 악보</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-gray-50" data-product-shop>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">인기 드럼 악보</h3>
              <p className="text-lg text-gray-600">가장 많이 구매된 프리미엄 드럼 악보 컬렉션</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredSheets.map((sheet) => (
                <div key={sheet.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <img 
                    src={sheet.image} 
                    alt={sheet.title}
                    className="w-full h-64 object-cover object-top"
                  />
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg text-gray-900">{sheet.title}</h4>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {sheet.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">{sheet.artist}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-blue-600">{sheet.price}</span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer">
                        구매하기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">카피드럼의 특별함</h3>
              <p className="text-lg text-gray-600">전문가가 인정하는 고품질 드럼 악보 서비스</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-file-music-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">전문가 제작</h4>
                <p className="text-gray-600">
                  현직 드러머와 음악 전문가들이 직접 제작한 정확하고 상세한 악보
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-download-cloud-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">즉시 다운로드</h4>
                <p className="text-gray-600">
                  결제 완료 즉시 고화질 PDF 파일을 다운로드하여 바로 연습 시작
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-customer-service-line text-blue-600 text-2xl"></i>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">24/7 지원</h4>
                <p className="text-gray-600">
                  언제든지 문의하실 수 있는 고객 지원 서비스와 연주 가이드 제공
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-16 bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-4">새로운 악보 소식을 받아보세요</h3>
            <p className="text-xl text-blue-100 mb-8">
              신규 악보 출시와 특별 할인 정보를 가장 먼저 받아보세요
            </p>
            <div className="max-w-md mx-auto flex gap-4">
              <input
                type="email"
                placeholder="이메일 주소를 입력하세요"
                className="flex-1 px-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-blue-300"
              />
              <button className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-100 font-semibold whitespace-nowrap cursor-pointer">
                구독하기
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h4 className="text-xl font-bold mb-4" style={{ fontFamily: '"Pacifico", serif' }}>
                  카피드럼
                </h4>
                <p className="text-gray-400 mb-4">
                  전문 드러머를 위한 최고 품질의 드럼 악보를 제공합니다.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    <i className="ri-facebook-fill text-xl"></i>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    <i className="ri-instagram-line text-xl"></i>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    <i className="ri-youtube-fill text-xl"></i>
                  </a>
                </div>
              </div>
              <div>
                <h5 className="font-semibold mb-4">악보 카테고리</h5>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">록 드럼</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">재즈 드럼</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">팝 드럼</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">메탈 드럼</a></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold mb-4">고객 지원</h5>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">자주 묻는 질문</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">다운로드 가이드</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">환불 정책</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">문의하기</a></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold mb-4">회사 정보</h5>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">회사 소개</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">이용약관</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">개인정보처리방침</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">파트너십</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8 text-center">
              <p className="text-gray-400">
                © 2024 카피드럼. All rights reserved. | 
                <a href="https://readdy.ai/?origin=logo" className="text-gray-400 hover:text-white ml-1 cursor-pointer">
                  Website Builder
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
