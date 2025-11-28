import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { hasPurchasedSheet } from '../lib/purchaseCheck';
import { buySheetNow, startSheetPurchase } from '../lib/payments';
import type { VirtualAccountInfo } from '../lib/payments';
import type { PaymentMethod } from '../components/payments';
import { processCashPurchase } from '../lib/cashPurchases';

export interface SheetForBuyNow {
  id: string;
  title: string;
  price: number;
}

export interface UseBuyNowReturn {
  // State
  showPaymentSelector: boolean;
  showBankTransferModal: boolean;
  showPayPalModal: boolean;
  bankTransferInfo: VirtualAccountInfo | null;
  paymentProcessing: boolean;
  pendingSheet: SheetForBuyNow | null;

  // Actions
  handleBuyNow: (sheet: SheetForBuyNow) => Promise<void>;
  handlePaymentMethodSelect: (method: PaymentMethod) => void;
  handleBankTransferConfirm: (depositorName: string) => Promise<void>;
  handlePayPalInitiate: (elementId: string) => Promise<void>;

  // Setters for closing modals
  closePaymentSelector: () => void;
  closeBankTransferModal: () => void;
  closePayPalModal: () => void;
}

/**
 * 공유 "Buy Now" 훅
 * Sheet Detail Page와 Categories Page에서 동일한 로직을 사용하도록 함
 */
