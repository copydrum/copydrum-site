# 카카오페이 결제 시스템 통합 완료 보고서

## 개요

PortOne V2 SDK를 사용하여 카카오페이 결제 수단을 한국어 사이트에 추가했습니다. PayPal 결제와 동일하게 Supabase Edge Function을 통해 결제 완료 후 주문이 자동으로 업데이트되도록 구성했습니다.

## 수정된 파일 목록

### 1. 결제 로직 파일

#### `src/lib/payments/portone.ts`
- **추가된 함수**: `requestKakaoPayPayment()`
- **추가된 인터페이스**: 
  - `RequestKakaoPayPaymentParams`
  - `RequestKakaoPayPaymentResult`
- **주요 기능**:
  - 한국어 사이트에서만 동작하도록 체크
  - PortOne V2 SDK의 `loadPaymentUI` 사용
  - 카카오페이 전용 설정 (uiType: 'CHECKOUT', paymentMethod: { pgProvider: 'kakaopay', methodType: 'EASY_PAY' })
  - KRW 정수 금액 그대로 사용 (변환 불필요)

#### `src/lib/payments/productPurchase.ts`
- **변경사항**: 
  - `PurchaseMethod` 타입에 `'kakaopay'` 추가
  - `startSheetPurchase()` 함수에 카카오페이 결제 처리 로직 추가
  - `requestKakaoPayPayment()` import 추가

#### `src/lib/payments/cashCharge.ts`
- **변경사항**:
  - `SupportedChargeMethod` 타입에 `'kakaopay'` 추가
  - `startCashCharge()` 함수에 카카오페이 결제 처리 로직 추가
  - `requestKakaoPayPayment()` import 추가

### 2. UI 컴포넌트 파일

#### `src/components/payments/PaymentMethodSelector.tsx`
- **변경사항**:
  - `PaymentMethod` 타입에 `'kakaopay'` 추가
  - `getAvailablePaymentMethods()` 함수에서 한국어 사이트일 때 카카오페이 옵션 추가
  - 카카오페이 아이콘: `ri-kakao-talk-line`, 색상: `text-yellow-500`

#### `src/components/payments/PointChargeModal.tsx`
- **변경사항**:
  - 한국어 사이트에서 카카오페이 결제 수단 추가
  - `handleChargeConfirm()` 함수에 카카오페이 처리 로직 추가

### 3. 페이지 파일

#### `src/hooks/useBuyNow.ts`
- **변경사항**:
  - `requestKakaoPayPayment()` import 추가
  - `handlePaymentMethodSelect()` 함수에 카카오페이 처리 로직 추가
  - 주문 생성 후 카카오페이 결제 호출

#### `src/pages/sheet-detail/page.tsx`
- **변경사항**:
  - `handlePaymentMethodSelect()` 함수에 카카오페이 처리 로직 추가
  - 카카오페이 선택 시 주문 생성 및 결제 시작

#### `src/pages/cart/page.tsx`
- **변경사항**:
  - `completeOnlinePurchase()` 함수 타입에 `'kakaopay'` 추가
  - `handlePaymentMethodSelect()` 함수에 카카오페이 처리 로직 추가

### 4. Webhook 처리 파일

#### `supabase/functions/portone-payment-confirm/index.ts`
- **변경사항**:
  - 카카오페이 채널 확인 로직 추가 (`isKakaoPayPayment`)
  - `loggedProvider` 로그 추가로 카카오페이 결제 확인 가능
  - PayPal과 동일하게 결제 검증 및 주문 업데이트 처리

#### `src/config/hostType.ts`
- **변경사항**: 없음 (기존 `isKoreanSiteHost()` 함수 사용)

## 함수 시그니처

### `requestKakaoPayPayment()`

```typescript
export const requestKakaoPayPayment = async (
  params: RequestKakaoPayPaymentParams,
): Promise<RequestKakaoPayPaymentResult>

interface RequestKakaoPayPaymentParams {
  userId: string; // 사용자 ID (필수)
  amount: number; // KRW 금액 (이미 KRW 정수 금액, 변환 불필요)
  orderId: string; // 주문 ID (merchant_uid로 사용)
  buyerEmail?: string;
  buyerName?: string;
  buyerTel?: string;
  description: string; // 상품명
  returnUrl?: string; // 결제 완료 후 리다이렉트 URL
  onSuccess?: (response: any) => void; // 결제 성공 콜백
  onError?: (error: any) => void; // 결제 실패 콜백
}
```

## 카카오페이 옵션 노출 위치

### 1. 바로구매 (Sheet Detail Page / Categories Page)
- **파일**: `src/pages/sheet-detail/page.tsx`, `src/pages/categories/page.tsx`
- **컴포넌트**: `PaymentMethodSelector` 사용
- **노출 조건**: 한국어 사이트 (KRW)에서만 표시
- **순서**: 무통장 입금 → **카카오페이** → 포인트 결제 (포인트가 있을 때만)

### 2. 장바구니 결제
- **파일**: `src/pages/cart/page.tsx`
- **컴포넌트**: `PaymentMethodSelector` 사용
- **노출 조건**: 한국어 사이트 (KRW)에서만 표시

### 3. 포인트 충전
- **파일**: `src/components/payments/PointChargeModal.tsx`
- **노출 조건**: 한국어 사이트 (KRW)에서만 표시
- **순서**: 무통장 입금 → **카카오페이**

## Webhook 처리 확인 방법

