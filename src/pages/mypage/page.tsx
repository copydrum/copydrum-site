
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { supabase as supabaseAlias } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { 
  User as UserIcon, 
  ShoppingBag, 
  CreditCard, 
  Settings, 
  Edit3, 
  Download, 
  Calendar,
  MapPin,
  Phone,
  Mail,
  Lock,
  Bell,
  LogOut,
  Trash2
} from 'lucide-react';
import React from 'react';
import UserSidebar from '../../components/feature/UserSidebar';
import { useCart } from '@/hooks/useCart';
import { Link } from 'react-router-dom';

// Component definition
const MyPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [userCash, setUserCash] = useState(50000);

  // 프로필 표시 및 폼 상태를 일원화
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    cash_balance: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  });

  const [purchaseHistory] = useState([
    {
      id: 1,
      title: "Rock Ballad Collection",
      artist: "Various Artists",
      price: 15000,
      purchaseDate: "2024-01-15",
      downloadCount: 3,
      maxDownloads: "무제한",
      status: "완료"
    },
    {
      id: 2,
      title: "Jazz Fusion Beats",
      artist: "Modern Jazz Masters",
      price: 18000,
      purchaseDate: "2024-01-10",
      downloadCount: 1,
      maxDownloads: "무제한",
      status: "완료"
    },
    {
      id: 3,
      title: "Pop Hits 2024",
      artist: "Chart Toppers",
      price: 12000,
      purchaseDate: "2024-01-05",
      downloadCount: 5,
      maxDownloads: "무제한",
      status: "완료"
    }
  ]);

  const [cashHistory] = useState([
    {
      id: 1,
      type: "충전",
      amount: 50000,
      description: "카카오페이 충전",
      date: "2024-01-15 14:30",
      status: "완료"
    },
    {
      id: 2,
      type: "사용",
      amount: -15000,
      description: "Rock Ballad Collection 구매",
      date: "2024-01-15 15:00",
      status: "완료"
    },
    {
      id: 3,
      type: "사용",
      amount: -18000,
      description: "Jazz Fusion Beats 구매",
      date: "2024-01-10 16:20",
      status: "완료"
    },
    {
      id: 4,
      type: "충전",
      amount: 30000,
      description: "신용카드 충전",
      date: "2024-01-08 10:15",
      status: "완료"
    }
  ]);

  const tabs = [
    { id: 'profile', label: '프로필 관리', icon: 'ri-user-line' },
    { id: 'orders', label: '주문제작 신청내역', icon: 'ri-file-list-3-line' },
    { id: 'purchases', label: '구매내역', icon: 'ri-shopping-bag-line' },
    { id: 'favorites', label: '찜한 악보', icon: 'ri-heart-line' },
  ];

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const nextProfile = {
          full_name: user.user_metadata?.name || '',
          phone: user.user_metadata?.phone || '',
          cash_balance: 0,
        };
        setProfile(nextProfile);
        setFormData({
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        });
      }
      
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleProfileSave = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: formData.full_name,
          phone: formData.phone,
        }
      });

      if (error) throw error;

      // 화면 표시용 프로필도 동기화
      setProfile(prev => ({
        ...prev,
        full_name: formData.full_name,
        phone: formData.phone,
      }));

      setIsEditing(false);
      alert('프로필이 성공적으로 업데이트되었습니다.');
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      alert('프로필 업데이트에 실패했습니다.');
    }
  };

  const handleDownload = (sheetId: number) => {
    alert(`악보 ID ${sheetId} 다운로드를 시작합니다.`);
  };

  const navigate = useNavigate();

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
                <Link to="/categories" className="text-gray-700 hover:text-blue-600 transition-colors">카테고리</Link>
                <Link to="/custom-order" className="text-gray-700 hover:text-blue-600 transition-colors">맞춤 제작</Link>
                <Link to="/customer-support" className="text-gray-700 hover:text-blue-600 transition-colors">고객지원</Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link to="/cart" className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors">
                <i className="ri-shopping-cart-line w-5 h-5"></i>
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </Link>
              
              <div className="flex items-center space-x-3">
                <span className="text-gray-700">마이페이지</span>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 사이드바 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="ri-user-line text-blue-600 w-6 h-6"></i>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{user?.email?.split('@')[0] || '사용자'}</h2>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>
              
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-user-line w-5 h-5"></i>
                  <span>프로필 관리</span>
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'orders' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-file-list-line w-5 h-5"></i>
                  <span>주문 내역</span>
                </button>
                <button
                  onClick={() => setActiveTab('downloads')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'downloads' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-download-line w-5 h-5"></i>
                  <span>다운로드</span>
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'favorites' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-heart-line w-5 h-5"></i>
                  <span>찜한 악보</span>
                </button>
                <button
                  onClick={() => setActiveTab('points')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeTab === 'points' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-coin-line w-5 h-5"></i>
                  <span>적립금</span>
                </button>
              </nav>
            </div>
          </div>

          {/* 메인 컨텐츠 */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">프로필 관리</h3>
                
                <form onSubmit={updateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        이메일
                      </label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        이름
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="이름을 입력하세요"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        전화번호
                      </label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({...profile, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="전화번호를 입력하세요"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        생년월일
                      </label>
                      <input
                        type="date"
                        value={profile.birth_date}
                        onChange={(e) => setProfile({...profile, birth_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      주소
                    </label>
                    <input
                      type="text"
                      value={profile.address}
                      onChange={(e) => setProfile({...profile, address: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="주소를 입력하세요"
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-7 transition-colors whitespace-nowrap"
                    >
                      프로필 업데이트
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">주문 내역</h3>
                
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="ri-file-list-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">주문 내역이 없습니다</h4>
                    <p className="text-gray-600 mb-4">아직 구매한 악보가 없습니다.</p>
                    <Link
                      to="/categories"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block whitespace-nowrap"
                    >
                      악보 둘러보기
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">주문 #{order.id.slice(0, 8)}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status === 'completed' ? '완료' :
                             order.status === 'pending' ? '대기' : '취소'}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <span className="text-gray-900">{item.sheet_title}</span>
                              <span className="text-gray-600">{item.price.toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                          <span className="font-medium text-gray-900">
                            총 {order.total_amount.toLocaleString()}원
                          </span>
                          <Link
                            to={`/my-orders/${order.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            상세보기
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">다운로드 가능한 악보</h3>
                
                {downloadableSheets.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="ri-download-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">다운로드 가능한 악보가 없습니다</h4>
                    <p className="text-gray-600">구매한 악보가 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {downloadableSheets.map((sheet) => (
                      <div key={sheet.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-4">
                          <img
                            src={sheet.thumbnail_url || `https://readdy.ai/api/search-image?query=drum%20sheet%20music%20$%7Bsheet.title%7D%20modern%20minimalist%20background&width=80&height=60&seq=${sheet.id}&orientation=landscape`}
                            alt={sheet.title}
                            className="w-16 h-12 object-cover object-top rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{sheet.title}</h4>
                            <p className="text-sm text-gray-600">
                              구매일: {new Date(sheet.purchase_date).toLocaleDateString()}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <button
                                onClick={() => downloadSheet(sheet)}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors flex items-center space-x-1 whitespace-nowrap"
                              >
                                <i className="ri-download-line w-4 h-4"></i>
                                <span>다운로드</span>
                              </button>
                              <button
                                onClick={() => viewSheet(sheet)}
                                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover-bg-gray-200 transition-colors flex items-center space-x-1 whitespace-nowrap"
                              >
                                <i className="ri-eye-line w-4 h-4"></i>
                                <span>미리보기</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">찜한 악보</h3>
                
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="ri-heart-line text-gray-300 w-16 h-16 mx-auto mb-4"></i>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">찜한 악보가 없습니다</h4>
                    <p className="text-gray-600">마음에 드는 악보를 찜해보세요.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favorites.map((sheet) => (
                      <div key={sheet.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-4">
                          <img
                            src={sheet.thumbnail_url || `https://readdy.ai/api/search-image?query=drum%20sheet%20music%20$%7Bsheet.title%7D%20modern%20minimalist%20background&width=80&height=60&seq=${sheet.id}&orientation=landscape`}
                            alt={sheet.title}
                            className="w-16 h-12 object-cover object-top rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{sheet.title}</h4>
                            <p className="text-sm text-gray-600 truncate">{sheet.description}</p>
                            <p className="text-lg font-bold text-blue-600 mt-1">
                              {sheet.price.toLocaleString()}원
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Link
                                to={`/sheet-detail/${sheet.id}`}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                              >
                                상세보기
                              </Link>
                              <button
                                onClick={() => removeFavorite(sheet.id)}
                                className="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors flex items-center space-x-1 whitespace-nowrap"
                              >
                                <i className="ri-delete-bin-line w-4 h-4"></i>
                                <span>삭제</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'points' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">적립금 관리</h3>
                
                <div className="bg-blue-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-blue-900">보유 적립금</h4>
                      <p className="text-sm text-blue-700">다음 구매 시 사용 가능합니다</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-blue-600">
                        {userPoints.toLocaleString()}
                      </span>
                      <span className="text-blue-600 ml-1">원</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">적립금 내역</h4>
                  {pointHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="ri-coin-line text-gray-300 w-12 h-12 mx-auto mb-3"></i>
                      <p className="text-gray-600">적립금 내역이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pointHistory.map((history) => (
                        <div key={history.id} className="flex justify-between items-center py-3 border-b border-gray-100">
                          <div>
                            <p className="font-medium text-gray-900">{history.description}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(history.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`font-medium ${
                            history.amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {history.amount > 0 ? '+' : ''}{history.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPage;
