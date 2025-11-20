import { createOrderWithItems } from './orderUtils';
// KG이니시스 관련 import 주석 처리 (포트원으로 전환)
// import {
//   createInicisPaymentIntent,
//   ensureInicisSdkLoaded,
//   submitInicisPaymentForm,
//   getInicisReturnUrl,
// } from './inicis';
// 직접 PayPal 연동 관련 import 주석 처리 (포트원으로 전환)
// import {
//   createPayPalPaymentIntent,
//   getPayPalReturnUrl,
//   getPayPalCancelUrl,
// } from './paypal';
import { requestPayPalPayment } from './portone';
import { updateOrderPaymentStatus } from './paymentService';
import type { VirtualAccountInfo, PaymentIntentResponse } from './types';

type PurchaseMethod = 'card' | 'bank_transfer' | 'paypal';

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
    orderType: 'product', // 주문 타입 추가
  });

  if (paymentMethod === 'bank_transfer') {
    // 페이액션 연동 제거, 간단한 무통장 입금 처리
    // depositor_name 추가 - 입금자명 저장
    // depositorName이 전달되었고 빈 문자열이 아닐 때 저장
    if (depositorName !== undefined && depositorName !== null && trimmedDepositorName) {
      console.log('[startSheetPurchase] 입금자명 저장:', { depositorName, trimmedDepositorName, orderId });
      await updateOrderPaymentStatus(orderId, 'awaiting_deposit', {
        depositorName: trimmedDepositorName,
      });
    } else {
      console.warn('[startSheetPurchase] 입금자명이 저장되지 않음:', { depositorName, trimmedDepositorName, orderId });
    }

    // 고정 계좌 정보 반환
    const bankInfo: VirtualAccountInfo = {
      bankName: '카카오뱅크',
      accountNumber: '3333-15-0302437',
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

  if (paymentMethod === 'paypal') {
    // 직접 PayPal API를 통한 결제 처리 (PortOne 미사용)
    try {
      const result = await requestPayPalPayment({
        userId,
        amount,
        orderId,
        buyerEmail: buyerEmail ?? undefined,
        buyerName: buyerName ?? undefined,
        buyerTel: buyerTel ?? undefined,
        description,
        returnUrl: returnUrl, // returnUrl이 없으면 requestPayPalPayment 내부에서 자동 생성
      });

      if (result.success) {
        // PayPal 승인 URL로 리다이렉트됨
        // 실제 결제 완료는 리다이렉트 페이지(/payments/paypal/return)에서 처리
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
      console.error('[productPurchase] PayPal 결제 오류', error);
      throw error;
    }
  }

  // 카드 결제는 현재 비활성화 (포트원으로 전환 예정)
  // TODO: 포트원을 통한 카드 결제 연동 필요
  throw new Error('카드 결제는 현재 사용할 수 없습니다. PayPal을 사용해주세요.');

  // 기존 KG이니시스 코드 (주석 처리)
  // const finalReturnUrl = returnUrl || getInicisReturnUrl();
  // const intent = await createInicisPaymentIntent({
  //   userId,
  //   amount,
  //   description,
  //   method: 'card',
  //   orderId,
  //   bonusAmount: 0,
  //   returnUrl: finalReturnUrl,
  //   buyerName: buyerName ?? undefined,
  //   buyerEmail: buyerEmail ?? undefined,
  //   buyerTel: buyerTel ?? undefined,
  // });
  // if (intent.requestForm) {
  //   if (typeof window !== 'undefined') {
  //     sessionStorage.setItem('inicis_order_id', orderId);
  //   }
  //   await ensureInicisSdkLoaded();
  //   submitInicisPaymentForm(intent.requestForm);
  // }
  // return {
  //   orderId,
  //   orderNumber,
  //   amount,
  //   paymentMethod,
  //   paymentIntent: intent,
  // };
};


