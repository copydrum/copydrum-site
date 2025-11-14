import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { startCashCharge } from '../../lib/payments';
import { useTranslation } from 'react-i18next';
import type { VirtualAccountInfo } from '../../lib/payments';

interface MobileCashChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

type PaymentSelection = 'card' | 'bank';

interface ChargeOption {
  amount: number;
  bonus?: number;
  bonusPercent?: string;
}

interface PaymentMethodConfig {
  id: PaymentSelection;
  nameKey: string;
  icon: string;
  color: string;
  disabled?: boolean;
}

const chargeOptions: ChargeOption[] = [
  { amount: 3000 },
  { amount: 5000, bonus: 500, bonusPercent: '10%' },
  { amount: 10000, bonus: 1500, bonusPercent: '15%' },
  { amount: 30000, bonus: 6000, bonusPercent: '20%' },
  { amount: 50000, bonus: 11000, bonusPercent: '22%' },
  { amount: 100000, bonus: 25000, bonusPercent: '25%' },
];

const paymentMethodConfigs: PaymentMethodConfig[] = [
  {
    id: 'card',
    nameKey: 'payment.card',
    icon: 'ri-bank-card-line',
    color: 'text-blue-600',
    disabled: true,
  },
  {
    id: 'bank',
    nameKey: 'payment.bank',
    icon: 'ri-bank-line',
    color: 'text-green-600',
  },
];

