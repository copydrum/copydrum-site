import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { openCashChargeModal } from '../../lib/cashChargeModal';
import { formatPrice } from '../../lib/priceFormatter';
import { isEnglishHost } from '../../i18n/languages';

interface InsufficientCashModalProps {
  open: boolean;
  currentBalance: number;
  requiredAmount: number;
  onClose: () => void;
}

export const InsufficientCashModal = ({
  open,
  currentBalance,
  requiredAmount,
  onClose,
}: InsufficientCashModalProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // 영문 사이트 여부 확인
  const isEnglishSite = typeof window !== 'undefined' && isEnglishHost(window.location.host);

  // 캐시 금액 포맷 함수 (영문 사이트는 USD, 한국어 사이트는 KRW)
  const formatCashAmount = (amount: number) => {
    return formatPrice({ 
      amountKRW: amount, 
      language: i18n.language,
      host: typeof window !== 'undefined' ? window.location.host : undefined
    }).formatted;
  };

  if (!open) return null;

  const handleGoToCashCharge = () => {
    onClose();
    // 마이페이지의 캐시 탭으로 이동
    navigate('/mypage?tab=cash');
  };

  const handleOpenCashChargeModal = () => {
    onClose();
    openCashChargeModal();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('payment.notEnoughCashTitle')}</h2>
        </div>

        <div className="px-5 py-6 space-y-4">
          <p className="text-sm text-gray-700">{t('payment.notEnoughCashMessage')}</p>
          
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('payment.amount')}:</span>
              <span className="font-semibold text-gray-900">
                {formatCashAmount(requiredAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('payment.cash')}:</span>
              <span className="font-semibold text-red-600">
                {formatCashAmount(currentBalance)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600">{i18n.language?.startsWith('ko') ? '부족한 금액' : 'Shortfall'}:</span>
              <span className="font-semibold text-red-600">
                {formatCashAmount(requiredAmount - currentBalance)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-5 py-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('button.cancel')}
          </button>
          <button
            type="button"
            onClick={handleOpenCashChargeModal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t('payment.goToCashCharge')}
          </button>
        </div>
      </div>
    </div>
  );
};

