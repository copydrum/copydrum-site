import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const CustomOrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (order: any) => {
    if (!order.completed_pdf_url) return;

    // 다운로드 횟수 체크
    if (order.download_count >= order.max_download_count) {
      alert('다운로드 횟수를 초과했습니다. 고객센터에 문의해주세요.');
      return;
    }

    // 다운로드 만료일 체크
    if (new Date() > new Date(order.download_expires_at)) {
      alert('다운로드 기간이 만료되었습니다. 고객센터에 문의해주세요.');
      return;
    }

    try {
      // 다운로드 횟수 증가
      const { error: updateError } = await supabase
        .from('custom_orders')
        .update({ 
          download_count: (order.download_count || 0) + 1 
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // 파일 다운로드
      const response = await fetch(order.completed_pdf_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = order.completed_pdf_filename || `${order.song_title}_악보.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 상태 새로고침
      fetchOrders();
      
      alert('악보 다운로드가 완료되었습니다.');
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('다운로드에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비게이션 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-xl font-bold text-gray-800" style={{ fontFamily: '"Pacifico", serif' }}>
                logo
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/" className="text-gray-600 hover:text-gray-800">홈</a>
                <a href="/categories" className="text-gray-600 hover:text-gray-800">악보 카테고리</a>
                <a href="/custom-order" className="text-gray-600 hover:text-gray-800">주문제작</a>
                <a href="/custom-orders" className="text-blue-600 font-medium">주문제작 신청내역</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/cart" className="text-gray-600 hover:text-gray-800">
                <i className="ri-shopping-cart-line text-xl"></i>
              </a>
              <a href="/mypage" className="text-gray-600 hover:text-gray-800">
                <i className="ri-user-line text-xl"></i>
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">주문제작 신청내역</h1>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">로딩 중...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-file-list-3-line text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-600">주문제작 신청내역이 없습니다.</p>
              <a href="/custom-order" className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                주문제작 신청하기
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{order.song_title}</h3>
                      <p className="text-sm text-gray-600">아티스트: {order.artist}</p>
                      <p className="text-xs text-gray-500">신청일: {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'quote_sent' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'payment_confirmed' ? 'bg-green-100 text-green-800' :
                      order.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status === 'pending' ? '신청완료' :
                       order.status === 'quote_sent' ? '견적발송' :
                       order.status === 'payment_confirmed' ? '입금확인' :
                       order.status === 'completed' ? '제작완료' : order.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-700 mb-2"><strong>요청사항:</strong></p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{order.requirements}</p>
                  </div>

                  {order.youtube_url && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 mb-2"><strong>참고 영상:</strong></p>
                      <a href={order.youtube_url} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:text-blue-800 text-sm break-all">
                        {order.youtube_url}
                      </a>
                    </div>
                  )}

                  {order.admin_reply && (
                    <div className="mb-4 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-start">
                        <i className="ri-admin-line text-blue-600 text-lg mr-2 mt-0.5"></i>
                        <div>
                          <p className="text-sm font-medium text-blue-800 mb-1">관리자 답글</p>
                          <p className="text-sm text-blue-700">{order.admin_reply}</p>
                          <p className="text-xs text-blue-600 mt-2">
                            답글일: {order.updated_at ? new Date(order.updated_at).toLocaleDateString() : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {order.status === 'completed' && order.completed_pdf_url && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start">
                          <i className="ri-file-download-line text-green-600 text-lg mr-2 mt-0.5"></i>
                          <div>
                            <p className="text-sm font-medium text-green-800 mb-1">완성된 악보</p>
                            <p className="text-sm text-green-700">{order.completed_pdf_filename}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-green-600">
                              <span>다운로드: {order.download_count || 0}/{order.max_download_count || 5}회</span>
                              <span>만료일: {new Date(order.download_expires_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(order)}
                          disabled={
                            (order.download_count >= order.max_download_count) ||
                            (new Date() > new Date(order.download_expires_at))
                          }
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                        >
                          <i className="ri-download-line"></i>
                          다운로드
                        </button>
                      </div>
                      
                      {(order.download_count >= order.max_download_count) && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <i className="ri-error-warning-line mr-1"></i>
                          다운로드 횟수를 초과했습니다. 추가 다운로드가 필요하시면 고객센터에 문의해주세요.
                        </div>
                      )}
                      
                      {(new Date() > new Date(order.download_expires_at)) && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <i className="ri-time-line mr-1"></i>
                          다운로드 기간이 만료되었습니다. 고객센터에 문의해주세요.
                        </div>
                      )}
                    </div>
                  )}

                  {order.status === 'quote_sent' && (
                    <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                      <div className="flex items-center">
                        <i className="ri-information-line text-yellow-600 mr-2"></i>
                        <p className="text-sm text-yellow-800">
                          견적을 확인하시고 입금 후 고객센터로 연락주시면 제작을 시작합니다.
                        </p>
                      </div>
                    </div>
                  )}

                  {order.status === 'payment_confirmed' && (
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center">
                        <i className="ri-tools-line text-blue-600 mr-2"></i>
                        <p className="text-sm text-blue-800">
                          입금이 확인되었습니다. 현재 악보 제작 중입니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CustomOrdersPage;