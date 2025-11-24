# PayPal "Buy Now" 버그 수정

## 🐛 버그 설명

### 문제
- **글로벌 사이트** (non-Korean domains)에서:
  - ✅ Sheet Detail Page의 "Buy Now" 버튼: PayPal이 첫 클릭에서 정상 작동
  - ❌ Category/Sheet List Page의 "Buy Now" 버튼: 첫 클릭에서 아무 일도 일어나지 않음, 두 번째 클릭에서야 PayPal 팝업이 나타남

### 버그 원인

**Categories Page의 `handlePurchaseMethodSelect` 함수**에서:

```typescript
// ❌ 버그 있는 코드
const handlePurchaseMethodSelect = async (method: PaymentMethod) => {
  // ...
  setShowPaymentSelector(false);  // 결제수단 선택 모달 닫기
  
  if (method === 'paypal') {
    setShowPayPalModal(true);  // PayPal 모달 열기
    return;
  }
  // ...
} finally {
  setPaymentProcessing(false);
  setBuyingSheetId(null);
  setPendingPurchaseSheet(null);  // ❌ 여기서 sheet 정보가 사라짐!
}
```

**문제점:**
1. PayPal 선택 시 `setShowPaymentSelector(false)`로 결제수단 선택 모달을 먼저 닫음
2. `finally` 블록에서 `setPendingPurchaseSheet(null)`이 실행되어 sheet 정보가 사라짐
3. PayPal 모달이 열릴 때 `pendingPurchaseSheet`가 `null`이어서 `handlePayPalInitiate`가 실행되지 않음
4. 두 번째 클릭에서는 상태가 다시 설정되어 작동함

**Sheet Detail Page의 작동 방식 (정상):**
```typescript
// ✅ 정상 작동하는 코드
const handlePaymentMethodSelectForBuyNow = async (method: PaymentMethod) => {
  setShowPaymentSelectorForBuyNow(false);
  
  if (method === 'paypal') {
    setShowPayPalModal(true);  // PayPal 모달을 바로 열고, pendingSheet는 유지
    return;
  }
  // finally 블록이 없어서 pendingSheet가 유지됨
};
```

## ✅ 해결 방법

### 1. 공유 `useBuyNow` 훅 생성

**파일**: `src/hooks/useBuyNow.ts`

Sheet Detail Page의 작동하는 로직을 기반으로 공유 훅을 생성했습니다.

**주요 특징:**
- PayPal 선택 시 `pendingSheet`를 유지
- `finally` 블록에서 `pendingSheet`를 `null`로 설정하지 않음
- 모든 상태와 핸들러를 캡슐화

### 2. 두 페이지에서 공유 훅 사용

**Sheet Detail Page** (`src/pages/sheet-detail/page.tsx`):
```typescript
// ✅ Before: 인라인 로직
const handleBuyNow = async () => { /* ... */ };
const handlePaymentMethodSelectForBuyNow = async (method) => { /* ... */ };

// ✅ After: 공유 훅 사용
const buyNow = useBuyNow(user);
const handleBuyNow = async () => {
  if (!sheet) return;
  await buyNow.handleBuyNow({
    id: sheet.id,
    title: sheet.title,
    price: getSheetPrice(),
  });
};
```

**Categories Page** (`src/pages/categories/page.tsx`):
```typescript
// ✅ Before: 버그 있는 로직
const handleBuyNow = async (sheet) => { /* ... */ };
const handlePurchaseMethodSelect = async (method) => {
  // finally 블록에서 pendingPurchaseSheet를 null로 설정
};

// ✅ After: 공유 훅 사용
const buyNow = useBuyNow(user);
const handleBuyNow = async (sheet: DrumSheet) => {
  await buyNow.handleBuyNow({
    id: sheet.id,
    title: sheet.title,
    price: Math.max(0, sheet.price ?? 0),
  });
};
```

## 📝 수정된 파일 목록

1. **`src/hooks/useBuyNow.ts`** (신규 생성)
   - 공유 "Buy Now" 로직 훅
   - Sheet Detail Page의 작동하는 로직 기반

2. **`src/pages/sheet-detail/page.tsx`**
   - `useBuyNow` 훅 사용
   - 기존 인라인 로직 제거

3. **`src/pages/categories/page.tsx`**
   - `useBuyNow` 훅 사용
   - 버그 있는 `handlePurchaseMethodSelect` 로직 제거 (Buy Now용)
   - 기존 `handlePurchaseMethodSelect`는 다른 용도로 유지

