import { createOrderWithItems } from './orderUtils';
import {
  createInicisPaymentIntent,
  ensureInicisSdkLoaded,
  submitInicisPaymentForm,
  getInicisReturnUrl,
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

  // returnUrl이 지정되지 않으면 클라이언트 페이지 URL 사용 (GET 파라미터 방식)
  // KG이니시스 관리자 콘솔에서 GET 전달 방식 활성화 필요
  const finalReturnUrl = returnUrl || getInicisReturnUrl();

  const intent = await createInicisPaymentIntent({
    userId,
    amount,
    description,
    method: 'card',
    orderId,
    bonusAmount: 0,
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


