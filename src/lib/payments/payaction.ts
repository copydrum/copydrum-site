import { supabase } from '../supabase';
import type {
  PaymentCancelPayload,
  PaymentIntentResponse,
  VirtualAccountIntentRequest,
  VirtualAccountInfo,
} from './types';

interface EdgeResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

interface PayactionInitResponse extends PaymentIntentResponse {
  virtualAccountInfo: VirtualAccountInfo | null;
}

const INIT_FUNCTION = 'payments-payaction-init';
const CANCEL_FUNCTION = 'payments-payaction-cancel';

const invokeEdgeFunction = async <T>(functionName: string, payload: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<EdgeResponse<T>>(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`[payments] ${functionName} invoke error`, error);
    throw new Error(error.message ?? `Edge Function ${functionName} 호출 중 오류가 발생했습니다.`);
  }

  if (!data) {
    throw new Error(`Edge Function ${functionName}에서 응답을 받지 못했습니다.`);
  }

  if (!data.success) {
    const message =
      data.error?.message ??
      (typeof data.error === 'string' ? data.error : '무통장입금 처리 중 오류가 발생했습니다.');
    throw new Error(message);
  }

  return data.data as T;
};

export const createPayactionVirtualAccount = async (
  payload: VirtualAccountIntentRequest,
): Promise<PayactionInitResponse> => {
  return invokeEdgeFunction<PayactionInitResponse>(INIT_FUNCTION, payload);
};

export const cancelPayactionVirtualAccount = async (payload: PaymentCancelPayload) => {
  return invokeEdgeFunction<{ success: true }>(CANCEL_FUNCTION, payload);
};