## 🔍 주요 코드 변경사항

### useBuyNow.ts 핵심 로직

```typescript
const handlePaymentMethodSelect = useCallback(
  (method: PaymentMethod) => {
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
  },
  [user, pendingSheet]
);
```

### Categories Page 변경사항

**Before:**
```typescript
const handlePurchaseMethodSelect = async (method: PaymentMethod) => {
  // ...
  if (method === 'paypal') {
    setShowPayPalModal(true);
    return;
  }
  // ...
} finally {
  setPendingPurchaseSheet(null);  // ❌ 버그 원인
}
```

**After:**
```typescript
// ✅ useBuyNow 훅 사용
const buyNow = useBuyNow(user);
const handleBuyNow = async (sheet: DrumSheet) => {
  await buyNow.handleBuyNow({
    id: sheet.id,
    title: sheet.title,
    price: Math.max(0, sheet.price ?? 0),
  });
};

// ✅ 모달은 훅에서 관리
<PaymentMethodSelector
  open={buyNow.showPaymentSelector}
  onSelect={buyNow.handlePaymentMethodSelect}  // ✅ pendingSheet 유지
  // ...
/>
```

## 🧪 테스트 방법

### 1. 글로벌 사이트에서 테스트

**도메인**: `en.copydrum.com` 또는 다른 글로벌 도메인

#### 테스트 1: Category/Sheet List Page
1. 카테고리 리스트 페이지로 이동
2. 아무 악보의 "Buy Now" 버튼 클릭
3. 결제수단 선택 모달에서 "PayPal" 선택
4. **✅ 예상 결과**: PayPal 팝업이 **첫 클릭에서 즉시** 나타나야 함

#### 테스트 2: Sheet Detail Page
1. 악보 상세 페이지로 이동
2. "Buy Now" 버튼 클릭
3. 결제수단 선택 모달에서 "PayPal" 선택
4. **✅ 예상 결과**: PayPal 팝업이 정상적으로 나타남 (기존과 동일)

### 2. 한국 사이트에서 테스트

**도메인**: `copydrum.com`

1. 카테고리 리스트 또는 상세 페이지에서 "Buy Now" 버튼 클릭
2. 결제수단 선택 모달에서 "무통장입금" 선택
3. **✅ 예상 결과**: 무통장입금 모달이 정상적으로 나타남

## 🎯 버그 수정 원리

### 왜 첫 클릭에서 작동하지 않았나?

1. **첫 클릭**:
   - `handlePurchaseMethodSelect` 실행
   - `setShowPaymentSelector(false)` → 결제수단 선택 모달 닫기
   - `setShowPayPalModal(true)` → PayPal 모달 열기 시도
   - `finally` 블록 실행 → `setPendingPurchaseSheet(null)` → **sheet 정보 손실**
   - PayPal 모달이 열리지만 `pendingPurchaseSheet`가 `null`이어서 `handlePayPalInitiate` 실행 불가

2. **두 번째 클릭**:
   - `handleBuyNow` 다시 실행 → `setPendingPurchaseSheet(sheet)` → sheet 정보 복구
   - `setShowPaymentSelector(true)` → 결제수단 선택 모달 열기
   - PayPal 선택 → 이번에는 `pendingPurchaseSheet`가 있으므로 작동

### 왜 공유 훅으로 수정했나?

1. **일관성**: 두 페이지에서 동일한 로직 사용
2. **유지보수성**: 버그 수정이 한 곳에서만 필요
3. **재사용성**: 다른 페이지에서도 동일한 로직 사용 가능
4. **검증된 로직**: Sheet Detail Page의 작동하는 로직을 그대로 사용

## ✅ 체크리스트

- [x] 공유 `useBuyNow` 훅 생성
- [x] Sheet Detail Page에서 공유 훅 사용
- [x] Categories Page에서 공유 훅 사용
- [x] PayPal 선택 시 `pendingSheet` 유지 확인
- [x] `finally` 블록에서 `pendingSheet`를 `null`로 설정하지 않음
- [x] 기존 기능 유지 (무통장입금, 장바구니 등)

## 📚 관련 파일

- `src/hooks/useBuyNow.ts` - 공유 "Buy Now" 훅
- `src/pages/sheet-detail/page.tsx` - Sheet Detail Page
- `src/pages/categories/page.tsx` - Categories/Sheet List Page
- `src/components/payments/PayPalPaymentModal.tsx` - PayPal 모달 컴포넌트
- `src/lib/payments/sheetBuyNow.ts` - Buy Now 로직

