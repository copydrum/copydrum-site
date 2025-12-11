# 결제 시스템 정리 작업 요약

## 작업 일자
2024년 (작업 완료 시점)

## 작업 목표
포트원 결제 심사 진행 중인 상황에서, 한국 사이트는 무통장 입금만, 영문 사이트는 PayPal만 사용하도록 UI와 로직을 정리하고, 과거 페이액션/이니시스 관련 코드를 정리했습니다.

---

## 1. UI에서 결제수단 노출 정리

### 변경 사항
- **한국 사이트 (copydrum.com)**: 무통장 입금만 표시
- **영문 사이트 (en.copydrum.com)**: PayPal만 표시
- 카드, 카카오페이 등 다른 결제수단은 UI에서 완전히 숨김 처리

### 수정된 파일
1. **`src/components/payments/PaymentMethodSelector.tsx`**
   - 한국 사이트: `bank` (무통장 입금)만 표시
   - 영문 사이트: `paypal`만 표시

2. **`src/components/mobile/MobileCashChargeModal.tsx`**
   - 한국 사이트: `bank`만 표시
   - 영문 사이트: `paypal`만 표시
   - 카드 결제 로직 주석 처리

3. **`src/components/feature/UserSidebar.tsx`**
   - 한국 사이트: `bank`만 표시
   - 영문 사이트: `paypal`만 표시
   - 카드/카카오페이 로직 주석 처리

4. **`src/pages/mypage/page.tsx`**
   - 한국 사이트: `bank`만 표시
   - 영문 사이트: `paypal`만 표시
   - 카드/카카오페이 로직 주석 처리

5. **`src/pages/cart/page.tsx`**
   - 카드 결제 호출 부분 주석 처리
   - 한국 사이트에서는 무통장 입금만 가능하도록 알림 추가

### 사이트 구분 방식
- `isEnglishHost()` 함수를 사용하여 `window.location.host`를 확인
- `en.copydrum.com` 또는 `.en.copydrum.com` 도메인인 경우 영문 사이트로 판단

---

## 2. 무통장 입금 수동 처리 플로우 점검 및 보완

### 고객 플로우
1. **바로구매/캐시 충전 시**
   - 사용자가 "무통장 입금" 선택
   - 주문 레코드 생성
   - `payment_method = 'bank_transfer'`
   - `payment_status = 'awaiting_deposit'`로 저장
   - 고정 계좌 정보 표시 (농협 106-02-303742, 강만수)

2. **입금자명 입력**
   - 무통장 입금 선택 시 입금자명 입력 모달 표시
   - 입금자명은 `depositor_name` 필드에 저장

### 관리자 플로우
1. **입금 확인 버튼**
   - 관리자 패널에서 각 주문/캐시충전 건의 "입금 확인" 버튼 클릭
   - `handleConfirmBankDeposit()` 함수 실행

2. **주문 완료 처리**
   - `completeOrderAfterPayment()` 공통 함수 호출
   - 주문 상태 업데이트:
     - `status = 'completed'`
     - `payment_status = 'paid'`
     - `payment_confirmed_at` 설정
   - 캐시 충전인 경우:
     - 사용자 캐시 잔액 증가 (`profiles.credits`)
     - `cash_transactions` 테이블에 거래 내역 기록
   - 악보 구매인 경우:
     - `purchases` 테이블에 구매 내역 기록 (다운로드 권한 활성화)

### 수정된 파일
- **`src/pages/admin/page.tsx`**
  - `handleConfirmBankDeposit()` 함수를 `completeOrderAfterPayment()` 공통 함수 사용하도록 리팩토링
  - 중복 코드 제거 및 로직 통합

---

## 3. 결제 완료 후처리 공통 함수 생성

### 새로 생성된 파일
**`src/lib/payments/completeOrderAfterPayment.ts`**

### 함수 설명
```typescript
completeOrderAfterPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
  options: CompleteOrderAfterPaymentOptions
): Promise<void>
```

### 기능
1. **주문 정보 조회 및 검증**
   - 주문 존재 여부 확인
   - 이미 결제 완료된 주문 중복 처리 방지

