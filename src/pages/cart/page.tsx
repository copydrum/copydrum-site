import { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { useAuthStore } from '../../stores/authStore';

export default function CartPage() {
  const { cartItems, loading, removeFromCart, removeSelectedItems, clearCart, getTotalPrice } = useCart();
  const { user } = useAuthStore();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
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
                      <p className="text-lg font-bold text-gray-900">{formatPrice(item.price)}원</p>
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
                    {formatPrice(getTotalPrice(selectedItems))}원
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    disabled={selectedItems.length === 0}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    선택상품 주문하기
                  </button>
                  <button
                    disabled={cartItems.length === 0}
                    className="flex-1 bg-gray-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    전체상품 주문하기
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}