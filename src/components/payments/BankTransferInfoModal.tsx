import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

interface BankTransferInfoModalProps {
  open: boolean;
  amount: number;
  userName?: string | null;
  onConfirm: (depositorName: string) => void;
  onClose: () => void;
}

export const BankTransferInfoModal = ({
  open,
  amount,
  userName,
  onConfirm,
  onClose,
}: BankTransferInfoModalProps) => {
  const [depositorName, setDepositorName] = useState(userName || '');
  const { i18n } = useTranslation();

  useEffect(() => {
    if (open) {
      setDepositorName(userName || '');
    }
  }, [open, userName]);

  if (!open) return null;

  const formatCurrency = (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted;

  const handleConfirm = () => {
    if (!depositorName.trim()) {
      alert('입금자명을 입력해 주세요.');
      return;
    }
    onConfirm(depositorName);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">무통장 입금 안내</h2>
        </div>

        <div className="px-5 py-6 space-y-5">
          {/* 입금 금액 */}
          <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">입금하실 금액</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(amount)}</span>
            </div>
          </div>

          {/* 입금 계좌 정보 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">입금 계좌 정보</h3>
            <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">은행</span>
                <span className="text-sm font-medium text-gray-900">카카오뱅크</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">계좌번호</span>
                <span className="text-sm font-medium text-gray-900">3333-15-0302437</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">예금주</span>
                <span className="text-sm font-medium text-gray-900">강만수</span>
              </div>
            </div>
          </div>

          {/* 입금자명 입력 */}
          <div className="space-y-2">
            <label htmlFor="depositor-name" className="block text-sm font-semibold text-gray-900">
              입금자명 <span className="text-red-500">*</span>
            </label>
            <input
              id="depositor-name"
              type="text"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder="입금자명을 입력하세요"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              * 회원명과 입금자가 다른 경우, 입금자명을 기입해 주시기 바랍니다.
            </p>
          </div>

          {/* 안내 문구 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <div className="flex gap-2">
              <i className="ri-information-line text-yellow-600 text-lg flex-shrink-0"></i>
              <div className="text-xs text-gray-700 space-y-1">
                <p>• 입금 확인 후 관리자가 수동으로 구매를 완료 처리합니다.</p>
                <p>• 입금자명이 일치하지 않으면 확인이 지연될 수 있습니다.</p>
                <p>• 입금 확인은 영업일 기준 1~2일 소요될 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-5 py-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

