import { createPendingOrder } from './orderUtils';
import {
  createInicisPaymentIntent,
  ensureInicisSdkLoaded,
  submitInicisPaymentForm,
  getInicisReturnUrl,
} from './inicis';
import { requestPayPalPayment, getPortOneReturnUrl } from './portone';
import type { PaymentIntentResponse, PaymentStatus, VirtualAccountInfo } from './types';
import { updateOrderPaymentStatus } from './paymentService';
import { supabase } from '../supabase';

type SupportedChargeMethod = 'card' | 'bank_transfer' | 'paypal';

interface StartCashChargeParams {
  userId: string;
  amount: number;
  bonusAmount?: number;
  paymentMethod: SupportedChargeMethod;
  description: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
  depositorName?: string;
  returnUrl?: string;
}

interface StartCashChargeResult {
  orderId: string;
  orderNumber: string | null;
  amount: number;
  paymentMethod: SupportedChargeMethod;
  paymentIntent?: PaymentIntentResponse;
  virtualAccountInfo?: VirtualAccountInfo | null;
}

const mapToPaymentStatus = (method: SupportedChargeMethod): PaymentStatus =>
  method === 'bank_transfer' ? 'awaiting_deposit' : 'pending';

export const startCashCharge = async ({
  userId,
  amount,
  bonusAmount = 0,
  paymentMethod,
  description,
  buyerName,
  buyerEmail,
  buyerTel,
  depositorName,
  returnUrl,
}: StartCashChargeParams): Promise<StartCashChargeResult> => {
  const trimmedDepositorName = depositorName?.trim();

  const { orderId, orderNumber } = await createPendingOrder({
    userId,
    amount,
    paymentMethod,
    description,
    paymentStatus: mapToPaymentStatus(paymentMethod),
    metadata: {
      type: 'cash_charge',
      bonusAmount,
    },
    orderType: 'cash', // 주문 타입 추가
  });

  if (paymentMethod === 'bank_transfer') {
    // 페이액션 연동 제거, 간단한 무통장 입금 처리
    // depositor_name 추가 - 입금자명 저장
    if (trimmedDepositorName) {
      await updateOrderPaymentStatus(orderId, 'awaiting_deposit', {
        depositorName: trimmedDepositorName,
      });
    }

    // 고정 계좌 정보 반환
    const bankInfo: VirtualAccountInfo = {
      bankName: '농협',
      accountNumber: '106-02-303742',
      accountHolder: '강만수',
      amount,
      depositor: '강만수',
      expectedDepositor: trimmedDepositorName ?? undefined,
      expiresAt: null, // 무기한
    };

    return {
      orderId,
      orderNumber,
      amount,
      paymentMethod,
      virtualAccountInfo: bankInfo,
    };
  }

  if (paymentMethod === 'paypal') {
    // 포트원을 통한 PayPal 결제 처리
    const finalReturnUrl = returnUrl || getPortOneReturnUrl();

    try {
      const result = await requestPayPalPayment({
        amount,
        orderId,
        buyerEmail: buyerEmail ?? undefined,
        buyerName: buyerName ?? undefined,
        buyerTel: buyerTel ?? undefined,
        description,
        returnUrl: finalReturnUrl,
      });

      if (result.success) {
        // 결제 성공 - 포트원 콜백에서 이미 처리됨
        // 리다이렉트는 포트원이 자동으로 처리
        return {
          orderId,
          orderNumber,
          amount,
          paymentMethod,
        };
      } else {
        // 결제 실패
        throw new Error(result.error_msg || 'PayPal 결제가 실패했습니다.');
      }
    } catch (error) {
      console.error('[cashCharge] PayPal 결제 오류', error);
      throw error;
    }
  }

  // 카드 결제
  // returnUrl이 지정되지 않으면 클라이언트 페이지 URL 사용 (GET 파라미터 방식)
  // KG이니시스 관리자 콘솔에서 GET 전달 방식 활성화 필요
  const finalReturnUrl = returnUrl || getInicisReturnUrl();

  const intent = await createInicisPaymentIntent({
    userId,
    amount,
    description,
    method: 'card',
    orderId,
    bonusAmount,
    returnUrl: finalReturnUrl,
    buyerName: buyerName ?? undefined,
    buyerEmail: buyerEmail ?? undefined,
    buyerTel: buyerTel ?? undefined,
  });

  if (intent.requestForm) {
    // 주문 ID를 sessionStorage에 저장 (결제 반환 페이지에서 사용)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inicis_order_id', orderId);
    }
    
    await ensureInicisSdkLoaded();
    submitInicisPaymentForm(intent.requestForm);
  }

  return {
    orderId,
    orderNumber,
    amount,
    paymentMethod,
    paymentIntent: intent,
  };
};