2. **캐시 충전 처리** (주문 타입이 `cash_charge`인 경우)
   - 사용자 캐시 잔액 증가
   - `cash_transactions` 테이블에 거래 내역 기록

3. **악보 구매 처리** (주문에 `order_items`가 있는 경우)
   - `purchases` 테이블에 구매 내역 기록

4. **주문 상태 업데이트**
   - `status = 'completed'`
   - `payment_status = 'paid'`
   - `payment_confirmed_at` 설정
   - `transaction_id` 설정

5. **결제 거래 로그 업데이트**
   - `payment_transactions` 테이블 업데이트

### 사용 예시
```typescript
// 관리자 수동 입금 확인
await completeOrderAfterPayment(orderId, 'bank_transfer', {
  transactionId: 'manual-1234567890',
  paymentConfirmedAt: new Date().toISOString(),
  depositorName: '홍길동',
  paymentProvider: 'manual',
});

// PayPal 성공 콜백 (향후 구현)
await completeOrderAfterPayment(orderId, 'paypal', {
  transactionId: 'portone-imp_1234567890',
  paymentProvider: 'portone',
});

// 포트원 카드/카카오페이 성공 콜백 (향후 구현)
await completeOrderAfterPayment(orderId, 'card', {
  transactionId: 'portone-imp_1234567890',
  paymentProvider: 'portone',
});
```

### 재사용 가능성
- 무통장 입금 확인 (관리자 수동)
- PayPal 성공 콜백
- 포트원 카드/카카오페이 성공 콜백 (향후)
- 모든 결제수단의 결제 완료 후처리를 통합 처리

---

## 4. 과거 페이액션/이니시스/PayPal 관련 코드 정리

### Legacy 코드 표시
과거에 사용했던 결제 시스템 관련 코드에 `legacy` 주석을 추가하고, 실제 실행 경로에서는 호출되지 않도록 비활성화했습니다.

### 수정된 파일

#### Edge Functions
1. **`supabase/functions/payments-payaction-webhook/index.ts`**
   - PayAction 자동입금 확인 시스템용
   - 현재 미사용 (관리자 수동 입금 확인으로 대체)
   - `@deprecated` 주석 추가

2. **`supabase/functions/payments-payaction-init/index.ts`**
   - PayAction 가상계좌 생성용
   - 현재 미사용
   - `@deprecated` 주석 추가

3. **`supabase/functions/payments-inicis-approve/index.ts`**
   - KG이니시스 직접 연동용
   - 현재 미사용 (포트원으로 전환 예정)
   - `@deprecated` 주석 추가

4. **`supabase/functions/payments-paypal-approve/index.ts`**
   - PayPal 직접 연동용
   - 현재 미사용 (포트원 PayPal로 대체됨)
   - `@deprecated` 주석 추가

#### 라이브러리 파일
1. **`src/lib/payments/payaction.ts`**
   - PayAction 자동입금 확인 시스템용 라이브러리
   - `@deprecated` 주석 추가

2. **`src/lib/payments/inicis.ts`**
   - KG이니시스 직접 연동 라이브러리
   - `@deprecated` 주석 추가

3. **`src/lib/payments/paymentService.ts`**
   - PayAction 관련 함수 호출 비활성화
   - 가상계좌 결제 시 에러 반환

4. **`src/lib/payments/productPurchase.ts`**
   - 카드 결제 로직 주석 처리 (포트원으로 전환 예정)
   - PayPal 직접 연동 코드 주석 처리

5. **`src/lib/payments/cashCharge.ts`**
   - 페이액션 연동 제거 주석 추가
   - 고정 계좌 정보 사용

### 정리 원칙
- **삭제하지 않음**: 나중에 다시 사용할 경우를 대비해 코드는 유지
- **주석 처리**: 실제 실행 경로에서는 호출되지 않도록 비활성화
- **명확한 표시**: `legacy`, `@deprecated` 주석으로 명시

---

## 5. 결제수단 타입 정의 보강 및 충돌 방지 설계

### 타입 정의 보강

#### `src/lib/payments/types.ts`

