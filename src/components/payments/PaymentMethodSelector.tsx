import { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';
import { isEnglishHost } from '../../i18n/languages';

type PaymentMethod = 'cash' | 'card' | 'bank' | 'paypal';

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
}

export type { PaymentMethod };

export const PaymentMethodSelector = ({
  open,
  amount,
  onClose,
  onSelect,
  allowCash = true,
  disabledMethods = [],
}: PaymentMethodSelectorProps) => {
  const { t, i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );

  const isEnglishSite = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isEnglishHost(window.location.host);
  }, []);

  const paymentMethodOptions: PaymentMethodOption[] = useMemo(() => {
    const options: PaymentMethodOption[] = [
      {
        id: 'cash',
        name: t('payment.cash'),
        description: t('payment.cashDescription'),
        icon: 'ri-coins-line',
        color: 'text-yellow-600',
      },
      {
        id: 'card',
        name: t('payment.card'),
        description: t('payment.cardDescription'),
        icon: 'ri-bank-card-line',
        color: 'text-blue-600',
        disabled: false,
      },
      {
        id: 'bank',
        name: t('payment.bank'),
        description: t('payment.bankDescription'),
        icon: 'ri-bank-line',
        color: 'text-green-600',
      },
    ];

    // PayPal은 영문 사이트에서만 표시
    if (isEnglishSite) {
      options.push({
        id: 'paypal',
        name: t('payment.paypal'),
        description: t('payment.paypalDescription'),
        icon: 'ri-paypal-line',
        color: 'text-blue-700',
        disabled: false,
      });
    }

    return options;
  }, [t, isEnglishSite]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('payment.selectMethod')}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('payment.amount')} <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
          </p>
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


