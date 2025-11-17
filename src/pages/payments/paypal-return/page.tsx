import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { approvePayPalPayment } from '../../../lib/payments/paypal';
import { useTranslation } from 'react-i18next';

export default function PayPalReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    orderId?: string;
  } | null>(null);

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        // PayPal은 returnUrl로 리다이렉트되며 token과 PayerID를 전달
        const token = searchParams.get('token') || '';
        const payerId = searchParams.get('PayerID') || '';

        // sessionStorage에서 저장된 주문 정보 확인
        const savedOrderId = sessionStorage.getItem('paypal_order_id');
        const savedPayPalOrderId = sessionStorage.getItem('paypal_paypal_order_id');

        const orderId = savedOrderId || '';
        const paypalOrderId = savedPayPalOrderId || token || '';

        if (!orderId || !paypalOrderId) {
          setResult({
            success: false,
            message: t('payment.failed') || 'Payment information not found.',
          });
          setProcessing(false);
          return;
        }

        // PayPal 결제 승인
        const approvalResult = await approvePayPalPayment({
          orderId,
          paypalOrderId,
          payerId: payerId || undefined,
        });

        if (approvalResult.success) {
          // sessionStorage 정리
          sessionStorage.removeItem('paypal_order_id');
          sessionStorage.removeItem('paypal_paypal_order_id');

          setResult({
            success: true,
            message: t('payment.success') || 'Payment successful!',
            orderId: approvalResult.orderId,
          });

          // 2초 후 주문 내역 페이지로 이동
          setTimeout(() => {
            navigate('/my-orders');
          }, 2000);
        } else {
          setResult({
            success: false,
            message: t('payment.failed') || 'Payment failed. Please try again.',
          });
        }
      } catch (error) {
        console.error('PayPal payment return error:', error);
        setResult({
          success: false,
          message: error instanceof Error ? error.message : t('payment.failed') || 'Payment processing error.',
        });
      } finally {
        setProcessing(false);
      }
    };

    processPaymentReturn();
  }, [searchParams, navigate, t]);

  if (processing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line w-8 h-8 animate-spin text-blue-600 mx-auto mb-4"></i>
          <p className="text-gray-600">{t('payment.processing') || 'Processing payment...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        {result?.success ? (
          <>
            <div className="mb-4">
              <i className="ri-checkbox-circle-line text-6xl text-green-500"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('payment.success') || 'Payment Successful!'}
            </h2>
            <p className="text-gray-600 mb-4">{result.message}</p>
            <p className="text-sm text-gray-500 mb-4">
              {t('payment.redirecting') || 'Redirecting to order history...'}
            </p>
          </>
        ) : (
          <>
            <div className="mb-4">
              <i className="ri-error-warning-line text-6xl text-red-500"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('payment.failed') || 'Payment Failed'}
            </h2>
            <p className="text-gray-600 mb-4">{result?.message || 'An error occurred during payment processing.'}</p>
            <button
              onClick={() => navigate('/my-orders')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('button.back') || 'Go to My Orders'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

