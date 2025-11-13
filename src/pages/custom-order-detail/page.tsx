import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import CustomOrderDetail from '@/components/customer/CustomOrderDetail';
import MainHeader from '@/components/common/MainHeader';
import UserSidebar from '@/components/feature/UserSidebar';

const CustomOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!id) {
      navigate('/custom-orders', { replace: true });
    }
  }, [id, navigate]);

  if (!id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader user={user} />
      <UserSidebar user={user} />

      <div className={user ? 'mr-64' : ''}>
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">주문제작 상세</h1>
              <p className="mt-1 text-sm text-gray-500">
                진행 상황과 관리자와의 대화를 확인하고 완료된 악보를 다운로드하세요.
              </p>
            </div>
            <button
              onClick={() => navigate('/custom-orders')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <i className="ri-arrow-left-line"></i>
              목록으로
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <CustomOrderDetail orderId={id} key={id} />
          </div>

          {!user && (
            <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
              주문제작 상세를 확인하려면 로그인해주세요.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CustomOrderDetailPage;

