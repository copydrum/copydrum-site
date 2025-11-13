import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const STATUS_META: Record<
  string,
  { label: string; badgeClass: string; infoClass?: string; message?: string; icon?: string }
> = {
  pending: {
    label: '견적중',
    badgeClass: 'bg-amber-100 text-amber-700',
    infoClass: 'bg-amber-50 border-l-4 border-amber-400 text-amber-800',
    message: '요청을 확인하고 맞춤 견적을 준비 중입니다.',
    icon: 'ri-time-line',
  },
  quoted: {
    label: '결제대기',
    badgeClass: 'bg-sky-100 text-sky-700',
    infoClass: 'bg-sky-50 border-l-4 border-sky-400 text-sky-800',
    message: '견적이 도착했습니다. 안내된 금액으로 입금해주시면 제작이 시작됩니다.',
    icon: 'ri-information-line',
  },
  payment_confirmed: {
    label: '입금확인',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    infoClass: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-800',
    message: '입금이 확인되었습니다. 제작 순서에 맞춰 준비 중입니다.',
    icon: 'ri-check-line',
  },
  in_progress: {
    label: '작업중',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    infoClass: 'bg-indigo-50 border-l-4 border-indigo-400 text-indigo-800',
    message: '전문가가 악보를 제작하고 있습니다. 완료 시 알림을 드립니다.',
    icon: 'ri-tools-line',
  },
  completed: {
    label: '작업완료',
    badgeClass: 'bg-purple-100 text-purple-700',
    infoClass: 'bg-green-50 border-l-4 border-green-400 text-green-800',
    message: '악보 제작이 완료되었습니다. 아래에서 PDF 파일을 다운로드하세요.',
    icon: 'ri-star-smile-line',
  },
  cancelled: {
    label: '취소됨',
    badgeClass: 'bg-gray-200 text-gray-600',
  },
};

const CustomOrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

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

    const maxDownload = order.max_download_count ?? 5;
    const usedCount = order.download_count ?? 0;
    if (usedCount >= maxDownload) {
      alert('다운로드 횟수를 초과했습니다. 고객센터에 문의해주세요.');
      return;
    }

    if (order.download_expires_at) {
      const expires = new Date(order.download_expires_at);
      if (!Number.isNaN(expires.getTime()) && new Date() > expires) {
        alert('다운로드 기간이 만료되었습니다. 고객센터에 문의해주세요.');
        return;
      }
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
      await fetchOrders();

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
              {orders.map((order) => {
                const meta = STATUS_META[order.status] ?? STATUS_META.pending;
                const maxDownload = order.max_download_count ?? 5;
                const usedCount = order.download_count ?? 0;
                const downloadExpiresAt = order.download_expires_at
                  ? new Date(order.download_expires_at)
                  : null;
                const downloadExpired =
                  downloadExpiresAt && !Number.isNaN(downloadExpiresAt.getTime())
                    ? new Date() > downloadExpiresAt
                    : false;

                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{order.song_title}</h3>
                        <p className="text-sm text-gray-600">아티스트: {order.artist}</p>
                        <p className="text-xs text-gray-500">
                          신청일: {new Date(order.created_at).toLocaleDateString()}
                        </p>
                        {typeof order.estimated_price === 'number' && order.estimated_price > 0 && (
                          <p className="mt-1 text-xs text-blue-600">
                            견적 금액: ₩{order.estimated_price.toLocaleString('ko-KR')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {order.status === 'quoted' && (
                          <p className="text-xs font-semibold text-gray-700">
                            {order.estimated_price && typeof order.estimated_price === 'number' && order.estimated_price > 0
                              ? `견적: ₩${order.estimated_price.toLocaleString('ko-KR')}`
                              : '견적 확인'}
                          </p>
                        )}
                        {order.status === 'completed' && !order.estimated_price && (
                          <p className="text-xs font-semibold text-gray-700">작업완료</p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>요청사항:</strong>
                      </p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {order.requirements || '추가 요청사항이 없습니다.'}
                      </p>
                    </div>

                    {order.song_url && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>참고 영상:</strong>
                        </p>
                        <a
                          href={order.song_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm break-all"
                        >
                          {order.song_url}
                        </a>
                      </div>
                    )}

                    {order.admin_reply && (
                      <div className="mb-4 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                        <div className="flex items-start gap-2">
                          <i className="ri-admin-line text-blue-600 text-lg mt-0.5"></i>
                          <div>
                            <p className="text-sm font-medium text-blue-800 mb-1">관리자 답글</p>
                            <p className="text-sm text-blue-700 whitespace-pre-wrap">
                              {order.admin_reply}
                            </p>
                            <p className="text-xs text-blue-600 mt-2">
                              답글일:{' '}
                              {order.updated_at
                                ? new Date(order.updated_at).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'completed' && order.completed_pdf_url && (
                      <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3">
                            <i className="ri-file-download-line text-green-600 text-lg mt-1"></i>
                            <div>
                              <p className="text-sm font-medium text-green-800 mb-1">완성된 악보</p>
                              <p className="text-sm text-green-700">
                                {order.completed_pdf_filename ?? '완성된 악보.pdf'}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-green-700">
                                <span>
                                  다운로드 {usedCount}/{maxDownload}회
                                </span>
                                {downloadExpiresAt && !Number.isNaN(downloadExpiresAt.getTime()) && (
                                  <span>만료일 {downloadExpiresAt.toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownload(order)}
                            disabled={usedCount >= maxDownload || downloadExpired}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            <i className="ri-download-line"></i>
                            다운로드
                          </button>
                        </div>

                        {usedCount >= maxDownload && (
                          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            <i className="ri-error-warning-line mr-1"></i>
                            다운로드 횟수를 초과했습니다. 추가 다운로드가 필요하시면 고객센터에 문의해주세요.
                          </div>
                        )}

                        {downloadExpired && (
                          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            <i className="ri-time-line mr-1"></i>
                            다운로드 가능 기간이 만료되었습니다. 고객센터에 문의해주세요.
                          </div>
                        )}
                      </div>
                    )}

                    {meta.message && meta.infoClass && (
                      <div className={`${meta.infoClass} mt-4 flex items-start gap-2 rounded-lg px-4 py-3`}>
                        {meta.icon ? <i className={`${meta.icon} mt-0.5 text-base`}></i> : null}
                        <p className="text-sm leading-relaxed">{meta.message}</p>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-gray-400">
                        최근 업데이트:{' '}
                        {order.updated_at
                          ? new Date(order.updated_at).toLocaleString('ko-KR')
                          : new Date(order.created_at).toLocaleString('ko-KR')}
                      </p>
                      <button
                        onClick={() => navigate(`/custom-order-detail/${order.id}`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <i className="ri-chat-1-line"></i>
                        상세 보기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CustomOrdersPage;