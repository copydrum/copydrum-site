import { supabase } from '../supabase';
import type {
  CardPaymentIntentRequest,
  PaymentApprovalPayload,
  PaymentCancelPayload,
  PaymentIntentResponse,
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

const INIT_FUNCTION = 'payments-inicis-init';
const APPROVE_FUNCTION = 'payments-inicis-approve';
const CANCEL_FUNCTION = 'payments-inicis-cancel';
const INICIS_SCRIPT_URL = 'https://stdpay.inicis.com/stdjs/INIStdPay.js';

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
      (typeof data.error === 'string' ? data.error : '결제 처리 중 오류가 발생했습니다.');
    throw new Error(message);
  }

  return data.data as T;
};

export const createInicisPaymentIntent = async (
  payload: CardPaymentIntentRequest,
): Promise<PaymentIntentResponse> => {
  return invokeEdgeFunction<PaymentIntentResponse>(INIT_FUNCTION, payload);
};

export const approveInicisPayment = async (payload: PaymentApprovalPayload) => {
  return invokeEdgeFunction<{ success: true }>(APPROVE_FUNCTION, payload);
};

export const cancelInicisPayment = async (payload: PaymentCancelPayload) => {
  return invokeEdgeFunction<{ success: true }>(CANCEL_FUNCTION, payload);
};

declare global {
  interface Window {
    INIStdPay?: unknown;
  }
}

let inicisScriptPromise: Promise<void> | null = null;

export const ensureInicisSdkLoaded = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.INIStdPay) {
    return;
  }

  if (inicisScriptPromise) {
    return inicisScriptPromise;
  }

  inicisScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${INICIS_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('KG이니시스 스크립트 로드 실패')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = INICIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('KG이니시스 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });

  return inicisScriptPromise;
};

export const submitInicisPaymentForm = (formConfig: PaymentIntentResponse['requestForm']) => {
  if (!formConfig) {
    throw new Error('KG이니시스 결제 요청 정보가 없습니다.');
  }

  const form = document.createElement('form');
  form.method = formConfig.method ?? 'POST';
  form.action = formConfig.action;
  form.style.display = 'none';
  form.id = `iniStdPayForm-${Date.now()}`;

  Object.entries(formConfig.inputs ?? {}).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);

  const inicis = window.INIStdPay as { pay?: (formId: string) => void } | undefined;
  if (inicis && typeof inicis.pay === 'function') {
    inicis.pay(form.id);
  } else {
    form.submit();
  }

  document.body.removeChild(form);
};

