import { createOrderWithItems } from './orderUtils';
import {
  createInicisPaymentIntent,
  ensureInicisSdkLoaded,
  submitInicisPaymentForm,
} from './inicis';
import { updateOrderPaymentStatus } from './paymentService';
import type { VirtualAccountInfo, PaymentIntentResponse } from './types';

type PurchaseMethod = 'card' | 'bank_transfer';

export interface PurchaseItem {
  sheetId: string;
  sheetTitle?: string | null;
  price: number;
}

interface StartSheetPurchaseParams {
  userId: string;
  items: PurchaseItem[];
  amount: number;
  paymentMethod: PurchaseMethod;
  description: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
  depositorName?: string;
  returnUrl?: string;
}

export interface StartSheetPurchaseResult {
  orderId: string;
  orderNumber: string | null;
  amount: number;
  paymentMethod: PurchaseMethod;
  paymentIntent?: PaymentIntentResponse;
  virtualAccountInfo?: VirtualAccountInfo | null;
}

export const startSheetPurchase = async ({
  userId,
  items,
  amount,
  paymentMethod,
  description,
  buyerName,
  buyerEmail,
  buyerTel,
  depositorName,
  returnUrl,
}: StartSheetPurchaseParams): Promise<StartSheetPurchaseResult> => {
  const trimmedDepositorName = depositorName?.trim();

  const { orderId, orderNumber } = await createOrderWithItems({
    userId,
    amount,
    paymentMethod,
    description,
    items,
    paymentStatus: paymentMethod === 'bank_transfer' ? 'awaiting_deposit' : 'pending',
    metadata: {
      type: 'sheet_purchase',
      sheetIds: items.map((item) => item.sheetId),
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
      depositor: '강만수',
      expectedDepositor: trimmedDepositorName ?? undefined,
      amount,
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

  const intent = await createInicisPaymentIntent({
    userId,
    amount,
    description,
    method: 'card',
    orderId,
    bonusAmount: 0,
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


