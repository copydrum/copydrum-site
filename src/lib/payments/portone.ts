import { DEFAULT_USD_RATE } from '../priceFormatter';

// 포트원 스크립트 URL (최신 버전 사용)
const PORTONE_SCRIPT_URL = 'https://cdn.iamport.kr/js/iamport.payment-1.2.0.js';

// 포트원 가맹점 코드를 가져오는 헬퍼 함수 (검사 없이 반환)
const getPortOneMerchantCode = (): string | undefined => {
  return import.meta.env.VITE_PORTONE_MERCHANT_CODE;
};

// 포트원 PayPal 채널 이름
const PORTONE_PAYPAL_CHANNEL = 'copydrum_paypal';

// 포트원 타입 정의
declare global {
  interface Window {
    IMP?: {
      init: (merchantCode: string) => void;
      request_pay: (
        params: PortOnePaymentParams,
        callback: (response: PortOnePaymentResponse) => void,
      ) => void;
    };
  }
}

export interface PortOnePaymentParams {
  pg: string; // 'copydrum_paypal' 또는 다른 PG사 코드
  pay_method: 'paypal' | 'card' | 'trans' | 'vbank' | 'phone' | 'samsung' | 'payco' | 'kakaopay' | 'lpay' | 'ssgpay' | 'tosspay' | 'cultureland' | 'smartculture' | 'happymoney' | 'booknlife';
  merchant_uid: string; // 주문 ID
  name: string; // 상품명
  amount: number; // 결제 금액 (USD 또는 KRW 기준)
  currency?: string; // 'USD' 또는 'KRW'
  buyer_email?: string;
  buyer_name?: string;
  buyer_tel?: string;
  m_redirect_url?: string; // 결제 완료 후 리다이렉트 URL
}

export interface PortOnePaymentResponse {
  success: boolean;
  imp_uid?: string; // 포트원 거래 고유번호
  merchant_uid?: string; // 주문 ID
  error_code?: string;
  error_msg?: string;
  paid_amount?: number; // 실제 결제된 금액
  status?: string; // 'paid', 'failed', 'cancelled' 등
  [key: string]: unknown;
}

// KRW를 USD로 변환 (PayPal은 USD 사용)
export const convertKRWToUSD = (amountKRW: number): number => {
  const usdAmount = amountKRW * DEFAULT_USD_RATE;
  // 소수점 2자리로 반올림 (센트 단위)
  return Math.round(usdAmount * 100) / 100;
};

// 포트원 스크립트 로드
let portoneScriptPromise: Promise<void> | null = null;

