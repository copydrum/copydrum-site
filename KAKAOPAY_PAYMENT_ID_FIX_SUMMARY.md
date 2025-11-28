# 카카오페이 결제 ID 중복 오류 해결 완료 보고서

## 문제 상황

카카오페이 결제 시 "요청하신 payment id는 이미 결제된 id입니다." 에러가 발생했습니다.

### 원인

- `requestKakaoPayPayment` 함수에서 `paymentId`에 `params.orderId`를 그대로 사용
- 이미 결제된 주문 ID를 재사용하게 되어 중복 오류 발생
- 같은 주문으로 재결제 시도 시 paymentId 중복 에러 발생

## 해결 방법

### 1. paymentId와 orderId 역할 분리

- **orderId**: 내부 주문 식별용 (orders 테이블의 `id`)
- **paymentId**: PG 결제 식별용 (orders 테이블의 `transaction_id`)

### 2. paymentId를 항상 새로운 UUID로 생성

- 매번 결제 요청 시 새로운 UUID 생성
- 형식: `pay_{uuidv4()}`

## 수정된 파일

### 1. `src/lib/payments/portone.ts`

#### 주요 변경사항:

1. **uuid 패키지 import 추가**
   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   ```

2. **paymentId 생성 로직 변경**
   ```typescript
   // 변경 전
   paymentId: params.orderId,
   
   // 변경 후
   const newPaymentId = `pay_${uuidv4()}`;
   paymentId: newPaymentId, // 항상 새로운 UUID 사용
   ```

3. **transaction_id 저장 로직 추가**
   ```typescript
   // 주문에 transaction_id(paymentId) 저장
   const { error: updateError } = await supabase
     .from('orders')
     .update({ transaction_id: newPaymentId })
     .eq('id', params.orderId);
   ```

4. **반환값에 paymentId 추가**
   ```typescript
   export interface RequestKakaoPayPaymentResult {
     // ... 기존 필드
     paymentId?: string; // PortOne paymentId (transaction_id로 사용)
   }
   
   return {
     success: true,
     merchant_uid: params.orderId,
     paymentId: newPaymentId, // PG 결제 식별 ID 반환
     error_msg: 'KakaoPay 결제창이 열렸습니다.',
   };
   ```

5. **로그 개선**
   ```typescript
   console.log('[portone-kakaopay] requestPayment requestData', {
     orderId: params.orderId, // 내부 주문 ID
     paymentId: newPaymentId, // PG 결제 식별 ID (transaction_id로 저장됨)
     // ... 기타 필드
   });
   ```

### 2. `package.json`

#### 주요 변경사항:

- **uuid 패키지 추가**
  ```json
  "dependencies": {
    "uuid": "^latest"
  },
  "devDependencies": {
    "@types/uuid": "^latest"
  }
  ```

## 동작 방식

### 결제 요청 플로우

1. 사용자가 카카오페이 결제 시도
2. `requestKakaoPayPayment` 호출
3. **새로운 paymentId 생성** (`pay_{uuid}`)
4. 주문의 `transaction_id`에 paymentId 저장
5. PortOne `requestPayment` 호출 시 `paymentId` 사용
6. Webhook에서 `transaction_id`로 주문 조회 및 업데이트

### ID 역할 분리

| ID | 용도 | 저장 위치 | 설명 |
|---|---|---|---|
| `orderId` | 내부 주문 식별 | `orders.id` | 주문 레코드의 UUID |
| `paymentId` | PG 결제 식별 | `orders.transaction_id` | PortOne 결제 요청용 UUID |

## 영향 범위

### ✅ 영향 없는 부분

- PayPal 결제 로직 (`requestPayPalPayment`는 변경 없음)
- 기존 주문 조회 로직 (orderId 기반 조회 유지)
- Webhook 처리 로직 (`transaction_id`로 주문 조회하는 로직은 이미 존재)

### 🔄 영향을 받는 부분

- 카카오페이 결제 요청 시 항상 새로운 paymentId 생성
- 주문 생성 후 `transaction_id` 업데이트
- 같은 주문으로 재결제 시도 가능 (paymentId 중복 방지)

## 테스트 시나리오

1. **정상 결제**
   - 카카오페이 결제 시도
   - 새로운 paymentId 생성 확인
   - `transaction_id` 저장 확인
   - 결제 완료 후 Webhook에서 주문 업데이트 확인

2. **재결제 시도**
   - 같은 주문으로 재결제 시도
   - 새로운 paymentId 생성 확인
   - "이미 결제된 id" 오류 발생하지 않음

3. **주문 조회**
   - Webhook에서 `transaction_id`로 주문 조회
   - 정상적으로 주문 찾기 및 업데이트

## 주의사항

1. **transaction_id 업데이트 실패 시**
   - 로그에 경고 출력
   - 결제는 계속 진행 (transaction_id는 Webhook에서도 저장 가능)

2. **기존 주문과의 호환성**
   - 기존 주문은 `transaction_id`가 없을 수 있음
   - Webhook 처리 시 `transaction_id` 또는 `orderId`로 조회 가능

3. **PayPal과의 차이점**
   - PayPal은 `paymentId`에 `orderId` 사용 (변경 없음)
   - 카카오페이만 새로운 UUID 사용

## 향후 개선 사항

- [ ] 재결제 시 기존 결제 취소 로직 추가 (선택사항)
- [ ] paymentId 생성 실패 시 에러 처리 강화
- [ ] transaction_id 저장 실패 시 재시도 로직 추가

