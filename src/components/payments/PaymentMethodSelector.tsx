import { useCallback, useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSiteCurrency, convertFromKrw, formatCurrency as formatCurrencyUtil } from '../../lib/currency';
import { isKoreanSiteHost } from '../../config/hostType';

type PaymentMethod = 'cash' | 'card' | 'bank' | 'paypal' | 'kakaopay' | 'inicis' | 'virtual_account' | 'transfer';

type PaymentContext = 'buyNow' | 'cashCharge';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description?: string;
  icon: string;
  color: string;
  badge?: string;
  disabled?: boolean;
  // 결제 처리에 필요한 메타데이터
  channelKey?: string;
  payMethod?: 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'EASY_PAY';
  pg?: string;
}

interface PaymentMethodSelectorProps {
  open: boolean;
  amount: number;
  onClose: () => void;
  onSelect: (method: PaymentMethod, option?: PaymentMethodOption) => void;
  allowCash?: boolean;
  disabledMethods?: PaymentMethod[];
  context?: PaymentContext; // 'buyNow' (바로구매) 또는 'cashCharge' (캐시 충전)
  userCredits?: number; // 사용자 포인트 잔액 (한국어 사이트에서 포인트 결제 옵션 표시용)
}

export type { PaymentMethod, PaymentContext, PaymentMethodOption };

/**
 * 도메인과 컨텍스트에 따라 사용 가능한 결제수단 목록을 반환합니다.
 * 
 * @param siteType - 'ko' (한국어 사이트) 또는 'global' (글로벌 사이트)
 * @param context - 'buyNow' (바로구매) 또는 'cashCharge' (캐시 충전)
 * @param t - i18n 번역 함수
 * @param userCredits - 사용자 포인트 잔액 (한국어 사이트에서 포인트 결제 옵션 표시용)
 * @returns 사용 가능한 결제수단 옵션 배열
 */
function getAvailablePaymentMethods(
  siteType: 'ko' | 'global',
  context: PaymentContext,
  t: (key: string) => string,
  userCredits: number = 0,
): PaymentMethodOption[] {
  // 글로벌 사이트: PayPal만 표시
  if (siteType === 'global') {
    return [
      {
        id: 'paypal',
        name: t('payment.paypal'),
        description: t('payments.paypalDescription'),
        icon: 'ri-paypal-line',
        color: 'text-blue-700',
        disabled: false,
      },
    ];
  }

  // 한국어 사이트: 통합 리스트 형태로 5가지 결제 수단 제공
  if (siteType === 'ko') {
    const methods: PaymentMethodOption[] = [
      // 1. 신용카드 (KG이니시스)
      {
        id: 'card',
        name: '신용카드',
        description: '신용카드로 결제',
        icon: 'ri-bank-card-line',
        color: 'text-blue-600',
        disabled: false,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_INICIS,
        payMethod: 'CARD',
        pg: 'KG이니시스',
      },
      // 2. 카카오페이
      {
        id: 'kakaopay',
        name: t('payment.kakaopay') || '카카오페이',
        description: t('payment.kakaopayDescription') || '간편하게 카카오페이로 결제',
        icon: 'ri-kakao-talk-line',
        color: 'text-yellow-500',
        disabled: false,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_KAKAOPAY,
        payMethod: 'EASY_PAY',
        pg: '카카오페이',
      },
      // 3. 무통장입금 (가상계좌) - KG이니시스
      {
        id: 'virtual_account',
        name: '무통장입금 (가상계좌)',
        description: '가상계좌로 입금',
        icon: 'ri-bank-line',
        color: 'text-green-600',
        disabled: false,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_INICIS,
        payMethod: 'VIRTUAL_ACCOUNT',
        pg: 'KG이니시스',
      },
      // 4. 실시간 계좌이체 - KG이니시스
      {
        id: 'transfer',
        name: '실시간 계좌이체',
        description: '실시간 계좌이체로 결제',
        icon: 'ri-exchange-line',
        color: 'text-purple-600',
        disabled: false,
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY_INICIS,
        payMethod: 'TRANSFER',
        pg: 'KG이니시스',
      },
    ];

    // 5. 캐시 잔액 (포인트가 있을 때만 표시)
    if (userCredits > 0 && context === 'buyNow') {
      methods.push({
        id: 'cash',
        name: t('payment.cash'),
        description: t('payment.cashDescription'),
        icon: 'ri-coins-line',
        color: 'text-yellow-600',
        disabled: false,
      });
    }

    return methods;
  }

  // 기본값: 무통장입금만
  return [
    {
      id: 'bank',
      name: t('payment.bank'),
      description: t('payment.bankDescription'),
      icon: 'ri-bank-line',
      color: 'text-green-600',
      disabled: false,
    },
  ];
}

