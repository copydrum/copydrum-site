import { getSiteCurrency, convertFromKrw } from '../../lib/currency';
import * as PortOne from '@portone/browser-sdk/v2';
import { isGlobalSiteHost, isJapaneseSiteHost, isEnglishSiteHost } from '../../config/hostType';
import { getActiveCurrency } from './getActiveCurrency';
import { DEFAULT_USD_RATE } from '../priceFormatter';
import { getLocaleFromHost } from '../../i18n/getLocaleFromHost';

// PortOne currency type
type PortOneCurrency = 'CURRENCY_KRW' | 'CURRENCY_USD' | 'CURRENCY_JPY';

// Convert our currency format to PortOne format
function toPortOneCurrency(currency: 'KRW' | 'USD' | 'JPY'): PortOneCurrency {
  switch (currency) {
    case 'USD':
      return 'CURRENCY_USD';
    case 'JPY':
      return 'CURRENCY_JPY';
    default:
      return 'CURRENCY_KRW';
  }
}

// 포트원 스크립트 URL (최신 버전 사용)
const PORTONE_SCRIPT_URL = 'https://cdn.iamport.kr/js/iamport.payment-1.2.0.js';

// 포트원 가맹점 코드를 가져오는 헬퍼 함수 (검사 없이 반환)
const getPortOneMerchantCode = (): string | undefined => {
  return import.meta.env.VITE_PORTONE_MERCHANT_CODE;
};

// 포트원 PayPal 채널 이름 (현재 PayPal은 PortOne을 사용하지 않음)
// const PORTONE_PAYPAL_CHANNEL = 'copydrum_paypal';

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

interface PortOnePaymentParams {
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

interface PortOnePaymentResponse {
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

// 포트원 returnUrl 생성 헬퍼
export const getPortOneReturnUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const origin = window.location.origin;
  const returnPath = '/payments/portone-paypal/return';

  let baseUrl = origin;
  if (!baseUrl.startsWith('https://') && !baseUrl.includes('localhost')) {
    baseUrl = baseUrl.replace(/^https?:\/\//, 'https://');
  }

  return `${baseUrl}${returnPath}`;
};

// PayPal 결제 요청
export interface RequestPayPalPaymentParams {
  userId: string; // 사용자 ID (필수)
  amount: number; // KRW 금액
  orderId: string; // 주문 ID (merchant_uid로 사용)
  buyerEmail?: string;
  buyerName?: string;
  buyerTel?: string;
  description: string; // 상품명
  returnUrl?: string; // 결제 완료 후 리다이렉트 URL
  elementId?: string; // PayPal SPB 렌더링을 위한 컨테이너 ID
  onSuccess?: (response: any) => void; // SPB 결제 성공 콜백
  onError?: (error: any) => void; // SPB 결제 실패 콜백
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
  // 글로벌 사이트에서만 포트원 V2 SDK 사용
  const isGlobalSite = typeof window !== 'undefined' && isGlobalSiteHost(window.location.host);

  if (!isGlobalSite) {
    // 한국어 사이트는 기존 로직 유지 (PayPal 직접 API 사용)
    const { createPayPalPaymentIntent, getPayPalReturnUrl } = await import('./paypal');

    console.log('[paypal] PayPal 결제 요청 (PortOne 미사용 - 한국어 사이트)', {
      orderId: params.orderId,
      amount: params.amount,
    });

    try {
      // PayPal 결제 Intent 생성 (Edge Function 호출)
      const intent = await createPayPalPaymentIntent({
        userId: params.userId,
        orderId: params.orderId,
        amount: params.amount,
        description: params.description,
        buyerEmail: params.buyerEmail,
        buyerName: params.buyerName,
        returnUrl: params.returnUrl || getPayPalReturnUrl(),
      });

      // sessionStorage에 주문 정보 저장 (리다이렉트 페이지에서 사용)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('paypal_order_id', params.orderId);
        sessionStorage.setItem('paypal_paypal_order_id', intent.paypalOrderId);
      }

      // PayPal 승인 URL로 리다이렉트
      if (intent.approvalUrl) {
        window.location.href = intent.approvalUrl;
      } else {
        throw new Error('PayPal 승인 URL을 받지 못했습니다.');
      }

      // 리다이렉트되므로 여기서는 성공으로 반환
      // 실제 결제 완료는 리다이렉트 페이지에서 처리
      return {
        success: true,
        merchant_uid: params.orderId,
      };
    } catch (error) {
      console.error('[paypal] PayPal 결제 요청 오류', error);
      return {
        success: false,
        error_msg: error instanceof Error ? error.message : 'PayPal 결제 요청 중 오류가 발생했습니다.',
      };
    }
  }

