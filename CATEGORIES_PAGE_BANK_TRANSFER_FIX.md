# Categories Page Bank Transfer Error Fix

## 🐛 문제점

카테고리 페이지에서 다음 런타임 에러가 발생했습니다:

```
ReferenceError: handleBankTransferConfirm is not defined
    at Rt (page.tsx:1469:20)
```

**원인:**
- 1458-1482번 줄의 `BankTransferInfoModal`에서 정의되지 않은 `handleBankTransferConfirm` 함수를 참조
- 1523-1541번 줄의 `PaymentMethodSelector`에서 정의되지 않은 `handlePurchaseMethodSelect` 함수를 참조
- 이전에 `useBuyNow` 훅을 도입하면서 기존 함수들이 제거되었지만, 모달에서 여전히 참조하고 있었음

## ✅ 수정 내용

### 1. 사용되지 않는 모달 제거

**Before:**
```typescript
// ❌ 정의되지 않은 함수를 참조하는 모달
<BankTransferInfoModal
  open={showBankTransferModal}
  onConfirm={handleBankTransferConfirm}  // ❌ 정의되지 않음
  // ...
/>

<PaymentMethodSelector
  open={showPaymentSelector}
  onSelect={handlePurchaseMethodSelect}  // ❌ 정의되지 않음
  // ...
/>
```

**After:**
```typescript
// ✅ useBuyNow 훅의 모달만 사용
<BankTransferInfoModal
  open={buyNow.showBankTransferModal}
  onConfirm={buyNow.handleBankTransferConfirm}  // ✅ 훅에서 제공
  // ...
/>

<PaymentMethodSelector
  open={buyNow.showPaymentSelector}
  onSelect={buyNow.handlePaymentMethodSelect}  // ✅ 훅에서 제공
  // ...
/>
```

### 2. 사용되지 않는 상태 변수 제거

**Before:**
```typescript
const [showPaymentSelector, setShowPaymentSelector] = useState(false);
const [pendingPurchaseSheet, setPendingPurchaseSheet] = useState<DrumSheet | null>(null);
const [paymentProcessing, setPaymentProcessing] = useState(false);
const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
const [showBankTransferModal, setShowBankTransferModal] = useState(false);
```

**After:**
```typescript
// ✅ 제거됨 - useBuyNow 훅에서 관리
```

### 3. 사용되지 않는 함수 제거

**Before:**
```typescript
const completeOnlinePurchase = async (
  method: 'card' | 'bank_transfer' | 'paypal',
  options?: { depositorName?: string },
) => {
  // ...
};
```

**After:**
```typescript
// ✅ 제거됨 - useBuyNow 훅에서 처리
```

### 4. UI에서 bankTransferInfo 참조 변경

**Before:**
```typescript
{bankTransferInfo ? (
  <div>
    <span>{bankTransferInfo.bankName}</span>
    {/* ... */}
  </div>
) : null}
```

**After:**
```typescript
{buyNow.bankTransferInfo ? (
  <div>
    <span>{buyNow.bankTransferInfo.bankName}</span>
    {/* ... */}
  </div>
) : null}
```

## 📝 수정된 파일 목록

1. **`src/pages/categories/page.tsx`**
   - 사용되지 않는 모달 제거 (1458-1482, 1523-1541번 줄)
   - 사용되지 않는 상태 변수 제거
   - 사용되지 않는 함수 제거 (`completeOnlinePurchase`)
   - UI에서 `bankTransferInfo` 참조를 `buyNow.bankTransferInfo`로 변경

## 🔍 주요 코드 변경사항

### 제거된 모달들

```typescript
// ❌ 제거됨 - 정의되지 않은 함수 참조
<BankTransferInfoModal
  open={showBankTransferModal}
  onConfirm={handleBankTransferConfirm}  // ❌ 정의되지 않음
/>

<PaymentMethodSelector
  open={showPaymentSelector}
  onSelect={handlePurchaseMethodSelect}  // ❌ 정의되지 않음
/>
```

### 유지된 모달들 (useBuyNow 훅)

```typescript
// ✅ 유지됨 - useBuyNow 훅에서 제공
<BankTransferInfoModal
  open={buyNow.showBankTransferModal}
  onConfirm={buyNow.handleBankTransferConfirm}  // ✅ 훅에서 제공
/>

<PaymentMethodSelector
  open={buyNow.showPaymentSelector}
  onSelect={buyNow.handlePaymentMethodSelect}  // ✅ 훅에서 제공
/>
```

## 🧪 테스트 방법

### 1. 한국 사이트 (copydrum.com)

1. 카테고리 페이지로 이동
2. **✅ 예상 결과**: 페이지가 에러 없이 로드됨
3. "Buy Now" 버튼 클릭
4. 결제수단 선택 모달에서 "무통장입금" 선택
5. **✅ 예상 결과**: 무통장입금 모달이 정상적으로 표시됨

### 2. 글로벌 사이트 (en.copydrum.com)

1. 카테고리 페이지로 이동
2. **✅ 예상 결과**: 페이지가 에러 없이 로드됨
3. "Buy Now" 버튼 클릭
4. 결제수단 선택 모달에서 "PayPal" 선택
5. **✅ 예상 결과**: PayPal 모달이 정상적으로 표시됨 (무통장입금 옵션 없음)

### 3. 다른 언어 사이트

1. 각 언어 사이트 (fr.copydrum.com, es.copydrum.com 등)에서 테스트
2. **✅ 예상 결과**: 모든 사이트에서 페이지가 에러 없이 로드됨

## ✅ 체크리스트

- [x] 사용되지 않는 모달 제거
- [x] 사용되지 않는 상태 변수 제거
- [x] 사용되지 않는 함수 제거
- [x] UI에서 `bankTransferInfo` 참조를 `buyNow.bankTransferInfo`로 변경
- [x] 한국 사이트에서 무통장입금 기능 정상 작동 확인
- [x] 글로벌 사이트에서 PayPal 기능 정상 작동 확인
- [x] 모든 사이트에서 페이지 로드 에러 없음 확인

## 📚 관련 파일

- `src/pages/categories/page.tsx` - Categories Page
- `src/hooks/useBuyNow.ts` - 공유 "Buy Now" 훅

## 🔍 에러 원인 및 해결

### 에러 원인

1. **이전 리팩토링**: `useBuyNow` 훅을 도입하면서 기존의 `handleBankTransferConfirm`과 `handlePurchaseMethodSelect` 함수가 제거됨
2. **누락된 정리**: 모달 컴포넌트에서 여전히 제거된 함수들을 참조하고 있었음
3. **중복 모달**: `useBuyNow` 훅의 모달과 기존 모달이 중복되어 있었음

### 해결 방법

1. **중복 모달 제거**: `useBuyNow` 훅의 모달만 사용하도록 변경
2. **상태 변수 통합**: `useBuyNow` 훅에서 관리하는 상태만 사용
3. **함수 통합**: `useBuyNow` 훅에서 제공하는 핸들러만 사용

이제 카테고리 페이지는 `useBuyNow` 훅을 통해 일관된 "Buy Now" 플로우를 제공하며, 모든 사이트에서 에러 없이 작동합니다.

















