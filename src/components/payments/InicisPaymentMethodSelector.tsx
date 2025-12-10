import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type InicisPayMethod = 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER';

interface InicisPaymentMethodSelectorProps {
  open: boolean;
  amount: number;
  onClose: () => void;
  onSelect: (payMethod: InicisPayMethod) => void;
}

export type { InicisPayMethod };

export const InicisPaymentMethodSelector = ({
  open,
  amount,
  onClose,
  onSelect,
}: InicisPaymentMethodSelectorProps) => {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<InicisPayMethod>('CARD');

  if (!open) return null;

  const handleConfirm = () => {
    onSelect(selectedMethod);
  };

  const paymentMethods: Array<{
    id: InicisPayMethod;
    name: string;
    description: string;
    icon: string;
  }> = [
    {
      id: 'CARD',
      name: t('payment.inicis.card') || '신용카드',
      description: t('payment.inicis.cardDescription') || '신용카드로 결제',
      icon: 'ri-bank-card-line',
    },
    {
      id: 'VIRTUAL_ACCOUNT',
      name: t('payment.inicis.virtualAccount') || '가상계좌',
      description: t('payment.inicis.virtualAccountDescription') || '가상계좌로 입금',
      icon: 'ri-bank-line',
    },
    {
      id: 'TRANSFER',
      name: t('payment.inicis.transfer') || '실시간 계좌이체',
      description: t('payment.inicis.transferDescription') || '실시간 계좌이체로 결제',
      icon: 'ri-exchange-line',
    },
  ];

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('payment.inicis.selectMethod') || 'KG이니시스 결제 수단 선택'}
          </h2>
          <div className="mt-1">
            <p className="text-sm text-gray-600">
              {t('payments.amountLabel')} <span className="font-semibold text-gray-900">{amount.toLocaleString()}원</span>
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                  selectedMethod === method.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="inicisPayMethod"
                    value={method.id}
                    checked={selectedMethod === method.id}
                    onChange={() => setSelectedMethod(method.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <i className={`${method.icon} text-blue-600 text-xl`}></i>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{method.name}</p>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </div>
                </div>
              </label>
            ))}
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('button.confirm') || '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

