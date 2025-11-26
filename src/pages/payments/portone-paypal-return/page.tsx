import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';

export default function PortOnePayPalReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    orderId?: string;
    imp_uid?: string;
  } | null>(null);

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        // 포트원은 결제 완료 후 m_redirect_url로 리다이렉트
        // URL 파라미터에서 결제 결과 확인
        const imp_uid = searchParams.get('imp_uid') || '';
        const merchant_uid = searchParams.get('merchant_uid') || '';
        const imp_success = searchParams.get('imp_success') || '';
        const error_code = searchParams.get('error_code') || '';
        const error_msg = searchParams.get('error_msg') || '';

        console.log('[portone-paypal-return] 결제 반환 파라미터', {
          imp_uid,
          merchant_uid,
          imp_success,
          error_code,
          error_msg,
        });

        // 결제 성공 여부 확인
        if (imp_success === 'true' && imp_uid && merchant_uid) {
          // 프론트엔드에서는 UI만 표시
          // 실제 결제 상태 검증 및 업데이트는 서버(Webhook 또는 서버 검증)에서 처리됨
          console.log('[portone-paypal-return] 결제 성공 UI 표시', {
            imp_uid,
            merchant_uid,
            note: '서버에서 결제 상태를 검증하고 업데이트합니다.',
          });

          setResult({
            success: true,
            message: t('payment.success') || 'Payment successful!',
            orderId: merchant_uid,
            imp_uid,
          });

          // 2초 후 주문 내역 페이지로 이동
          setTimeout(() => {
            navigate('/my-orders');
          }, 2000);
        } else {
          // 결제 실패 또는 취소
          const errorMessage =
            error_msg || t('payment.failed') || 'Payment failed. Please try again.';
          setResult({
            success: false,
            message: errorMessage,
            orderId: merchant_uid || undefined,
          });
        }
      } catch (error) {
        console.error('[portone-paypal-return] 결제 반환 처리 오류', error);
        setResult({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : t('payment.failed') || 'Payment processing error.',
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
            {result.imp_uid && (
              <p className="text-xs text-gray-500 mb-4">
                Transaction ID: {result.imp_uid}
              </p>
            )}
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
            <p className="text-gray-600 mb-4">
              {result?.message || 'An error occurred during payment processing.'}
            </p>
            <div className="space-y-3 mt-6">
              <button
                onClick={() => navigate('/my-orders')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('button.back') || 'Go to My Orders'}
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('button.home') || 'Go to Home'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

