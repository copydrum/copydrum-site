import { createPendingOrder } from './orderUtils';
import {
  createInicisPaymentIntent,
  ensureInicisSdkLoaded,
  submitInicisPaymentForm,
} from './inicis';
import type { PaymentIntentResponse, PaymentStatus, VirtualAccountInfo } from './types';
import { updateOrderPaymentStatus } from './paymentService';
import { supabase } from '../supabase';

type SupportedChargeMethod = 'card' | 'bank_transfer';

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
  });

  if (paymentMethod === 'bank_transfer') {
    // 페이액션 연동 제거, 간단한 무통장 입금 처리
    // 입금자명 저장
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

  // 카드 결제는 현재 비활성화되어 있지만 기존 로직 유지
  const intent = await createInicisPaymentIntent({
    userId,
    amount,
    description,
    method: 'card',
    orderId,
    bonusAmount,
    returnUrl,
    buyerName: buyerName ?? undefined,
    buyerEmail: buyerEmail ?? undefined,
    buyerTel: buyerTel ?? undefined,
  });

  if (intent.requestForm) {
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