export function useBuyNow(user: User | null): UseBuyNowReturn {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [pendingSheet, setPendingSheet] = useState<SheetForBuyNow | null>(null);

  const handleBuyNow = useCallback(
    async (sheet: SheetForBuyNow) => {
      if (!user) {
        const redirectPath = window.location.pathname + window.location.search;
        navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }

      try {
        const alreadyPurchased = await hasPurchasedSheet(user.id, sheet.id);
        if (alreadyPurchased) {
          alert(t('categoriesPage.alreadyPurchased', { title: sheet.title }));
          return;
        }
      } catch (error) {
        console.error('바로구매 전 구매 이력 확인 오류:', error);
        alert(t('categoriesPage.purchaseCheckError'));
        return;
      }

      // 모든 사이트에서 결제수단 선택 모달 열기
      // PaymentMethodSelector가 사이트 타입에 따라 적절한 결제수단만 표시
      setPendingSheet(sheet);
      setShowPaymentSelector(true);
    },
    [user, navigate, t]
  );

  const handlePaymentMethodSelect = useCallback(
    async (method: PaymentMethod) => {
      if (!user || !pendingSheet) return;

      // ✅ 중요: PayPal 선택 시 결제수단 선택 모달을 먼저 닫지 않음
      // Sheet Detail Page와 동일한 패턴 사용
      setShowPaymentSelector(false);

      if (method === 'bank') {
        setShowBankTransferModal(true);
        return;
      }

      if (method === 'paypal') {
        // ✅ PayPal 모달을 바로 열고, pendingSheet는 유지
        // finally 블록에서 null로 설정하지 않음
        setShowPayPalModal(true);
        return;
      }

      if (method === 'kakaopay') {
        // 카카오페이 결제 처리
        const price = Math.max(0, pendingSheet.price ?? 0);
        if (price <= 0) {
          alert('결제 금액이 올바르지 않습니다.');
          return;
        }

        setPaymentProcessing(true);

        try {
          // 먼저 주문 생성
          await startSheetPurchase({
            userId: user.id,
            items: [
              {
                sheetId: pendingSheet.id,
                sheetTitle: pendingSheet.title,
                price,
              },
            ],
            amount: price,
            paymentMethod: 'kakaopay',
            description: t('categoriesPage.purchaseDescription', { title: pendingSheet.title }),
            buyerName: user.email ?? null,
            buyerEmail: user.email ?? null,
            onSuccess: (response) => {
              console.log('[useBuyNow] KakaoPay 결제 성공 콜백', response);
              // 결제 완료 후 상태 초기화
              setPaymentProcessing(false);
              setPendingSheet(null);
              // 결제 완료 후 리다이렉트는 returnUrl에서 처리됨
            },
            onError: (error) => {
              console.error('[useBuyNow] KakaoPay 결제 실패 콜백', error);
              setPaymentProcessing(false);
              setPendingSheet(null);
              alert(
                error instanceof Error
                  ? error.message
                  : t('categoriesPage.purchaseError') || '결제 중 오류가 발생했습니다.'
              );
            },
          });

          // 카카오페이 결제는 startSheetPurchase 내부에서 처리됨
          console.log('[useBuyNow] KakaoPay 결제 요청 완료');
        } catch (error) {
          console.error('[useBuyNow] KakaoPay 결제 오류:', error);
          alert(
            error instanceof Error
              ? error.message
              : t('categoriesPage.purchaseError') || '결제 중 오류가 발생했습니다.'
          );
          setPaymentProcessing(false);
          setPendingSheet(null);
        }
        return;
      }

      if (method === 'cash') {
        // 포인트 결제 처리
        const price = Math.max(0, pendingSheet.price ?? 0);
        if (price <= 0) {
          alert('결제 금액이 올바르지 않습니다.');
          return;
        }

        setPaymentProcessing(true);

        try {
          const result = await processCashPurchase({
            userId: user.id,
            totalPrice: price,
            description: t('categoriesPage.purchaseDescription', { title: pendingSheet.title }),
            items: [
              {
                sheetId: pendingSheet.id,
                sheetTitle: pendingSheet.title,
                price,
              },
            ],
            sheetIdForTransaction: pendingSheet.id,
            paymentMethod: 'cash',
          });

          if (result.success) {
            alert(t('categoriesPage.purchaseSuccess') || '구매가 완료되었습니다.');
            // 구매 완료 후 페이지 새로고침 또는 리다이렉트
            window.location.reload();
          } else if (result.reason === 'INSUFFICIENT_CREDIT') {
            alert(
              t('payment.notEnoughCashMessage') ||
              `보유 포인트가 부족합니다. 현재 잔액: ${result.currentCredits.toLocaleString()}원`
            );
          }
        } catch (error) {
          console.error('[useBuyNow] 포인트 결제 오류:', error);
          alert(
            error instanceof Error
              ? error.message
              : t('categoriesPage.purchaseError') || '결제 중 오류가 발생했습니다.'
          );
        } finally {
          setPaymentProcessing(false);
          setPendingSheet(null);
        }
      }
    },
    [user, pendingSheet, t]
  );

  const handleBankTransferConfirm = useCallback(
    async (depositorName: string) => {
      if (!user || !pendingSheet) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 필수값 검증
      const trimmedDepositorName = depositorName?.trim();
      if (!trimmedDepositorName) {
        alert('입금자명을 입력해 주세요.');
        return;
      }

      const price = Math.max(0, pendingSheet.price ?? 0);
      if (price <= 0) {
        alert('결제 금액이 올바르지 않습니다.');
        return;
      }

      setPaymentProcessing(true);

      try {
        const result = await buySheetNow({
          user,
          sheet: {
            id: pendingSheet.id,
            title: pendingSheet.title,
            price,
          },
          description: t('categoriesPage.purchaseDescription', { title: pendingSheet.title }),
          depositorName: trimmedDepositorName,
        });

        if (result.paymentMethod === 'bank_transfer') {
          // 주문 생성 성공 - 모달의 성공 상태로 전환
          setBankTransferInfo(result.virtualAccountInfo ?? null);

          console.log('[useBuyNow] 무통장입금 주문 생성 성공:', {
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            amount: result.amount,
            depositorName: trimmedDepositorName,
          });
        }
      } catch (error) {
        console.error('[useBuyNow] 무통장입금 주문 처리 오류:', error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : t('categoriesPage.purchaseError') ||
            '주문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

        alert(errorMessage);

        // 에러 발생 시 모달 닫기
        setShowBankTransferModal(false);
        setBankTransferInfo(null);
      } finally {
        setPaymentProcessing(false);
      }
    },
    [user, pendingSheet, t]
  );

  const handlePayPalInitiate = useCallback(
    async (elementId: string) => {
      if (!user || !pendingSheet) return;

      const sheet = pendingSheet;
      const price = Math.max(0, sheet.price ?? 0);

      // ✅ PayPal의 경우 startSheetPurchase를 직접 호출
      // buySheetNow는 무통장입금용이므로 PayPal에는 사용하지 않음
      await startSheetPurchase({
        userId: user.id,
        items: [{ sheetId: sheet.id, sheetTitle: sheet.title, price }],
        amount: price,
        paymentMethod: 'paypal',
        description: t('categoriesPage.purchaseDescription', { title: sheet.title }),
        buyerName: user.email ?? null,
        buyerEmail: user.email ?? null,
        elementId, // PayPal SPB 렌더링을 위한 컨테이너 ID 전달
      });
    },
    [user, pendingSheet, t]
  );

  const closePaymentSelector = useCallback(() => {
    setShowPaymentSelector(false);
    setPendingSheet(null);
  }, []);

  const closeBankTransferModal = useCallback(() => {
    setShowBankTransferModal(false);
    if (!bankTransferInfo) {
      // 주문이 생성되지 않았으면 결제수단 선택 모달로 돌아가기
      setShowPaymentSelector(true);
    } else {
      // 주문이 생성되었으면 상태 초기화
      setPendingSheet(null);
      setBankTransferInfo(null);
    }
  }, [bankTransferInfo]);

  const closePayPalModal = useCallback(() => {
    setShowPayPalModal(false);
    setPendingSheet(null);
  }, []);

  return {
    // State
    showPaymentSelector,
    showBankTransferModal,
    showPayPalModal,
    bankTransferInfo,
    paymentProcessing,
    pendingSheet,

    // Actions
    handleBuyNow,
    handlePaymentMethodSelect,
    handleBankTransferConfirm,
    handlePayPalInitiate,

    // Setters
    closePaymentSelector,
    closeBankTransferModal,
    closePayPalModal,
  };
}

