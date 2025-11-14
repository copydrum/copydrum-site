
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import UserSidebar from '../../components/feature/UserSidebar';
import MainHeader from '../../components/common/MainHeader';

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
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />

      {/* User Sidebar - 로그인 시 항상 표시 */}
      <UserSidebar user={user} />

      {/* Main Content - 로그인 시 사이드바 공간 확보 */}
      <div className={user ? 'md:mr-64' : ''}>
        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-10 md:mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 md:text-4xl md:mb-4">악보 주문제작</h1>
          <div className="text-base text-gray-600 max-w-2xl mx-auto space-y-2 md:text-xl">
            <p>원하시는 곡이 있으신가요?</p>
            <p>전문가가 직접 분석하고 정성껏 드럼 악보를 제작해드립니다.</p>
            <p>곡의 난이도와 구성에 따라 맞춤 견적을 안내드립니다.</p>
          </div>
        </div>

        {/* Pricing Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-10 border border-blue-100 md:p-8 md:mb-12">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-5 md:text-2xl md:mb-6">가격 안내</h2>
          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            <div className="bg-white rounded-lg p-5 shadow-sm border border-emerald-100 md:p-6">
              <div className="bg-emerald-100 text-emerald-800 text-center py-3 rounded-lg mb-3 md:mb-4">
                <h3 className="text-lg font-bold md:text-xl">C등급</h3>
                <p className="text-base font-semibold md:text-lg">1만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed md:text-base">
                일반적인 가요, 팝, 성인가요 등의 5분이내의 곡
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-5 shadow-sm border border-amber-100 md:p-6">
              <div className="bg-amber-100 text-amber-800 text-center py-3 rounded-lg mb-3 md:mb-4">
                <h3 className="text-lg font-bold md:text-xl">B등급</h3>
                <p className="text-base font-semibold md:text-lg">3만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed md:text-base">
                중급 난이도보다 조금 높거나 5분이상의 곡
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-5 shadow-sm border border-rose-100 md:p-6">
              <div className="bg-rose-100 text-rose-800 text-center py-3 rounded-lg mb-3 md:mb-4">
                <h3 className="text-lg font-bold md:text-xl">A등급</h3>
                <p className="text-base font-semibold md:text-lg">5만원 이상</p>
              </div>
              <p className="text-gray-700 text-center text-sm leading-relaxed md:text-base">
                고급 난이도의 곡
              </p>
            </div>
          </div>
          <div className="text-center mt-5 md:mt-6">
            <p className="text-xs text-gray-600 md:text-sm">
              * 최종 가격은 곡의 난이도와 길이를 분석한 후 개별 견적으로 안내드립니다.
            </p>
          </div>
        </div>

        {/* Order Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-5 md:text-2xl md:mb-6">주문제작 신청서</h2>
          
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
              
              <div className="grid gap-5 md:grid-cols-2 md:gap-6">
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
                  유튜브 URL
                </label>
                <input
                  type="url"
                  id="songUrl"
                  name="songUrl"
                  value={formData.songUrl}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="정확한 악보 제작을 위해 유튜브 URL을 입력해주세요. (선택사항)"
                />
                <p className="text-xs text-gray-500 mt-1">정확한 악보 제작을 위해 유튜브 URL을 입력해주세요. (선택사항)</p>
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
                일반적으로 입금 확인 후 1-3일 정도 소요됩니다. 
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
      </div>
    </div>
  );
};

export default CustomOrderPage;