1. **`PaymentMethod` 타입**
   ```typescript
   export type PaymentMethod = 
     | 'bank_transfer'  // 무통장 입금 (한국 사이트 전용)
     | 'paypal'         // PayPal 결제 (영문 사이트 전용)
     | 'card'           // 신용카드 결제 (포트원 심사 진행 중, 현재 비활성화)
     | 'kakaopay'       // 카카오페이 (포트원 심사 진행 중, 현재 비활성화)
     | 'virtual_account' // 가상계좌 (legacy, 현재 미사용)
     | 'cash';          // 보유 캐시로 결제
   ```

2. **`PaymentProvider` 타입**
   ```typescript
   export type PaymentProvider = 
     | 'portone'   // 포트원 (PayPal, 카드, 카카오페이)
     | 'inicis'    // KG이니시스 (legacy, 현재 미사용)
     | 'payaction' // 페이액션 자동입금 확인 시스템 (legacy, 현재 미사용)
     | 'cash'      // 보유 캐시
     | 'manual';   // 관리자 수동 확인
   ```

3. **`PaymentStatus` 타입**
   ```typescript
   export type PaymentStatus = 
     | 'pending'          // 결제 대기
     | 'awaiting_deposit' // 입금 대기 (무통장 입금 전용)
     | 'paid'             // 결제 완료
     | 'failed'           // 결제 실패
     | 'cancelled'        // 취소됨
     | 'refunded';        // 환불 완료
   ```

### 충돌 방지 설계

1. **결제수단별 명확한 구분**
   - `bank_transfer`: 무통장 입금 (한국 사이트)
   - `paypal`: PayPal (영문 사이트)
   - `card`, `kakaopay`: 향후 포트원으로 추가 예정

2. **주문 상태와 결제 상태 분리**
   - `status`: 주문 상태 (`pending`, `completed` 등)
   - `payment_status`: 결제 상태 (`pending`, `awaiting_deposit`, `paid` 등)
   - 두 필드가 혼동되지 않도록 명확히 구분

3. **무통장 전용 로직 분리**
   - 무통장 입금은 `payment_status = 'awaiting_deposit'`로 시작
   - 관리자 수동 확인 후 `payment_status = 'paid'`로 변경
   - 다른 결제수단과 충돌하지 않도록 분리

4. **향후 포트원 카드/카카오페이 추가 시**
   - `completeOrderAfterPayment()` 공통 함수 재사용
   - `payment_method` 값만 다르게 전달 (`'card'` 또는 `'kakaopay'`)
   - 기존 무통장 입금 로직과 충돌 없음

---

## 6. 변경 내역 요약

### 수정/추가된 파일 목록

#### UI 컴포넌트 (결제수단 노출 정리)
1. `src/components/payments/PaymentMethodSelector.tsx`
2. `src/components/mobile/MobileCashChargeModal.tsx`
3. `src/components/feature/UserSidebar.tsx`
4. `src/pages/mypage/page.tsx`
5. `src/pages/cart/page.tsx`

#### 결제 로직 (공통 함수 및 관리자 페이지)
6. `src/lib/payments/completeOrderAfterPayment.ts` (신규 생성)
7. `src/pages/admin/page.tsx`

#### 타입 정의
8. `src/lib/payments/types.ts`

#### Legacy 코드 정리
9. `src/lib/payments/payaction.ts`
10. `src/lib/payments/inicis.ts`
11. `src/lib/payments/paymentService.ts`
12. `src/lib/payments/productPurchase.ts`
13. `src/lib/payments/cashCharge.ts`
14. `supabase/functions/payments-payaction-webhook/index.ts`
15. `supabase/functions/payments-payaction-init/index.ts`
16. `supabase/functions/payments-inicis-approve/index.ts`
17. `supabase/functions/payments-paypal-approve/index.ts`

---

## 7. UI에서 숨겨진 결제수단

### 한국 사이트 (copydrum.com)
- ❌ 신용카드 (포트원 심사 진행 중)
- ❌ 카카오페이 (포트원 심사 진행 중)
- ❌ PayPal (영문 사이트 전용)
- ✅ 무통장 입금만 표시

### 영문 사이트 (en.copydrum.com)
- ❌ 무통장 입금 (한국 사이트 전용)
- ❌ 신용카드 (포트원 심사 진행 중)
- ❌ 카카오페이 (포트원 심사 진행 중)
- ✅ PayPal만 표시

---

