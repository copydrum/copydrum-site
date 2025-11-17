import { supabase } from '../supabase';
import { formatPrice, DEFAULT_USD_RATE } from '../priceFormatter';
import type { PaymentIntentResponse } from './types';

interface EdgeResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

const PAYPAL_INIT_FUNCTION = 'payments-paypal-init';
const PAYPAL_APPROVE_FUNCTION = 'payments-paypal-approve';

interface PayPalPaymentIntentRequest {
  userId: string;
  orderId: string;
  amount: number; // KRW amount
  description: string;
  buyerEmail?: string;
  buyerName?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

interface PayPalPaymentIntentResponse {
  orderId: string;
  paypalOrderId: string;
  approvalUrl?: string;
  clientId?: string;
}

interface PayPalApprovalPayload {
  orderId: string;
  paypalOrderId: string;
  payerId?: string;
}

const invokeEdgeFunction = async <T>(functionName: string, payload: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<EdgeResponse<T>>(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`[paypal] ${functionName} invoke error`, error);
    throw new Error(error.message ?? `PayPal Edge Function ${functionName} 호출 중 오류가 발생했습니다.`);
  }

  if (!data) {
    throw new Error(`PayPal Edge Function ${functionName}에서 응답을 받지 못했습니다.`);
  }

  if (!data.success) {
    const message =
      data.error?.message ??
      (typeof data.error === 'string' ? data.error : 'PayPal 결제 처리 중 오류가 발생했습니다.');
    throw new Error(message);
  }

  return data.data as T;
};

// KRW를 USD로 변환
export const convertKRWToUSD = (amountKRW: number): number => {
  const usdAmount = amountKRW * DEFAULT_USD_RATE;
  return Math.round(usdAmount * 100) / 100; // round to cents
};

// PayPal 결제 Intent 생성
export const createPayPalPaymentIntent = async (
  payload: PayPalPaymentIntentRequest,
): Promise<PayPalPaymentIntentResponse> => {
  // KRW를 USD로 변환
  const usdAmount = convertKRWToUSD(payload.amount);
  
  const paypalPayload = {
    ...payload,
    amountUSD: usdAmount,
    amountKRW: payload.amount,
  };

  return invokeEdgeFunction<PayPalPaymentIntentResponse>(PAYPAL_INIT_FUNCTION, paypalPayload);
};

// PayPal 결제 승인
export const approvePayPalPayment = async (payload: PayPalApprovalPayload) => {
  const result = await invokeEdgeFunction<{ success: true; orderId: string; transactionId?: string; amount?: number }>(PAYPAL_APPROVE_FUNCTION, payload);
  return {
    success: true,
    orderId: result.orderId,
    transactionId: result.transactionId,
    amount: result.amount,
  };
};

// PayPal returnUrl 생성
export const getPayPalReturnUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  
  const origin = window.location.origin;
  const returnPath = '/payments/paypal/return';
  
  let baseUrl = origin;
  if (!baseUrl.startsWith('https://')) {
    baseUrl = baseUrl.replace(/^https?:\/\//, 'https://');
  }
  
  return `${baseUrl}${returnPath}`;
};

// PayPal cancelUrl 생성
export const getPayPalCancelUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  
  const origin = window.location.origin;
  const cancelPath = '/payments/paypal/cancel';
  
  let baseUrl = origin;
  if (!baseUrl.startsWith('https://')) {
    baseUrl = baseUrl.replace(/^https?:\/\//, 'https://');
  }
  
  return `${baseUrl}${cancelPath}`;
};

