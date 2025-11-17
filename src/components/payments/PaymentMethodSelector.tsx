import { Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

type PaymentMethod = 'cash' | 'card' | 'bank';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description?: string;
  icon: string;
  color: string;
  badge?: string;
  disabled?: boolean;
}

const paymentMethodOptions: PaymentMethodOption[] = [
  {
    id: 'cash',
    name: '보유 캐쉬로 결제',
    description: '보유 캐쉬에서 즉시 차감됩니다.',
    icon: 'ri-coins-line',
    color: 'text-yellow-600',
  },
  {
    id: 'card',
    name: '카드 결제',
    description: 'KG이니시스 안전결제로 신용카드 결제가 가능합니다.',
    icon: 'ri-bank-card-line',
    color: 'text-blue-600',
    disabled: false,
  },
  {
    id: 'bank',
    name: '무통장입금',
    description: '입금 확인 후 관리자가 수동으로 구매를 완료합니다.',
    icon: 'ri-bank-line',
    color: 'text-green-600',
  },
];

interface PaymentMethodSelectorProps {
  open: boolean;
  amount: number;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
  allowCash?: boolean;
  disabledMethods?: PaymentMethod[];
}

export const PaymentMethodSelector = ({
  open,
  amount,
  onClose,
  onSelect,
  allowCash = true,
  disabledMethods = [],
}: PaymentMethodSelectorProps) => {
  const { i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">결제수단 선택</h2>
          <p className="mt-1 text-sm text-gray-600">
            결제 금액 <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
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
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