## 8. 무통장 입금 수동 처리 플로우

### 고객 관점
1. **결제 선택**
   - 장바구니 또는 캐시 충전에서 "무통장 입금" 선택
   - 입금자명 입력 모달 표시

2. **입금자명 입력**
   - 입금자명 입력 후 확인
   - 주문 생성 (`payment_status = 'awaiting_deposit'`)

3. **계좌 정보 확인**
   - 고정 계좌 정보 표시:
     - 은행: 농협
     - 계좌번호: 106-02-303742
     - 예금주: 강만수
     - 입금 금액: 주문 금액

4. **입금 대기**
   - 관리자가 입금 확인할 때까지 대기
   - 주문 상태: `awaiting_deposit`

5. **입금 확인 후**
   - 관리자가 입금 확인 처리
   - 주문 상태: `paid`, `completed`
   - 캐시 충전인 경우: 캐시 잔액 증가
   - 악보 구매인 경우: 다운로드 권한 활성화

### 관리자 관점
1. **주문 목록 확인**
   - 관리자 패널에서 `payment_status = 'awaiting_deposit'`인 주문 확인

2. **입금 확인**
   - 실제 입금 확인 후 "입금 확인" 버튼 클릭
   - `completeOrderAfterPayment()` 함수 실행

3. **자동 처리**
   - 주문 상태 업데이트 (`paid`, `completed`)
   - 캐시 충전인 경우: 사용자 캐시 잔액 자동 증가
   - 악보 구매인 경우: 다운로드 권한 자동 활성화

4. **완료**
   - 주문 목록 자동 갱신
   - 완료 알림 표시

---

## 9. 향후 포트원 카드/카카오페이 추가 시 재사용 가능한 함수/모듈

### 공통 함수
**`src/lib/payments/completeOrderAfterPayment.ts`**
- 모든 결제수단의 결제 완료 후처리를 통합 처리
- 포트원 카드/카카오페이 성공 콜백에서도 동일하게 사용 가능

### 사용 예시
```typescript
// 포트원 카드 결제 성공 콜백 (Edge Function 또는 클라이언트)
import { completeOrderAfterPayment } from '../lib/payments/completeOrderAfterPayment';

await completeOrderAfterPayment(orderId, 'card', {
  transactionId: imp_uid,
  paymentProvider: 'portone',
  metadata: {
    portone_imp_uid: imp_uid,
    portone_merchant_uid: merchant_uid,
  },
});

// 포트원 카카오페이 결제 성공 콜백
await completeOrderAfterPayment(orderId, 'kakaopay', {
  transactionId: imp_uid,
  paymentProvider: 'portone',
  metadata: {
    portone_imp_uid: imp_uid,
    portone_merchant_uid: merchant_uid,
  },
});
```

### UI 컴포넌트
- `PaymentMethodSelector`: 결제수단 옵션에 `card`, `kakaopay` 추가만 하면 됨
- `MobileCashChargeModal`: 결제수단 옵션에 `card`, `kakaopay` 추가만 하면 됨
- `UserSidebar`: 결제수단 옵션에 `card`, `kakaopay` 추가만 하면 됨
- `mypage/page.tsx`: 결제수단 옵션에 `card`, `kakaopay` 추가만 하면 됨

### 주의사항
- 포트원 심사 완료 후 UI에서 결제수단 옵션 활성화 필요
- `isEnglishSite` 조건에 따라 한국 사이트에서만 카드/카카오페이 표시
- 영문 사이트는 계속 PayPal만 표시

---

## 10. 결론

이번 작업을 통해:
1. ✅ 한국 사이트는 무통장 입금만, 영문 사이트는 PayPal만 사용하도록 UI 정리
2. ✅ 무통장 입금 수동 처리 플로우 점검 및 보완 완료
3. ✅ 결제 완료 후처리 공통 함수 생성으로 코드 재사용성 향상
4. ✅ 과거 페이액션/이니시스 관련 코드 정리 및 legacy 표시
5. ✅ 결제수단 타입 정의 보강 및 충돌 방지 설계 완료

향후 포트원 카드/카카오페이 추가 시, `completeOrderAfterPayment()` 공통 함수를 재사용하여 쉽게 통합할 수 있습니다.


