export default function MobileCashChargeModal({
  isOpen,
  onClose,
  user,
}: MobileCashChargeModalProps) {
  const { t, i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );
  const formatPoints = useCallback(
    (value: number) => new Intl.NumberFormat(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US').format(value),
    [i18n.language],
  );
  const [selectedAmount, setSelectedAmount] = useState<number>(chargeOptions[2].amount);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSelection>('bank');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userCash, setUserCash] = useState(0);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showDepositorInput, setShowDepositorInput] = useState(false);
  const [depositorName, setDepositorName] = useState('');

  const selectedOption = useMemo(
    () => chargeOptions.find((option) => option.amount === selectedAmount) ?? chargeOptions[0],
    [selectedAmount],
  );

  const resetState = useCallback(() => {
    setSelectedAmount(chargeOptions[2].amount);
    setSelectedPayment('bank');
    setAgreementChecked(false);
    setIsProcessing(false);
    setBankTransferInfo(null);
    setShowDepositorInput(false);
    setDepositorName('');
  }, []);

  const loadUserCash = useCallback(async () => {
    if (!user) {
      setUserCash(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('모바일 캐쉬 조회 오류:', error);
        setUserCash(0);
        return;
      }

      setUserCash(data?.credits ?? 0);
    } catch (error) {
      console.error('모바일 캐쉬 로드 오류:', error);
      setUserCash(0);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadUserCash();
      setAgreementChecked(false);
      setIsProcessing(false);
    } else {
      resetState();
    }
  }, [isOpen, loadUserCash, resetState]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleConfirm = async () => {
    if (!user) {
      alert(t('auth.loginRequired'));
      handleClose();
      return;
    }

    if (!agreementChecked) {
      alert(t('mobile.cash.agreementRequired'));
      return;
    }

    if (selectedPayment === 'bank') {
      setShowDepositorInput(true);
      return;
    }

    alert(t('mobile.cash.cardPending'));
  };

  const handleBankTransferConfirm = async () => {
    if (!user) return;

    if (!depositorName.trim()) {
      alert(t('mobile.cash.enterDepositor'));
      return;
    }

    setIsProcessing(true);

    try {
      const result = await startCashCharge({
        userId: user.id,
        amount: selectedOption.amount,
        bonusAmount: selectedOption.bonus ?? 0,
        paymentMethod: 'bank_transfer',
        description: `${t('mobile.cash.title')} ${formatCurrency(selectedOption.amount)}`,
        buyerName: user.email ?? null,
        buyerEmail: user.email ?? null,
        depositorName: depositorName.trim(),
        returnUrl: new URL('/payments/inicis/return', window.location.origin).toString(),
      });

      setBankTransferInfo(result.virtualAccountInfo ?? null);
      setShowDepositorInput(false);
      await loadUserCash();
      alert(t('mobile.cash.bankTransferRequested'));
    } catch (error) {
      console.error('모바일 캐쉬 충전 오류:', error);
      alert(error instanceof Error ? error.message : t('mobile.cash.error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-end bg-black/40 md:items-center md:justify-center">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={handleClose}
      />

      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl md:ml-0 md:h-auto md:max-h-[90vh] md:rounded-2xl md:shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <p className="text-base font-bold text-gray-900">{t('mobile.cash.title')}</p>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('mobile.cash.close')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5">
          {user ? (
            <>
              <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-xs text-blue-700">{t('mobile.cash.currentBalance')}</p>
                  <p className="text-2xl font-extrabold text-blue-900">
                    {formatCurrency(userCash)}
                  </p>
                </div>
                <i className="ri-wallet-3-line text-3xl text-blue-500" />
              </div>

              {bankTransferInfo ? (
                <section className="mt-5 space-y-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
                  <h2 className="text-sm font-semibold text-blue-900">{t('mobile.cash.bankGuideTitle')}</h2>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li>
                      <span className="font-medium text-blue-900">{t('mobile.cash.bank')}</span>{' '}
                      {bankTransferInfo.bankName}
                    </li>
                    <li>
                      <span className="font-medium text-blue-900">{t('mobile.cash.accountNumber')}</span>{' '}
                      {bankTransferInfo.accountNumber}
                    </li>
                    <li>
                      <span className="font-medium text-blue-900">{t('mobile.cash.accountHolder')}</span>{' '}
                      {bankTransferInfo.depositor}
                    </li>
                    <li>
                      <span className="font-medium text-blue-900">{t('mobile.cash.amount')}</span>{' '}
                      {formatCurrency(bankTransferInfo.amount ?? selectedOption.amount)}
                    </li>
                    {bankTransferInfo.expectedDepositor ? (
                      <li>
                        <span className="font-medium text-blue-900">{t('mobile.cash.depositor')}</span>{' '}
                        <span className="font-semibold text-blue-700">
                          {bankTransferInfo.expectedDepositor}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                  {bankTransferInfo.message ? (
                    <p className="rounded-lg bg-white/60 px-3 py-2 text-xs text-blue-800">
                      {bankTransferInfo.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    {t('button.confirm')}
                  </button>
                </section>
              ) : showDepositorInput ? (
                <section className="mt-5 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-900">{t('mobile.cash.bankTransferInfo')}</h2>

                  <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{t('mobile.cash.transferAmount')}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(selectedOption.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">{t('mobile.cash.bankAccountInfo')}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{t('mobile.cash.bank')}</span>
                      <span className="text-xs font-medium text-gray-900">농협</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{t('mobile.cash.accountNumber')}</span>
                      <span className="text-xs font-medium text-gray-900">106-02-303742</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{t('mobile.cash.accountHolder')}</span>
                      <span className="text-xs font-medium text-gray-900">강만수</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="mobile-depositor-name" className="block text-sm font-semibold text-gray-900">
                      {t('mobile.cash.depositor')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mobile-depositor-name"
                      type="text"
                      value={depositorName}
                      onChange={(e) => setDepositorName(e.target.value)}
                      placeholder={t('mobile.cash.depositorPlaceholder')}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">{t('mobile.cash.depositorNote')}</p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                    <div className="flex gap-2">
                      <i className="ri-information-line text-yellow-600 text-base flex-shrink-0 mt-0.5"></i>
                      <div className="text-xs text-gray-700 space-y-1">
                        <p className="font-semibold text-gray-900">{t('mobile.cash.noticeTitle')}</p>
                        <p>{t('mobile.cash.notice1')}</p>
                        <p>{t('mobile.cash.notice2')}</p>
                        <p>{t('mobile.cash.notice3')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDepositorInput(false)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t('button.previous')}
                    </button>
                    <button
                      type="button"
                      onClick={handleBankTransferConfirm}
                      disabled={isProcessing}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                    >
                      {isProcessing ? t('mobile.cash.processing') : t('button.confirm')}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-900">{t('mobile.cash.chargeAmount')}</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {chargeOptions.map((option) => {
                        const isSelected = selectedAmount === option.amount;
                        return (
                          <button
                            key={option.amount}
                            type="button"
                            onClick={() => setSelectedAmount(option.amount)}
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200'
                            }`}
                          >
                            <p className="text-sm font-semibold">{formatCurrency(option.amount)}</p>
                            {option.bonus ? (
                              <p className="mt-1 text-xs text-blue-600">
                                {t('mobile.cash.bonusLabel', {
                                  amount: formatPoints(option.bonus ?? 0),
                                  percent: option.bonusPercent,
                                })}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-gray-500">
                                {t('mobile.cash.noBonus')}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-900">{t('payment.method')}</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {paymentMethodConfigs.map((method) => {
                        const isSelected = method.id === selectedPayment;
                        const isDisabled = method.disabled;
                        const label = t(method.nameKey);
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              if (isDisabled) {
                                alert(t('mobile.cash.paymentUnavailable'));
                                return;
                              }
                              setSelectedPayment(method.id);
                            }}
                            disabled={isDisabled}
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : isDisabled
                                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <i className={`${method.icon} ${isDisabled ? 'text-gray-400' : method.color} text-lg`} />
                                <p className="text-sm font-semibold">{label}</p>
                              </div>
                              <div className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center">
                                {isSelected ? (
                                  <span className="h-2 w-2 rounded-full bg-current" />
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="mt-6">
                    <label className="flex items-start gap-3 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={agreementChecked}
                        onChange={(event) => setAgreementChecked(event.target.checked)}
                        className="mt-[2px] h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{t('mobile.cash.agreementText')}</span>
                    </label>
                  </section>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <i className="ri-user-3-line text-5xl text-gray-300" />
              <p className="mt-4 text-base font-semibold text-gray-700">
                {t('auth.loginRequired')}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t('mobile.cash.loginDescription')}
              </p>
            </div>
          )}
        </main>

        {user && !bankTransferInfo && !showDepositorInput ? (
          <footer className="border-t border-gray-100 px-4 py-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-semibold text-white transition-all ${
                isProcessing
                  ? 'opacity-70'
                  : 'hover:from-blue-700 hover:to-purple-700 active:scale-[0.99]'
              }`}
            >
            {isProcessing ? t('mobile.cash.processing') : t('button.next')}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}


