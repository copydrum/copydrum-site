
import type { RouteObject } from 'react-router-dom';
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
const AuthCallbackPage = lazy(() => import('../pages/auth/callback'));
const AdminPage = lazy(() => import('../pages/admin/page'));
const MyOrdersPage = lazy(() => import('../pages/my-orders/page'));
const CustomOrdersPage = lazy(() => import('../pages/custom-orders/page'));
const CustomOrderDetailPage = lazy(() => import('../pages/custom-order-detail/page'));
const CustomerSupportPage = lazy(() => import('../pages/customer-support/page'));
const GuidePage = lazy(() => import('../pages/guide/page'));
const EventSalePage = lazy(() => import('../pages/event-sale/page'));
const EventSaleDetailPage = lazy(() => import('../pages/event-sale/detail'));
const CollectionsPage = lazy(() => import('../pages/collections/page'));
const CollectionDetailPage = lazy(() => import('../pages/collections/detail'));
const FreeSheetsPage = lazy(() => import('../pages/free-sheets/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));
const CompanyAboutPage = lazy(() => import('../pages/company/about'));
const PartnershipPage = lazy(() => import('../pages/company/partnership'));
const BusinessInfoPage = lazy(() => import('../pages/company/business-info'));
const InicisReturnPage = lazy(() => import('../pages/payments/inicis-return/page'));
const InicisClosePage = lazy(() => import('../pages/payments/inicis-close/page'));
const PayPalReturnPage = lazy(() => import('../pages/payments/paypal-return/page'));
const PayPalCancelPage = lazy(() => import('../pages/payments/paypal-cancel/page'));
const PortOnePayPalReturnPage = lazy(() => import('../pages/payments/portone-paypal-return/page'));
const PortonePaypalTestPage = lazy(() => import('../pages/dev/PortonePaypalTest'));
const RefundPolicyPage = lazy(() => import('../pages/policy/RefundPolicyPage'));

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
    path: '/sheet-detail/:id',
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
    path: '/auth/login',
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
    path: '/auth/register',
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
    path: '/auth/forgot-password',
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
    path: '/auth/reset-password',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <AuthCallbackPage />
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
    path: '/custom-order-detail/:id',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CustomOrderDetailPage />
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
    path: '/guide',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <GuidePage />
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
    path: '/event-sale/:eventId',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EventSaleDetailPage />
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
    path: '/collections/:collectionId',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CollectionDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/free-sheets',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <FreeSheetsPage />
      </Suspense>
    ),
  },
  {
    path: '/company/about',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <CompanyAboutPage />
      </Suspense>
    ),
  },
  {
    path: '/company/business-info',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <BusinessInfoPage />
      </Suspense>
    ),
  },
  {
    path: '/company/partnership',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PartnershipPage />
      </Suspense>
    ),
  },
  {
    path: '/payments/inicis/return',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <InicisReturnPage />
      </Suspense>
    ),
  },
  {
    path: '/payments/inicis/close',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <InicisClosePage />
      </Suspense>
    ),
  },
  {
    path: '/payments/paypal/return',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PayPalReturnPage />
      </Suspense>
    ),
  },
  {
    path: '/payments/paypal/cancel',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PayPalCancelPage />
      </Suspense>
    ),
  },
  {
    path: '/payments/portone-paypal/return',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PortOnePayPalReturnPage />
      </Suspense>
    ),
  },
  {
    path: '/dev/paypal-test',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PortonePaypalTestPage />
      </Suspense>
    ),
  },
  {
    path: '/policy/refund',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <RefundPolicyPage />
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
