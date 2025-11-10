
import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('../pages/home/page'));
const CategoriesPage = lazy(() => import('../pages/categories/page'));
const CustomOrderPage = lazy(() => import('../pages/custom-order/page'));
const SheetDetailPage = lazy(() => import('../pages/sheet-detail/page'));
const CartPage = lazy(() => import('../pages/cart/page'));
const MyPage = lazy(() => import('../pages/mypage/page'));
const LoginPage = lazy(() => import('../pages/auth/login'));
const RegisterPage = lazy(() => import('../pages/auth/register'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/forgot-password'));
const ResetPasswordPage = lazy(() => import('../pages/auth/reset-password'));
const AdminPage = lazy(() => import('../pages/admin/page'));
const MyOrdersPage = lazy(() => import('../pages/my-orders/page'));
const CustomOrdersPage = lazy(() => import('../pages/custom-orders/page'));
const CustomerSupportPage = lazy(() => import('../pages/customer-support/page'));
const EventSalePage = lazy(() => import('../pages/event-sale/page'));
const CollectionsPage = lazy(() => import('../pages/collections/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <i className="ri-loader-4-line w-8 h-8 animate-spin text-blue-600 mx-auto mb-4"></i>
      <p className="text-gray-600">로딩 중...</p>
    </div>
  </div>
);

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/categories',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CategoriesPage />
      </Suspense>
    ),
  },
  {
    path: '/custom-order',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CustomOrderPage />
      </Suspense>
    ),
  },
  {
    path: '/sheet/:id',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <SheetDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/cart',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CartPage />
      </Suspense>
    ),
  },
  {
    path: '/mypage',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <MyPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ForgotPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminPage />
      </Suspense>
    ),
  },
  {
    path: '/my-orders',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <MyOrdersPage />
      </Suspense>
    ),
  },
  {
    path: '/custom-orders',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CustomOrdersPage />
      </Suspense>
    ),
  },
  {
    path: '/customer-support',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CustomerSupportPage />
      </Suspense>
    ),
  },
  {
    path: '/event-sale',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EventSalePage />
      </Suspense>
    ),
  },
  {
    path: '/collections',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CollectionsPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
];

export default routes;