export const PaymentMethodSelector = ({
  open,
  amount,
  onClose,
  onSelect,
  allowCash = true,
  disabledMethods = [],
  context = 'buyNow', // 기본값은 바로구매
  userCredits = 0, // 사용자 포인트 잔액
}: PaymentMethodSelectorProps) => {
  const { t, i18n: i18nInstance } = useTranslation();

  // payment 번역 키가 로딩되었는지 보장
  // 현재 구조에서는 모든 번역이 하나의 리소스에 평탄화되어 있지만,
  // 안전을 위해 번역 키 존재 여부를 확인
  useEffect(() => {
    if (open) {
      // 번역 키가 없으면 경고 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        const keys = [
          'payment.selectMethod',
          'payment.amount',
          'payment.bankDescription',
          'payment.cash',
          'payment.cashDescription',
        ];
        keys.forEach((key) => {
          if (!i18nInstance.exists(key)) {
            console.warn(`[PaymentMethodSelector] 번역 키 누락: ${key}`);
          }
        });
      }
    }
  }, [open, i18nInstance]);

  // 통합 통화 로직 적용 (locale 기반)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'copydrum.com';
  const currency = useMemo(() => getSiteCurrency(hostname, i18nInstance.language), [hostname, i18nInstance.language]);
  const isKoreanSite = isKoreanSiteHost(hostname);
  // 한국 사이트가 아니면 모두 글로벌 사이트로 처리
  const isGlobalSite = !isKoreanSite;

  const formatCurrency = useCallback(
    (value: number) => {
      const convertedAmount = convertFromKrw(value, currency);
      return formatCurrencyUtil(convertedAmount, currency);
    },
    [currency],
  );

  const siteType: 'ko' | 'global' = useMemo(() => {
    return isGlobalSite ? 'global' : 'ko';
  }, [isGlobalSite]);

  const paymentMethodOptions: PaymentMethodOption[] = useMemo(() => {
    return getAvailablePaymentMethods(siteType, context, t, userCredits);
  }, [siteType, context, t, userCredits]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedOption, setSelectedOption] = useState<PaymentMethodOption | null>(null);

  // 모달이 열릴 때 선택 상태 초기화
  useEffect(() => {
    if (open) {
      setSelectedMethod(null);
      setSelectedOption(null);
    }
  }, [open]);

  const handleConfirm = () => {
    if (selectedMethod && selectedOption) {
      onSelect(selectedMethod, selectedOption);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('payments.methodSelectionTitle')}</h2>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-gray-600">
              {t('payments.amountLabel')} <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="space-y-3">
            {paymentMethodOptions.map((option) => {
              const isDisabled =
                option.disabled || disabledMethods.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                      : selectedMethod === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'cursor-pointer border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.id}
                    checked={selectedMethod === option.id}
                    onChange={() => {
                      if (isDisabled) return;
                      setSelectedMethod(option.id);
                      setSelectedOption(option);
                    }}
                    disabled={isDisabled}
                    className="h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex flex-1 items-center gap-3">
                    {option.id === 'kakaopay' && isKoreanSite ? (
                      <img 
                        src="/payment_icon_yellow_medium.png" 
                        alt="카카오페이" 
                        className="h-6 w-auto shrink-0 object-contain"
                      />
                    ) : (
                      <i className={`${option.icon} ${option.color} shrink-0 text-xl`}></i>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">{option.name}</p>
                      {option.description ? (
                        <p className="text-xs text-gray-500">{option.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {option.badge ? (
                    <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                      {option.badge}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('button.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedMethod}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              결제하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


