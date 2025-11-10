
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface CustomOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  song_title: string;
  artist: string;
  song_url: string;
  requirements: string;
  status: 'pending' | 'quoted' | 'paid' | 'completed' | 'cancelled';
  admin_reply: string;
  quoted_price: number;
  created_at: string;
  updated_at: string;
}

const statusLabels = {
  pending: '신청완료',
  quoted: '견적발송',
  paid: '입금확인',
  completed: '제작완료',
  cancelled: '취소됨'
};

const statusColors = {
  pending: 'bg-blue-100 text-blue-800',
  quoted: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600">주문제작 신청내역을 확인하려면 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">주문제작 신청내역</h1>
          <p className="mt-2 text-gray-600">신청하신 주문제작의 진행상황을 확인하세요.</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
              <i className="ri-file-list-3-line text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">신청내역이 없습니다</h3>
            <p className="text-gray-600 mb-6">아직 주문제작을 신청하지 않으셨습니다.</p>
            <a
              href="/custom-order"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="ri-add-line mr-2"></i>
              주문제작 신청하기
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{order.song_title}</h3>
                      {order.artist && (
                        <p className="text-gray-600">{order.artist}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">신청일</p>
                      <p className="font-medium">{new Date(order.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">신청자</p>
                      <p className="font-medium">{order.name}</p>
                    </div>
                  </div>

                  {order.requirements && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">요청사항</p>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{order.requirements}</p>
                    </div>
                  )}

                  {order.song_url && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">참고 URL</p>
                      <a
                        href={order.song_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        {order.song_url}
                      </a>
                    </div>
                  )}

                  {order.admin_reply && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3 mt-1">
                          <i className="ri-admin-line text-white text-sm"></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-blue-900">관리자 답변</h4>
                            {order.quoted_price && (
                              <span className="text-lg font-bold text-blue-600">
                                {order.quoted_price.toLocaleString()}원
                              </span>
                            )}
                          </div>
                          <p className="text-blue-800 whitespace-pre-wrap">{order.admin_reply}</p>
                          <p className="text-xs text-blue-600 mt-2">
                            {new Date(order.updated_at).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {order.status === 'quoted' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center">
                        <i className="ri-information-line text-yellow-600 mr-2"></i>
                        <p className="text-yellow-800 text-sm">
                          견적을 확인하시고 입금해주시면 제작을 시작합니다. 
                          입금 후 고객센터로 연락주세요.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