  // 글로벌 사이트: 포트원 V2 SDK 사용
  console.log('[portone-paypal] PayPal 결제 요청 (PortOne V2 SDK 사용)', {
    orderId: params.orderId,
    amount: params.amount,
  });

  const storeId = import.meta.env.VITE_PORTONE_STORE_ID || 'store-21731740-b1df-492c-832a-8f38448d0ebd';
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY_PAYPAL || 'channel-key-541220df-bf9f-4cb1-b189-679210076fe0';

  if (!storeId || !channelKey) {
    console.error('[portone-paypal] 환경변수 설정 오류', { storeId, channelKey });
    return {
      success: false,
      error_msg: 'PayPal 결제 설정이 올바르지 않습니다.',
    };
  }

  try {
    // 리턴 URL 설정
    const returnUrl = params.returnUrl || getPortOneReturnUrl();

    // Always use the fixed container - PortOne SDK will find .portone-ui-container automatically
    // But we can also specify it explicitly via element parameter

    // PayPal 통화 결정 로직
    // 1. 일본어 사이트: JPY
    // 2. 영어 사이트: USD
    // 3. 나머지 14개 언어: USD (UI는 각 언어 통화, PayPal은 USD)
    // 4. 한국어 사이트: 이미 isGlobalSite 체크로 차단됨
    const hostname = window.location.hostname;
    const locale = getLocaleFromHost(window.location.host);
    
    // PayPal 통화 결정
    let paypalCurrency: 'USD' | 'JPY' = 'USD';
    if (locale === 'ja' || isJapaneseSiteHost(hostname)) {
      paypalCurrency = 'JPY';
    } else if (locale === 'en' || isEnglishSiteHost(hostname)) {
      paypalCurrency = 'USD';
    } else {
      // 나머지 14개 언어는 모두 USD
      paypalCurrency = 'USD';
    }

    // KRW 금액을 PayPal 통화로 변환
    const convertedAmount = convertFromKrw(params.amount, paypalCurrency);
    const portOneCurrency = toPortOneCurrency(paypalCurrency);

    // Request data와 콜백을 분리하여 전달
    // PortOne SDK는 자동으로 .portone-ui-container를 찾지만, 명시적으로 지정할 수도 있음
    const requestData: any = {
      uiType: 'PAYPAL_SPB' as const,
      storeId,
      channelKey,
      paymentId: params.orderId,
      orderName: params.description,
      totalAmount: Math.round(convertedAmount),
      currency: portOneCurrency,
      customer: {
        customerId: params.userId ?? undefined,
        email: params.buyerEmail ?? undefined,
        fullName: params.buyerName ?? undefined,
        phoneNumber: params.buyerTel ?? undefined,
      },
      redirectUrl: returnUrl,
    };

    // element 파라미터는 선택사항이지만, 명시적으로 지정하면 더 안전함
    if (params.elementId) {
      requestData.element = params.elementId.startsWith('#') ? params.elementId : `#${params.elementId}`;
    } else {
      requestData.element = '#portone-ui-container';
    }

    console.log('[portone-paypal] loadPaymentUI requestData', {
      ...requestData,
      originalAmount: params.amount,
      convertedAmount,
    });

    // 포트원 V2 SDK로 PayPal 결제 UI 로드
    // loadPaymentUI(requestData, { callbacks }) 형태로 호출
    await PortOne.loadPaymentUI(requestData, {
      onPaymentSuccess: async (paymentResult: any) => {
        console.log('[portone-paypal] onPaymentSuccess', paymentResult);
        if (params.onSuccess) {
          params.onSuccess(paymentResult);
        }
      },
      onPaymentFail: (error: any) => {
        console.error('[portone-paypal] onPaymentFail', error);
        if (params.onError) {
          params.onError(error);
        }
      },
    });

    return {
      success: true,
      merchant_uid: params.orderId,
      error_msg: params.elementId
        ? 'PayPal 버튼이 로드되었습니다.'
        : 'PayPal 버튼이 로드되었습니다. (주의: 컨테이너 요소가 없어 화면에 안 보일 수 있음)',
    };
  } catch (error) {
    console.error('[portone-paypal] PayPal 결제 요청 오류', error);
    return {
      success: false,
      error_msg: error instanceof Error ? error.message : 'PayPal 결제 요청 중 오류가 발생했습니다.',
    };
  }
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
