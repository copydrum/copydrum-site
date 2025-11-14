import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useAuthStore } from '../../stores/authStore';
import { processCashPurchase } from '../../lib/cashPurchases';
import { splitPurchasedSheetIds } from '../../lib/purchaseCheck';
import { BankTransferInfoModal, PaymentMethodSelector } from '../../components/payments';
import { startSheetPurchase } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { openCashChargeModal } from '../../lib/cashChargeModal';
import { useTranslation } from 'react-i18next';
import { formatPrice as formatPriceWithCurrency } from '../../lib/priceFormatter';

type PendingCartPurchase = {
  targetItemIds: string[];
  items: Array<{
    sheetId: string;
    sheetTitle: string;
    price: number;
  }>;
  amount: number;
  description: string;
};

export default function CartPage() {
  const { cartItems, loading, removeFromCart, removeSelectedItems, clearCart, getTotalPrice } = useCart();
  const { user } = useAuthStore();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingCartPurchase | null>(null);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const formatPriceValue = useCallback(
    (price: number) => formatPriceWithCurrency({ amountKRW: price, language: i18n.language }).formatted,
    [i18n.language],
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600">장바구니를 확인하려면 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleSelectAll = () => {
    if (selectedItems.length === cartItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map(item => item.id));
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleRemoveSelected = async () => {
    if (selectedItems.length === 0) {
      alert('삭제할 상품을 선택해주세요.');
      return;
    }

    if (confirm(`선택한 ${selectedItems.length}개 상품을 삭제하시겠습니까?`)) {
      const success = await removeSelectedItems(selectedItems);
      if (success) {
        setSelectedItems([]);
      }
    }
  };

  const handleClearCart = async () => {
    if (cartItems.length === 0) return;

    if (confirm('장바구니를 전체 비우시겠습니까?')) {
      const success = await clearCart();
      if (success) {
        setSelectedItems([]);
      }
    }
  };

  const handlePurchase = async (itemIds: string[]) => {
    if (processing) return;
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (itemIds.length === 0) {
      alert('구매할 상품을 선택해주세요.');
      return;
    }

    let targetItemIds = [...itemIds];
    const itemsToPurchase = cartItems.filter(item => targetItemIds.includes(item.id));
    if (itemsToPurchase.length === 0) {
      alert('선택한 상품 정보를 찾을 수 없습니다.');
      return;
    }

    let filteredItems = itemsToPurchase;

    try {
      const sheetIds = itemsToPurchase.map(item => item.sheet_id);
      const { purchasedSheetIds, notPurchasedSheetIds } = await splitPurchasedSheetIds(user.id, sheetIds);

      if (purchasedSheetIds.length > 0) {
        const duplicateItems = itemsToPurchase.filter(item => purchasedSheetIds.includes(item.sheet_id));

        if (notPurchasedSheetIds.length === 0) {
          const duplicateList =
            duplicateItems.length > 0
              ? duplicateItems.map(item => `- ${item.title}`).join('\n')
              : purchasedSheetIds.map(id => `- ${id}`).join('\n');
          alert(
            ['이미 구매하신 악보만 선택되어 결제를 진행할 수 없습니다.', '', '중복된 악보:', duplicateList].join('\n'),
          );
          return;
        }

        filteredItems = itemsToPurchase.filter(item => notPurchasedSheetIds.includes(item.sheet_id));
        targetItemIds = filteredItems.map(item => item.id);

        const duplicateList =
          duplicateItems.length > 0
            ? duplicateItems.map(item => `- ${item.title}`).join('\n')
            : purchasedSheetIds.map(id => `- ${id}`).join('\n');

        alert(
          [
            '이미 구매하신 악보를 제외하고 결제를 진행합니다.',
            '',
            '제외된 악보:',
            duplicateList,
          ].join('\n'),
        );
      }
    } catch (error) {
      console.error('장바구니 구매 전 구매 이력 확인 오류:', error);
      alert('구매 이력 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (filteredItems.length === 0) {
      alert('구매할 수 있는 신규 악보가 없습니다.');
      return;
    }

    const totalPrice = filteredItems.reduce((total, item) => total + item.price, 0);
    const description =
      filteredItems.length === 1
        ? `악보 구매: ${filteredItems[0].title}`
        : `장바구니 상품 ${filteredItems.length}개 구매`;

    const purchaseItems = filteredItems.map(item => ({
      sheetId: item.sheet_id,
      sheetTitle: item.title,
      price: item.price,
    }));

    setPendingPurchase({
      targetItemIds,
      items: purchaseItems,
      amount: totalPrice,
      description,
    });
    setPaymentProcessing(false);
    setBankTransferInfo(null);
    setShowPaymentSelector(true);
  };

  const handlePurchaseSelected = async () => {
    await handlePurchase(selectedItems);
  };

  const handlePurchaseAll = async () => {
    const allItemIds = cartItems.map(item => item.id);
    await handlePurchase(allItemIds);
  };

  const completeOnlinePurchase = async (
    method: 'card' | 'bank_transfer',
    options?: { depositorName?: string },
  ) => {
    if (!user || !pendingPurchase) return;

    const purchaseResult = await startSheetPurchase({
      userId: user.id,
      items: pendingPurchase.items,
      amount: pendingPurchase.amount,
      paymentMethod: method,
      description: pendingPurchase.description,
      buyerName: user.email ?? null,
      buyerEmail: user.email ?? null,
      returnUrl: new URL('/payments/inicis/return', window.location.origin).toString(),
      depositorName: options?.depositorName,
    });

    const removed = await removeSelectedItems(pendingPurchase.targetItemIds);
    if (!removed) {
      console.warn('결제 후 장바구니 업데이트에 실패했습니다.');
    }

    setSelectedItems(prev =>
      prev.filter(id => !pendingPurchase.targetItemIds.includes(id)),
    );

    if (method === 'bank_transfer') {
      setBankTransferInfo(purchaseResult.virtualAccountInfo ?? null);
      alert('무통장입금 안내가 생성되었습니다.\n안내에 따라 입금 후 자동으로 구매가 완료됩니다.');
    } else {
      setBankTransferInfo(null);
      alert('결제창이 열립니다. 결제를 완료해 주세요.');
    }
  };

  const handlePaymentMethodSelect = async (method: 'cash' | 'card' | 'bank') => {
    if (!user || !pendingPurchase) return;

    setShowPaymentSelector(false);

    if (method === 'bank') {
      setShowBankTransferModal(true);
      return;
    }

    setProcessing(true);
    setPaymentProcessing(true);

    try {
      if (method === 'cash') {
        const cashResult = await processCashPurchase({
          userId: user.id,
          totalPrice: pendingPurchase.amount,
          description: pendingPurchase.description,
          items: pendingPurchase.items,
          sheetIdForTransaction:
            pendingPurchase.items.length === 1 ? pendingPurchase.items[0].sheetId : null,
        });

        if (!cashResult.success) {
          if (cashResult.reason === 'INSUFFICIENT_CREDIT') {
            alert(
              `보유 캐쉬가 부족합니다.\n현재 잔액: ${cashResult.currentCredits.toLocaleString(
                'ko-KR',
              )}P\n캐쉬를 충전한 뒤 다시 시도해주세요.`,
            );
            openCashChargeModal();
          }
          return;
        }

        const removed = await removeSelectedItems(pendingPurchase.targetItemIds);
        if (!removed) {
          console.warn('구매 후 장바구니 업데이트에 실패했습니다.');
        }

        setSelectedItems(prev =>
          prev.filter(id => !pendingPurchase.targetItemIds.includes(id)),
        );

        alert('구매가 완료되었습니다. 마이페이지에서 콘텐츠를 확인하세요.');
        navigate('/my-orders');
        return;
      }

      await completeOnlinePurchase('card');
    } catch (error) {
      console.error('장바구니 결제 처리 오류:', error);
      alert(error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
      setPaymentProcessing(false);
      setPendingPurchase(null);
    }
  };

  const handleBankTransferConfirm = async (depositorName: string) => {
    if (!user || !pendingPurchase) return;

    setShowBankTransferModal(false);
    setProcessing(true);
    setPaymentProcessing(true);

    try {
      await completeOnlinePurchase('bank_transfer', { depositorName });
    } catch (error) {
      console.error('무통장입금 결제 처리 오류:', error);
      alert(error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
      setPaymentProcessing(false);
      setPendingPurchase(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {bankTransferInfo ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-blue-900">무통장입금 안내</h3>
              <button
                type="button"
                onClick={() => setBankTransferInfo(null)}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                닫기
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <span className="font-medium text-gray-900">은행</span> {bankTransferInfo.bankName}
              </div>
              <div>
                <span className="font-medium text-gray-900">계좌번호</span> {bankTransferInfo.accountNumber}
              </div>
              <div>
                <span className="font-medium text-gray-900">예금주</span> {bankTransferInfo.depositor}
              </div>
              <div>
                <span className="font-medium text-gray-900">입금금액</span>{' '}
                {formatPriceValue(bankTransferInfo.amount ?? 0)}
              </div>
              {bankTransferInfo.expectedDepositor ? (
                <div className="sm:col-span-2">
                  <span className="font-medium text-gray-900">입금자명</span>{' '}
                  <span className="text-blue-600 font-semibold">
                    {bankTransferInfo.expectedDepositor}
                  </span>
                </div>
              ) : null}
            </div>
            {bankTransferInfo.message ? (
              <p className="mt-3 text-xs text-gray-600">{bankTransferInfo.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">장바구니</h1>
            <p className="text-gray-600 mt-1">총 {cartItems.length}개 상품</p>
          </div>

          {cartItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-shopping-cart-line text-2xl text-gray-400"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">장바구니가 비어있습니다</h3>
              <p className="text-gray-600">원하는 악보를 장바구니에 담아보세요.</p>
              <button
                onClick={() => navigate('/categories')}
                className="mt-6 inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                악보 보러가기
              </button>
            </div>
          ) : (
            <>
              {/* 선택/삭제 컨트롤 */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === cartItems.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      전체선택 ({selectedItems.length}/{cartItems.length})
                    </span>
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRemoveSelected}
                    disabled={selectedItems.length === 0}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    선택삭제
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    전체삭제
                  </button>
                </div>
              </div>

              {/* 장바구니 아이템 목록 */}
              <div className="divide-y divide-gray-200">
                {cartItems.map((item) => (
                  <div key={item.id} className="p-6 flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <i className="ri-music-2-line text-2xl text-white"></i>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.artist}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatPriceValue(item.price)}</p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                ))}
              </div>

              {/* 결제 정보 */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium text-gray-900">
                    선택상품 ({selectedItems.length}개)
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatPriceValue(getTotalPrice(selectedItems))}
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handlePurchaseSelected}
                    disabled={selectedItems.length === 0 || processing || paymentProcessing}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing || paymentProcessing ? '구매 처리 중...' : '선택상품 주문하기'}
                  </button>
                  <button
                    onClick={handlePurchaseAll}
                    disabled={cartItems.length === 0 || processing || paymentProcessing}
                    className="flex-1 bg-gray-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing || paymentProcessing ? '구매 처리 중...' : '전체상품 주문하기'}
                  </button>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => navigate('/categories')}
                    className="w-full py-3 px-6 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    쇼핑 계속하기
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <BankTransferInfoModal
          open={showBankTransferModal}
          amount={pendingPurchase?.amount ?? 0}
          userName={(user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined}
          onConfirm={handleBankTransferConfirm}
          onClose={() => {
            setShowBankTransferModal(false);
            setShowPaymentSelector(true);
          }}
        />

        <PaymentMethodSelector
          open={showPaymentSelector}
          amount={pendingPurchase?.amount ?? 0}
          onClose={() => {
            setShowPaymentSelector(false);
            setPendingPurchase(null);
            setPaymentProcessing(false);
          }}
          onSelect={handlePaymentMethodSelect}
        />
      </div>
    </div>
  );
}