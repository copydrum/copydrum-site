
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const CustomOrderPage = () => {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    songTitle: '',
    artist: '',
    songUrl: '',
    memo: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        userId: user.email || user.id
      }));
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('custom_orders')
        .insert({
          user_id: user.id,
          name: user.user_metadata?.name || user.email,
          email: user.email,
          phone: '',
          song_title: formData.songTitle,
          artist: formData.artist,
          song_url: formData.songUrl,
          requirements: formData.memo,
          status: 'pending'
        });

      if (error) throw error;

      alert('주문제작 신청이 완료되었습니다. 마이페이지에서 진행상황을 확인하실 수 있습니다.');
      setFormData({
        userId: user.email || user.id,
        songTitle: '',
        artist: '',
        songUrl: '',
        memo: ''
      });
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600 mb-6">주문제작 신청을 하려면 로그인해주세요.</p>
          <a href="/auth/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            로그인하기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Pacifico", serif' }}>
                logo
              </a>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="/" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                홈
              </a>
              <a href="/categories" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                악보 카테고리
              </a>
              <a href="/custom-order" className="text-blue-600 font-bold whitespace-nowrap cursor-pointer">
                주문제작
              </a>
              <a href="/custom-orders" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                주문제작 신청내역
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                신규 악보
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                인기 악보
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                무료 샘플
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 font-bold whitespace-nowrap cursor-pointer transition-colors duration-200">
                고객지원
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">악보 주문제작</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            원하시는 곡의 드럼 악보를 전문가가 직접 제작해드립니다. 
            곡을 분석한 후 맞춤형 견적을 제공해드립니다.
          </p>
        </div>

        {/* Pricing Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-12 border border-blue-100">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">가격 안내</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-emerald-100">
              <div className="bg-emerald-100 text-emerald-800 text-center py-3 rounded-lg mb-4">
                <h3 className="text-xl font-bold">C등급</h3>
                <p className="text-lg font-semibold">1만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed">
                일반적인 가요, 팝, 성인가요 등의 5분이내의 곡
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-amber-100">
              <div className="bg-amber-100 text-amber-800 text-center py-3 rounded-lg mb-4">
                <h3 className="text-xl font-bold">B등급</h3>
                <p className="text-lg font-semibold">3만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed">
                중급 난이도보다 조금 높거나 5분이상의 곡
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-rose-100">
              <div className="bg-rose-100 text-rose-800 text-center py-3 rounded-lg mb-4">
                <h3 className="text-xl font-bold">A등급</h3>
                <p className="text-lg font-semibold">5만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed">
                고급 난이도의 곡
              </p>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              * 최종 가격은 곡의 난이도와 길이를 분석한 후 개별 견적으로 안내드립니다.
            </p>
          </div>
        </div>

        {/* Order Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">주문제작 신청서</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User ID */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                신청자 아이디
              </label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={formData.userId}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                placeholder="로그인된 아이디"
              />
            </div>

            {/* Song Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">곡 정보</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="songTitle" className="block text-sm font-medium text-gray-700 mb-2">
                    곡명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="songTitle"
                    name="songTitle"
                    value={formData.songTitle}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="제작을 원하는 곡명을 입력해주세요"
                  />
                </div>
                <div>
                  <label htmlFor="artist" className="block text-sm font-medium text-gray-700 mb-2">
                    아티스트
                  </label>
                  <input
                    type="text"
                    id="artist"
                    name="artist"
                    value={formData.artist}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="아티스트명을 입력해주세요"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="songUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  곡 URL (YouTube, Spotify 등)
                </label>
                <input
                  type="url"
                  id="songUrl"
                  name="songUrl"
                  value={formData.songUrl}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="곡을 들을 수 있는 URL을 입력해주세요 (선택사항)"
                />
                <p className="text-xs text-gray-500 mt-1">정확한 분석을 위해 곡 URL을 제공해주시면 도움이 됩니다</p>
              </div>
            </div>

            {/* Memo */}
            <div>
              <label htmlFor="memo" className="block text-sm font-medium text-gray-700 mb-2">
                메모
              </label>
              <textarea
                id="memo"
                name="memo"
                value={formData.memo}
                onChange={handleInputChange}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                placeholder="참고사항이나 메모가 있으시면 입력해주세요 (최대 500자)"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.memo.length}/500자</p>
            </div>

            {/* Submit Button */}
            <div className="border-t pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap disabled:bg-gray-400"
              >
                {isSubmitting ? '신청 중...' : '주문제작 신청하기'}
              </button>
              <p className="text-sm text-gray-500 text-center mt-4">
                신청 후 마이페이지 "주문제작 신청내역"에서 진행상황을 확인하실 수 있으며, 완료 후 악보를 다운로드 받으실 수 있습니다.
              </p>
            </div>
          </form>
        </div>

        {/* Process Section */}
        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">주문제작 진행과정</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-file-text-line text-2xl text-orange-600"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">신청서 접수</h3>
              <p className="text-sm text-gray-600">주문제작 신청서를 제출하면 접수가 완료됩니다.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-mail-line text-2xl text-blue-600"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">견적서 발송</h3>
              <p className="text-sm text-gray-600">곡을 분석하여 마이페이지를 통해 견적을 안내드립니다.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-bank-card-line text-2xl text-green-600"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">입금 확인</h3>
              <p className="text-sm text-gray-600">견적 확인 후 입금하시면 제작이 시작됩니다.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-download-line text-2xl text-purple-600"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">제작 완료</h3>
              <p className="text-sm text-gray-600">완성된 악보를 마이페이지에서 다운로드 받으실 수 있습니다.</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">자주 묻는 질문</h2>
          
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <i className="ri-question-line text-blue-600 mr-2"></i>
                견적서는 어떻게 확인하나요?
              </h3>
              <p className="text-gray-600 ml-6">
                마이페이지의 "주문제작 신청내역"에서 견적을 확인하실 수 있습니다. 
                신청 후 24시간 내에 견적을 안내해드립니다.
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <i className="ri-question-line text-blue-600 mr-2"></i>
                제작 기간은 얼마나 걸리나요?
              </h3>
              <p className="text-gray-600 ml-6">
                일반적으로 입금 확인 후 7-14일 정도 소요됩니다. 
                곡의 난이도와 길이에 따라 기간이 달라질 수 있으며, 견적서에서 정확한 일정을 안내해드립니다.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <i className="ri-question-line text-blue-600 mr-2"></i>
                결제 방법은 어떻게 되나요?
              </h3>
              <p className="text-gray-600 ml-6">
                현재 무통장 입금만 가능합니다. 
                견적서와 함께 입금 계좌 정보를 안내해드립니다.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">악보요청</h3>
              <p className="text-gray-400 text-sm">
                전문적인 드럼 악보 제작 서비스를 제공합니다.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">서비스</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/categories" className="hover:text-white cursor-pointer">악보 카테고리</a></li>
                <li><a href="/custom-order" className="hover:text-white cursor-pointer">주문제작</a></li>
                <li><a href="#" className="hover:text-white cursor-pointer">신규 악보</a></li>
                <li><a href="#" className="hover:text-white cursor-pointer">인기 악보</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">고객지원</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white cursor-pointer">FAQ</a></li>
                <li><a href="#" className="hover:text-white cursor-pointer">문의하기</a></li>
                <li><a href="#" className="hover:text-white cursor-pointer">이용약관</a></li>
                <li><a href="#" className="hover:text-white cursor-pointer">개인정보처리방침</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">연락처</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>이메일: info@drumsheets.com</li>
                <li>전화: 02-1234-5678</li>
                <li>운영시간: 평일 9:00-18:00</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 악보요청. All rights reserved. | <a href="https://readdy.ai/?origin=logo" className="hover:text-white cursor-pointer">Website Builder</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomOrderPage;