export const ensurePortOneLoaded = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    throw new Error('포트원은 브라우저 환경에서만 사용할 수 있습니다.');
  }

  // 이미 로드되어 있으면 반환
  if (window.IMP) {
    return;
  }

  // 이미 로딩 중이면 기다림
  if (portoneScriptPromise) {
    return portoneScriptPromise;
  }

  // 스크립트 로드
  portoneScriptPromise = new Promise<void>((resolve, reject) => {
    // 이미 스크립트가 있으면 확인
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PORTONE_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('포트원 스크립트 로드 실패')), {
        once: true,
      });
      return;
    }

    // 새 스크립트 생성
    const script = document.createElement('script');
    script.src = PORTONE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      console.log('[portone] 스크립트 로드 완료');
      resolve();
    };
    script.onerror = () => {
      console.error('[portone] 스크립트 로드 실패');
      reject(new Error('포트원 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });

  return portoneScriptPromise;
};

// 포트원 초기화 (merchant code 검사 없이 초기화만 수행)
export const initPortOne = async (merchantCode?: string): Promise<void> => {
  await ensurePortOneLoaded();

  if (!window.IMP) {
    throw new Error('포트원 스크립트가 로드되지 않았습니다.');
  }

  // merchant code가 제공되지 않으면 환경 변수에서 가져오기 (검사 없이)
  const code = merchantCode || getPortOneMerchantCode();
  
  if (code) {
    window.IMP.init(code);
    console.log('[portone] 초기화 완료', { merchantCode: code });
  } else {
    console.warn('[portone] merchant code가 없어 초기화를 건너뜁니다.');
  }
};

// PayPal 결제 요청
export interface RequestPayPalPaymentParams {
  amount: number; // KRW 금액
  orderId: string; // 주문 ID (merchant_uid로 사용)
  buyerEmail?: string;
  buyerName?: string;
  buyerTel?: string;
  description: string; // 상품명
  returnUrl?: string; // 결제 완료 후 리다이렉트 URL
}

export interface RequestPayPalPaymentResult {
  success: boolean;
  imp_uid?: string;
  merchant_uid?: string;
  paid_amount?: number;
  error_code?: string;
  error_msg?: string;
}

// PayPal 결제 요청 함수
export const requestPayPalPayment = async (
  params: RequestPayPalPaymentParams,
): Promise<RequestPayPalPaymentResult> => {
  // 포트원 스크립트만 로드 (merchant code 검사 없이)
  await ensurePortOneLoaded();

  if (!window.IMP) {
    throw new Error('포트원 스크립트가 로드되지 않았습니다.');
  }

  // PayPal 결제는 merchant code 없이도 동작할 수 있도록
  // 환경 변수에서 merchant code를 가져오되, 없어도 계속 진행
  const merchantCode = getPortOneMerchantCode();
  if (merchantCode) {
    window.IMP.init(merchantCode);
    console.log('[portone] PayPal 결제를 위한 초기화 완료', { merchantCode });
  } else {
    console.warn('[portone] PayPal 결제: merchant code가 없지만 계속 진행합니다.');
  }

  // KRW를 USD로 변환
  const usdAmount = convertKRWToUSD(params.amount);

  // 결제 완료 후 리다이렉트 URL 생성
  const returnUrl =
    params.returnUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/payments/portone-paypal/return`
      : '');

  // 포트원 결제 파라미터 구성
  const paymentParams: PortOnePaymentParams = {
    pg: PORTONE_PAYPAL_CHANNEL,
    pay_method: 'paypal',
    merchant_uid: params.orderId,
    name: params.description,
    amount: usdAmount,
    currency: 'USD',
    buyer_email: params.buyerEmail,
    buyer_name: params.buyerName,
    buyer_tel: params.buyerTel,
    m_redirect_url: returnUrl,
  };

  console.log('[portone] PayPal 결제 요청', {
    params: paymentParams,
    originalAmountKRW: params.amount,
    convertedAmountUSD: usdAmount,
  });

  // Promise로 래핑하여 결제 결과 반환
  return new Promise<RequestPayPalPaymentResult>((resolve, reject) => {
    try {
      window.IMP!.request_pay(paymentParams, async (response: PortOnePaymentResponse) => {
        console.log('[portone] PayPal 결제 응답', response);

        if (response.success) {
          // 결제 성공
          // 주문 상태 업데이트는 리다이렉트 페이지에서 처리하거나
          // 여기서 비동기로 처리할 수 있음
          // 현재는 리다이렉트 페이지에서 처리하도록 함
          console.log('[portone] PayPal 결제 성공', {
            imp_uid: response.imp_uid,
            merchant_uid: response.merchant_uid,
            paid_amount: response.paid_amount,
          });

          // 리다이렉트는 포트원이 자동으로 처리하므로
          // 여기서는 성공 결과만 반환
          resolve({
            success: true,
            imp_uid: response.imp_uid,
            merchant_uid: response.merchant_uid,
            paid_amount: response.paid_amount,
          });
        } else {
          // 결제 실패
          console.error('[portone] PayPal 결제 실패', {
            error_code: response.error_code,
            error_msg: response.error_msg,
            fullResponse: response,
          });

          resolve({
            success: false,
            error_code: response.error_code,
            error_msg: response.error_msg,
          });
        }
      });
    } catch (error) {
      console.error('[portone] 결제 요청 중 예외', error);
      reject(
        error instanceof Error
          ? error
          : new Error('결제 요청 중 예상치 못한 오류가 발생했습니다.'),
      );
    }
  });
};

// PortOne 카드 결제용 인터페이스
export interface PortOnePaymentArgs {
  amount: number; // KRW 금액
  orderId: string; // 주문 ID (merchant_uid로 사용)
  description: string; // 상품명
  buyerEmail?: string;
  buyerName?: string;
  buyerTel?: string;
  returnUrl?: string; // 결제 완료 후 리다이렉트 URL
  pg?: string; // PG사 코드 (예: 'html5_inicis', 'kcp' 등)
  payMethod?: 'card' | 'trans' | 'vbank' | 'phone' | 'samsung' | 'payco' | 'kakaopay' | 'lpay' | 'ssgpay' | 'tosspay' | 'cultureland' | 'smartculture' | 'happymoney' | 'booknlife';
}

export interface PortOnePaymentResult {
  success: boolean;
  imp_uid?: string;
  merchant_uid?: string;
  paid_amount?: number;
  error_code?: string;
  error_msg?: string;
}

// PortOne 카드 결제 요청 함수 (환경 변수 검사 포함)
export async function requestPortonePayment(args: PortOnePaymentArgs): Promise<PortOnePaymentResult> {
  // 환경 변수 검사 (실제 PortOne 결제 실행 시점에만 검사)
  const merchantCode = import.meta.env.VITE_PORTONE_MERCHANT_CODE;

  if (!merchantCode) {
    console.error('[portone] VITE_PORTONE_MERCHANT_CODE is not set');
    throw new Error('포트원 가맹점 코드가 설정되지 않았습니다. VITE_PORTONE_MERCHANT_CODE 환경 변수를 확인하세요.');
  }

  // 포트원 초기화
  await initPortOne(merchantCode);

  if (!window.IMP) {
    throw new Error('포트원이 초기화되지 않았습니다.');
  }

  // 결제 완료 후 리다이렉트 URL 생성
  const returnUrl =
    args.returnUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/payments/portone/return`
      : '');

  // 포트원 결제 파라미터 구성
  const paymentParams: PortOnePaymentParams = {
    pg: args.pg || 'html5_inicis', // 기본값 설정
    pay_method: args.payMethod || 'card',
    merchant_uid: args.orderId,
    name: args.description,
    amount: args.amount,
    currency: 'KRW',
    buyer_email: args.buyerEmail,
    buyer_name: args.buyerName,
    buyer_tel: args.buyerTel,
    m_redirect_url: returnUrl,
  };

  console.log('[portone] 카드 결제 요청', {
    params: paymentParams,
    merchantCode,
  });

  // Promise로 래핑하여 결제 결과 반환
  return new Promise<PortOnePaymentResult>((resolve, reject) => {
    try {
      window.IMP!.request_pay(paymentParams, async (response: PortOnePaymentResponse) => {
        console.log('[portone] 카드 결제 응답', response);

        if (response.success) {
          // 결제 성공
          console.log('[portone] 카드 결제 성공', {
            imp_uid: response.imp_uid,
            merchant_uid: response.merchant_uid,
            paid_amount: response.paid_amount,
          });

          resolve({
            success: true,
            imp_uid: response.imp_uid,
            merchant_uid: response.merchant_uid,
            paid_amount: response.paid_amount,
          });
        } else {
          // 결제 실패
          console.error('[portone] 카드 결제 실패', {
            error_code: response.error_code,
            error_msg: response.error_msg,
            fullResponse: response,
          });

          resolve({
            success: false,
            error_code: response.error_code,
            error_msg: response.error_msg,
          });
        }
      });
    } catch (error) {
      console.error('[portone] 결제 요청 중 예외', error);
      reject(
        error instanceof Error
          ? error
          : new Error('결제 요청 중 예상치 못한 오류가 발생했습니다.'),
      );
    }
  });
}

// 포트원 returnUrl 생성 헬퍼
export const getPortOneReturnUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const origin = window.location.origin;
  const returnPath = '/payments/portone-paypal/return';

  let baseUrl = origin;
  if (!baseUrl.startsWith('https://')) {
    baseUrl = baseUrl.replace(/^https?:\/\//, 'https://');
  }

  return `${baseUrl}${returnPath}`;
};