### 1. 포인트 충전 확인 로그

카카오페이 결제가 들어왔을 때 `portone-payment-confirm` 함수 로그에서 다음을 확인할 수 있습니다:

```javascript
{
  "channelKey": "...",
  "loggedProvider": "kakaopay",  // ← 카카오페이 확인
  "isPayPalPayment": false,
  "isKakaoPayPayment": true,      // ← 카카오페이 확인
  "metadata": { ... }
}
```

### 2. 로그 확인 위치

1. **Supabase Dashboard**:
   - Edge Functions → `portone-payment-confirm` → Logs
   - Edge Functions → `portone-webhook` → Logs

2. **콘솔 로그**:
   - `[portone-kakaopay]` prefix가 붙은 모든 로그
   - `[portone-payment-confirm]` 로그에서 `isKakaoPayPayment: true` 확인

### 3. 결제 플로우

1. 사용자가 카카오페이 선택
2. 주문 생성 (`orders` 테이블에 'pending' 상태로 생성)
3. `requestKakaoPayPayment()` 호출
4. PortOne 카카오페이 결제창 열림
5. 사용자가 카카오페이로 결제
6. PortOne에서 Webhook 전송 → `portone-webhook` 함수
7. `portone-payment-confirm` 함수로 결제 검증
8. `orders` 테이블 업데이트 ('completed' / 'paid' 상태로 변경)

## 환경 변수 설정

### 필수 환경 변수

`.env` 파일에 다음 변수 추가:

```env
VITE_PORTONE_CHANNEL_KEY_KAKAOPAY=channel-key-bdbeb668-e452-413b-a039-150013d1f3ae
```

기존에 사용 중인 변수 (변경 불필요):
```env
VITE_PORTONE_STORE_ID=store-21731740-b1df-492c-832a-8f38448d0ebd
```

### Supabase Edge Functions Secrets

Webhook 및 결제 확인 함수가 사용하는 환경 변수는 Supabase Dashboard에서 자동으로 설정됩니다:
- `SUPABASE_URL` (자동 설정)
- `SUPABASE_SERVICE_ROLE_KEY` (자동 설정)
- `PORTONE_API_KEY` (필수, 수동 설정 필요)

## 보안 및 안전장치

### 1. 한국어 사이트 전용

```typescript
// requestKakaoPayPayment() 함수 내부
if (!isKoreanSite) {
  return {
    success: false,
    error_msg: 'KakaoPay is only available on the Korean site.',
  };
}
```

### 2. 로깅

모든 카카오페이 관련 로그에 `[portone-kakaopay]` prefix 사용:
- `[portone-kakaopay] KakaoPay 결제 요청 시작`
- `[portone-kakaopay] loadPaymentUI requestData`
- `[portone-kakaopay] onPaymentSuccess`
- `[portone-kakaopay] onPaymentFail`

### 3. 에러 처리

- 환경 변수 누락 시 명확한 에러 메시지
- 한국어 사이트가 아닐 경우 에러 반환
- 결제 실패 시 사용자에게 알림

## 테스트 방법

### 1. 로컬 테스트

1. `.env` 파일에 `VITE_PORTONE_CHANNEL_KEY_KAKAOPAY` 추가
2. 개발 서버 실행
3. 한국어 사이트(`localhost` 또는 `copydrum.com`)에서 테스트
4. 결제 수단 선택 시 카카오페이 옵션 확인
5. 카카오페이 선택 후 결제창이 정상적으로 열리는지 확인

### 2. 프로덕션 테스트

1. 환경 변수 배포 (Vercel 환경 변수 설정)
2. 한국어 사이트에서 실제 결제 테스트
3. Supabase Dashboard에서 Webhook 로그 확인
4. `portone-payment-confirm` 로그에서 카카오페이 결제 확인
5. `orders` 테이블에서 주문 상태가 'completed' / 'paid'로 변경되었는지 확인

## 주의사항

1. **글로벌 사이트에서 카카오페이 노출 안 됨**
   - `isKoreanSiteHost()` 체크로 다른 언어 사이트에서는 절대 표시되지 않음
   - 코드에서도 한국어 사이트 체크 후 에러 반환

2. **기존 PayPal 코드 영향 없음**
   - PayPal 관련 코드는 전혀 수정하지 않음
   - 타입 및 유틸만 공통으로 사용

3. **Webhook 공통 사용**
   - 카카오페이 전용 Webhook 엔드포인트 없음
   - 기존 `portone-webhook` / `portone-payment-confirm` 함수 사용
   - `isKakaoPayPayment` 플래그로 로그 확인 가능

## 향후 개선 사항

1. **번역 키 추가**
   - `payment.kakaopay`
   - `payment.kakaopayDescription`
   - 현재는 fallback 텍스트 사용 중

2. **카카오페이 전용 Return 페이지** (선택사항)
   - 현재는 PortOne PayPal return 페이지 재사용
   - 필요 시 별도 페이지 생성 가능

3. **모바일 최적화**
   - 모바일에서 카카오페이 결제 UX 개선 가능

## 참고 문서

- [PortOne V2 통합 가이드](https://developers.portone.io/opi/ko/integration/start/v2/checkout?v=v2)
- [PortOne 카카오페이 연동 가이드](https://developers.portone.io/opi/ko/integration/pg/v2/kakaopay?v=v2)
- [PortOne Webhook 문서](https://developers.portone.io/opi/ko/integration/webhook/readme-v2?v=v2)





