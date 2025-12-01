import { getSiteCurrency, convertFromKrw } from '../../lib/currency';
import * as PortOne from '@portone/browser-sdk/v2';
import { isGlobalSiteHost, isJapaneseSiteHost, isEnglishSiteHost, isKoreanSiteHost } from '../../config/hostType';
import { getActiveCurrency } from './getActiveCurrency';
import { DEFAULT_USD_RATE } from '../priceFormatter';
import { getLocaleFromHost } from '../../i18n/getLocaleFromHost';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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
  paymentId?: string; // PortOne paymentId (transaction_id로 사용)
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

  // ============================================================
  // 🟢 [수정됨] 글로벌 사이트: 포트원 V2 SDK 사용 로직 강화
  // ============================================================
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
    const returnUrl = params.returnUrl || getPortOneReturnUrl();
    const hostname = window.location.hostname;
    const locale = getLocaleFromHost(window.location.host);

    // PayPal 통화 결정
    const isJapanSite = locale === 'ja' || isJapaneseSiteHost(hostname);
    const paypalCurrency: 'USD' | 'JPY' = isJapanSite ? 'JPY' : 'USD';

    // 금액 변환
    const convertedAmount = convertFromKrw(params.amount, paypalCurrency);
    const portOneCurrency = toPortOneCurrency(paypalCurrency);

    let finalAmount: number;
    if (paypalCurrency === 'USD') {
      finalAmount = Math.round(Number(convertedAmount.toFixed(2)) * 100); // 센트 단위
    } else {
      finalAmount = Math.round(convertedAmount); // 엔 단위
    }

    // 🟢 [핵심 수정 1] Payment ID를 미리 생성 (카카오페이처럼)
    // 기존에는 orderId를 paymentId로 썼지만, 'pay_' 접두어가 붙은 고유 ID를 쓰는 것이 안전합니다.
    const newPaymentId = `pay_${uuidv4()}`;

    // 🟢 [핵심 수정 2] 결제창 띄우기 전에 DB에 transaction_id 미리 저장!
    // 이렇게 해야 결제 도중 창이 닫혀도 Webhook이 와서 처리해줄 수 있습니다.
    console.log('[portone-paypal] 결제 요청 전 transaction_id 저장 시도', {
      orderId: params.orderId,
      paymentId: newPaymentId,
    });

    const { error: updateError } = await supabase
      .from('orders')
      .update({ transaction_id: newPaymentId })
      .eq('id', params.orderId);

    if (updateError) {
      console.error('[portone-paypal] DB 업데이트 실패 (치명적이지 않음, 계속 진행)', updateError);
    } else {
      console.log('[portone-paypal] DB 업데이트 성공');
    }

    // Request Data 구성
    const requestData: any = {
      uiType: 'PAYPAL_SPB',
      storeId,
      channelKey,
      paymentId: newPaymentId, // 🟢 생성한 ID 사용
      orderId: params.orderId,
      orderName: params.description,
      totalAmount: finalAmount,
      currency: portOneCurrency,
      customer: {
        customerId: params.userId ?? undefined,
        email: params.buyerEmail ?? undefined,
        fullName: params.buyerName ?? undefined,
        phoneNumber: params.buyerTel ?? undefined,
      },
      redirectUrl: returnUrl, // 🟢 리다이렉트 URL 필수
      metadata: {
        supabaseOrderId: params.orderId,
      },
    };

    if (params.elementId) {
      requestData.element = params.elementId.startsWith('#') ? params.elementId : `#${params.elementId}`;
    } else {
      requestData.element = '#portone-ui-container';
    }

    console.log('[portone-paypal] loadPaymentUI 호출', requestData);

    // 포트원 V2 SDK로 PayPal 결제 UI 로드
    await PortOne.loadPaymentUI(requestData, {
      onPaymentSuccess: async (paymentResult: any) => {
        console.log('[portone-paypal] onPaymentSuccess 콜백 실행', paymentResult);
        
        // 프론트엔드 콜백 호출
        if (params.onSuccess) {
          params.onSuccess(paymentResult);
        }

        // 명시적 리다이렉트 (안전장치)
        // 모바일이나 일부 환경에서는 자동 리다이렉트가 안 될 수 있으므로 강제 이동
        if (returnUrl) {
           console.log('[portone-paypal] 리다이렉트 실행');
           window.location.href = returnUrl;
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
      paymentId: newPaymentId,
      error_msg: 'PayPal 버튼이 로드되었습니다.',
    };
  } catch (error) {
    console.error('[portone-paypal] PayPal 결제 요청 오류', error);
    return {
      success: false,
      error_msg: error instanceof Error ? error.message : 'PayPal 결제 요청 중 오류가 발생했습니다.',
    };
  }
};

// 카카오페이 결제 요청
export interface RequestKakaoPayPaymentParams {
  userId: string; // 사용자 ID (필수)
  amount: number; // KRW 금액 (이미 KRW 정수 금액, 변환 불필요)
  orderId: string; // 주문 ID (merchant_uid로 사용)
  orderNumber?: string | null; // 주문번호 (metadata에 추가)
  buyerEmail?: string;
  buyerName?: string;
  buyerTel?: string;
  description: string; // 상품명
  returnUrl?: string; // 결제 완료 후 리다이렉트 URL
  onSuccess?: (response: any) => void; // 결제 성공 콜백
  onError?: (error: any) => void; // 결제 실패 콜백
}

export interface RequestKakaoPayPaymentResult {
  success: boolean;
  imp_uid?: string;
  merchant_uid?: string;
  paid_amount?: number;
  error_code?: string;
  error_msg?: string;
  paymentId?: string; // PortOne paymentId (transaction_id로 사용)
}

// 카카오페이 결제 요청 함수
export const requestKakaoPayPayment = async (
  params: RequestKakaoPayPaymentParams,
): Promise<RequestKakaoPayPaymentResult> => {
  // 한국어 사이트에서만 동작
  if (typeof window === 'undefined') {
    return {
      success: false,
      error_msg: 'KakaoPay는 브라우저 환경에서만 사용할 수 있습니다.',
    };
  }

  const hostname = window.location.hostname;
  const isKoreanSite = isKoreanSiteHost(hostname);

  if (!isKoreanSite) {
    console.warn('[portone-kakaopay] 한국어 사이트가 아닙니다.', { hostname });
    return {
      success: false,
      error_msg: 'KakaoPay is only available on the Korean site.',
    };
  }

  console.log('[portone-kakaopay] KakaoPay 결제 요청 시작', {
    orderId: params.orderId,
    amount: params.amount,
    customer: {
      userId: params.userId,
      email: params.buyerEmail,
      name: params.buyerName,
      tel: params.buyerTel,
    },
  });

  const storeId = import.meta.env.VITE_PORTONE_STORE_ID || 'store-21731740-b1df-492c-832a-8f38448d0ebd';
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY_KAKAOPAY || 'channel-key-bdbeb668-e452-413b-a039-150013d1f3ae';

  if (!storeId || !channelKey) {
    console.error('[portone-kakaopay] 환경변수 설정 오류', { storeId, channelKey });
    return {
      success: false,
      error_msg: 'KakaoPay 결제 설정이 올바르지 않습니다.',
    };
  }

  try {
    // 리턴 URL 설정 (기존 PortOne PayPal return URL 재사용)
    const returnUrl = params.returnUrl || getPortOneReturnUrl();

    // 카카오페이 결제 시 paymentId는 항상 새로운 UUID로 생성
    // orderId는 내부 주문 식별용, paymentId는 PG 결제 식별용으로 분리
    // 이렇게 하면 같은 주문으로 재결제 시도 시에도 중복 오류가 발생하지 않음
    const newPaymentId = `pay_${uuidv4()}`;

    // PortOne V2 문서에 따르면 카카오페이는 requestPayment를 사용해야 함
    // loadPaymentUI는 UI 타입이 필요한데, 카카오페이는 일반결제를 지원하지 않음
    // 참고: https://developers.portone.io/opi/ko/integration/pg/v2/kakaopay?v=v2
    const requestData: any = {
      storeId,
      channelKey,
      paymentId: newPaymentId, // 항상 새로운 UUID 사용 (orderId와 분리)
      // ✅ Supabase 주문과 연결하기 위한 orderId 설정 (웹훅에서 주문 찾기용)
      orderId: params.orderId, // Supabase orders.id를 PortOne에 전달
      orderName: params.description,
      totalAmount: params.amount, // KRW 정수 금액 그대로 사용
      currency: 'CURRENCY_KRW' as const, // 카카오페이는 원화 결제만 지원
      payMethod: 'EASY_PAY' as const, // 간편결제 타입 (카카오페이 필수) - 문자열로 전달
      customer: {
        customerId: params.userId ?? undefined,
        email: params.buyerEmail ?? undefined,
        fullName: params.buyerName ?? undefined,
        phoneNumber: params.buyerTel ?? undefined,
      },
      redirectUrl: returnUrl,
      // ✅ 나중에 Webhook / REST 조회에서 다시 확인할 수 있도록 metadata에도 기록
      metadata: {
        supabaseOrderId: params.orderId, // Supabase orders.id
        supabaseOrderNumber: params.orderNumber || null, // Supabase orders.order_number
        // 필요시 추가 메타데이터도 포함 가능
      },
      // 카카오페이 특화 설정
      windowType: {
        pc: 'IFRAME', // PC는 IFRAME만 지원
        mobile: 'REDIRECTION', // 모바일은 REDIRECTION만 지원
      },
      locale: 'KO_KR', // 카카오페이는 KO_KR만 지원
    };

    // 주문에 transaction_id(paymentId) 저장 (결제 요청 전에 미리 저장)
    // orderId는 내부 주문 식별용, transaction_id는 PG 결제 식별용
    // 카카오페이는 결제 완료 후 리다이렉트가 일어날 수 있으므로, 미리 저장하는 것이 중요
    console.log('[portone-kakaopay] 결제 요청 전 transaction_id 저장 시도', {
      orderId: params.orderId,
      paymentId: newPaymentId,
    });
    
    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({ transaction_id: newPaymentId })
      .eq('id', params.orderId)
      .select('id, transaction_id')
      .single();

    if (updateError) {
      console.error('[portone-kakaopay] 주문 transaction_id 업데이트 실패:', {
        orderId: params.orderId,
        paymentId: newPaymentId,
        error: updateError,
      });
      // transaction_id 업데이트 실패해도 결제는 계속 진행 (onPaymentSuccess에서 재시도)
    } else {
      console.log('[portone-kakaopay] 주문 transaction_id 저장 성공 (결제 요청 전)', {
        orderId: params.orderId,
        paymentId: newPaymentId,
        updatedOrder: updateData,
      });
    }

    // 디버그 로그: requestData의 주요 필드 확인
    console.log('[portone-kakaopay] requestPayment requestData', {
      orderId: params.orderId, // 내부 주문 ID
      paymentId: newPaymentId, // PG 결제 식별 ID (transaction_id로 저장됨)
      storeId: requestData.storeId,
      channelKey: requestData.channelKey ? requestData.channelKey.substring(0, 20) + '...' : undefined,
      orderName: requestData.orderName,
      totalAmount: requestData.totalAmount,
      currency: requestData.currency,
      payMethod: requestData.payMethod, // 'EASY_PAY' (문자열) 확인
      windowType: requestData.windowType, // { pc: 'IFRAME', mobile: 'REDIRECTION' } 확인
      locale: requestData.locale, // 'KO_KR' 확인
      redirectUrl: requestData.redirectUrl,
    });

    // 포트원 V2 SDK로 카카오페이 결제 요청 (requestPayment 사용)
    await PortOne.requestPayment(requestData, {
      onPaymentSuccess: async (paymentResult: any) => {
        console.log('[portone-kakaopay] onPaymentSuccess 전체 응답', JSON.stringify(paymentResult, null, 2));

        // 결제 성공 시 orders.transaction_id 업데이트 (확실히 보장)
        // PortOne paymentId를 orders.transaction_id에 저장하여 웹훅에서 주문을 찾을 수 있도록 함
        // paymentResult에서 paymentId 또는 txId 추출
        // PortOne V2 SDK 응답 구조에 따라 다양한 필드명을 시도
        const portonePaymentId = paymentResult.paymentId || 
                                  paymentResult.txId || 
                                  paymentResult.tx_id ||
                                  paymentResult.id || 
                                  paymentResult.payment_id ||
                                  newPaymentId; // fallback to requestData의 paymentId
        
        console.log('[portone-kakaopay] paymentResult에서 추출한 paymentId', {
          paymentId: portonePaymentId,
          paymentResultKeys: Object.keys(paymentResult || {}),
          fallbackUsed: portonePaymentId === newPaymentId,
        });
        
        if (portonePaymentId && params.orderId) {
          try {
            console.log('[portone-kakaopay] onPaymentSuccess에서 orders.transaction_id 업데이트 시도', {
              orderId: params.orderId,
              paymentId: portonePaymentId,
              note: '결제 요청 전에도 저장했지만, onPaymentSuccess에서도 확실히 업데이트',
            });
            
            const { data: updateData, error: updateError } = await supabase
              .from('orders')
              .update({ transaction_id: portonePaymentId })
              .eq('id', params.orderId)
              .select('id, transaction_id, payment_status')
              .single();
            
            if (updateError) {
              console.error('[portone-kakaopay] onPaymentSuccess에서 orders.transaction_id 업데이트 실패:', {
                orderId: params.orderId,
                paymentId: portonePaymentId,
                error: updateError,
              });
              // transaction_id 업데이트 실패해도 결제는 계속 진행 (웹훅에서 처리 가능)
            } else {
              console.log('[portone-kakaopay] onPaymentSuccess에서 orders.transaction_id 업데이트 성공', {
                orderId: params.orderId,
                paymentId: portonePaymentId,
                updatedOrder: updateData,
                note: '이제 웹훅에서 transaction_id로 주문을 찾을 수 있음',
              });
            }
          } catch (error) {
            console.error('[portone-kakaopay] onPaymentSuccess에서 orders.transaction_id 업데이트 중 오류:', {
              orderId: params.orderId,
              paymentId: portonePaymentId,
              error,
            });
            // 오류가 발생해도 결제는 계속 진행
          }
        } else {
          console.warn('[portone-kakaopay] onPaymentSuccess에서 transaction_id 업데이트 건너뜀', {
            orderId: params.orderId,
            paymentId: portonePaymentId,
            reason: !portonePaymentId ? 'paymentId 없음' : 'orderId 없음',
          });
        }
        
        // 사용자 정의 성공 콜백 호출
        if (params.onSuccess) {
          params.onSuccess(paymentResult);
        }

        // 결제 완료 후 리다이렉트 URL로 이동
        // 카카오페이는 결제 완료 후 redirectUrl로 자동 리다이렉트되지만,
        // onPaymentSuccess 콜백에서도 명시적으로 처리하여 이중결제 방지
        if (returnUrl) {
          console.log('[portone-kakaopay] 결제 완료 후 리다이렉트', { returnUrl });
          // 약간의 지연 후 리다이렉트 (콜백 처리 완료 대기)
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 500);
        }
      },
      onPaymentFail: (error: any) => {
        console.error('[portone-kakaopay] onPaymentFail', error);
        if (params.onError) {
          params.onError(error);
        }
      },
    });

    return {
      success: true,
      merchant_uid: params.orderId,
      paymentId: newPaymentId, // PG 결제 식별 ID 반환 (transaction_id)
      error_msg: 'KakaoPay 결제창이 열렸습니다.',
    };
  } catch (error) {
    console.error('[portone-kakaopay] KakaoPay 결제 요청 오류', error);
    return {
      success: false,
      error_msg: error instanceof Error ? error.message : 'KakaoPay 결제 요청 중 오류가 발생했습니다.',
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
