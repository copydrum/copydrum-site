import { useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';
import { calculatePointPrice } from '../../lib/pointPrice';
import { isEnglishHost } from '../../i18n/languages';

type PaymentMethod = 'cash' | 'card' | 'bank' | 'paypal';

type PaymentContext = 'buyNow' | 'cashCharge';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description?: string;
  icon: string;
  color: string;
  badge?: string;
  disabled?: boolean;
}

interface PaymentMethodSelectorProps {
  open: boolean;
  amount: number;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
  allowCash?: boolean;
  disabledMethods?: PaymentMethod[];
  context?: PaymentContext; // 'buyNow' (바로구매) 또는 'cashCharge' (캐시 충전)
}

export type { PaymentMethod, PaymentContext };

/**
 * 도메인과 컨텍스트에 따라 사용 가능한 결제수단 목록을 반환합니다.
 * 
 * @param domain - 'ko' (한국어 사이트) 또는 'en' (영문 사이트)
 * @param context - 'buyNow' (바로구매) 또는 'cashCharge' (캐시 충전)
 * @param t - i18n 번역 함수
 * @returns 사용 가능한 결제수단 옵션 배열
 */
function getAvailablePaymentMethods(
  domain: 'ko' | 'en',
  context: PaymentContext,
  t: (key: string) => string,
  allowCash: boolean = true,
): PaymentMethodOption[] {
  // 영문 사이트: 바로구매 컨텍스트에서는 캐시 결제 + PayPal 표시
  if (domain === 'en') {
    if (context === 'buyNow') {
      const methods: PaymentMethodOption[] = [];
      
      // 캐시 결제 옵션 추가
      if (allowCash) {
        methods.push({
          id: 'cash',
          name: t('payment.payWithCash'),
          description: t('payment.cashDescription'),
          icon: 'ri-wallet-3-line',
          color: 'text-purple-600',
          disabled: false,
        });
      }
      
      // PayPal 옵션 추가
      methods.push({
        id: 'paypal',
        name: t('payment.paypal'),
        description: t('payment.paypalDescription'),
        icon: 'ri-paypal-line',
        color: 'text-blue-700',
        disabled: false,
      });
      
      return methods;
    }
    
    // 캐시 충전 컨텍스트: PayPal만 표시 (기존 동작 유지)
    return [
      {
        id: 'paypal',
        name: t('payment.paypal'),
        description: t('payment.paypalDescription'),
        icon: 'ri-paypal-line',
        color: 'text-blue-700',
        disabled: false,
      },
    ];
  }

  // 한국어 사이트
  if (domain === 'ko') {
    // 바로구매 컨텍스트: 캐시 결제 + 무통장입금만 표시
    if (context === 'buyNow') {
      const methods: PaymentMethodOption[] = [];
      
      if (allowCash) {
        methods.push({
          id: 'cash',
          name: t('payment.payWithCash'),
          description: t('payment.cashDescription'),
          icon: 'ri-wallet-3-line',
          color: 'text-purple-600',
          disabled: false,
        });
      }
      
      methods.push({
        id: 'bank',
        name: t('payment.bank'),
        description: t('payment.bankDescription'),
        icon: 'ri-bank-line',
        color: 'text-green-600',
        disabled: false,
      });

      // Feature flag: 향후 PG 심사 완료 후 카드/간편결제를 다시 노출할 수 있도록
      const enableCardInKR = import.meta.env.VITE_ENABLE_CARD_IN_KR === 'true';
      if (enableCardInKR) {
        // 카드 결제 추가 (향후 사용)
        methods.push({
          id: 'card',
          name: t('payment.card'),
          description: t('payment.cardDescription'),
          icon: 'ri-bank-card-line',
          color: 'text-blue-600',
          disabled: false,
        });
      }

      return methods;
    }

    // 캐시 충전 컨텍스트: 무통장입금만 표시 (기존 동작 유지)
    if (context === 'cashCharge') {
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
  
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18nInstance.language }).formatted,
    [i18nInstance.language],
  );

  const isEnglishSite = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isEnglishHost(window.location.host);
  }, []);

  const domain: 'ko' | 'en' = useMemo(() => {
    return isEnglishSite ? 'en' : 'ko';
  }, [isEnglishSite]);

  const paymentMethodOptions: PaymentMethodOption[] = useMemo(() => {
    return getAvailablePaymentMethods(domain, context, t, allowCash);
  }, [domain, context, t, allowCash]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('payment.selectMethod')}</h2>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-gray-600">
              {t('payment.amount')} <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
            </p>
            <p className="text-sm text-gray-600">
              {t('payment.pointPrice', { price: calculatePointPrice(amount).toLocaleString('en-US') })}
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="space-y-3">
            {paymentMethodOptions.map((option) => {
              const isDisabled =
                option.disabled || disabledMethods.includes(option.id) || (option.id === 'cash' && !allowCash);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (isDisabled) return;
                    onSelect(option.id);
                  }}
                  disabled={isDisabled}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                      : 'cursor-pointer border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`${option.icon} ${option.color} text-xl`}></i>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{option.name}</p>
                      {option.description ? (
                        <p className="text-xs text-gray-500">{option.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {option.badge ? (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                      {option.badge}
                    </span>
                  ) : null}
                </button>
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
          </div>
        </div>
      </div>
    </div>
  );
};


