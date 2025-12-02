# PortOne V2 Webhook 처리 개선 완료 보고서

## 문제 상황

PortOne V2 Webhook이 Supabase Edge Function에 도착하지만, 필수 필드 부족으로 인해 결제 확인이 처리되지 않았습니다.

### 발생한 문제

- Webhook payload가 `undefined`로 파싱됨
- `eventType: undefined, paymentId: undefined, orderId: undefined` 오류
- `portone-payment-confirm` Edge Function이 호출되지 않음
- 주문 상태가 자동으로 `paid`/`completed`로 변경되지 않음

### 원인

- PortOne V1 형식으로 파싱하고 있었으나, V2는 다른 필드명 사용
- 필수 필드 체크가 너무 엄격 (`paymentId`, `orderId`, `eventType` 모두 필수)
- V2에서는 `orderId`가 없을 수 있음

## 해결 방법

### 1. PortOne V2 형식에 맞게 Payload 파싱

- 다양한 필드명 지원 (`paymentId`, `payment_id`, `tx_id` 등)
- `status` 대소문자 통일 처리
- `orderId` 및 `eventType` 선택사항으로 변경

### 2. 필수 필드 체크 완화

- `paymentId`만 필수로 체크
- `orderId`와 `eventType`는 선택사항

### 3. transaction_id 기반 주문 조회

- `orderId`가 없을 때 `transaction_id`로 주문 조회

## 수정된 파일

### 1. `supabase/functions/portone-webhook/index.ts`

#### 주요 변경사항:

1. **PortOne V2 형식에 맞게 Payload 파싱**
   ```typescript
   // V2에서는 다양한 필드명을 사용할 수 있음
   const paymentId =
     raw.paymentId ||
     raw.payment_id ||
     raw.tx_id ||
     raw.id ||
     null;

   const statusRaw = raw.status || raw.paymentStatus || '';
   const status = statusRaw.toUpperCase(); // "PAID" 비교용

   const eventType =
     raw.eventType ||
     raw.event_type ||
     raw.type ||
     'payment.paid'; // 기본값

   const orderId =
     raw.orderId ||
     raw.order_id ||
     raw.merchant_uid ||
     raw.merchantUid ||
     null;
   ```

2. **필수 필드 체크 완화**
   ```typescript
   // paymentId만 필수로 체크
   if (!paymentId) {
     console.warn("[portone-webhook] paymentId 없음", { raw, parsed });
     return buildResponse(
       { success: false, error: { message: "paymentId is required" } },
       200,
       origin
     );
   }
   ```

3. **결제 완료 판별 로직 개선**
   ```typescript
   // status 대소문자 차이 없이 확인
   if (status === "PAID") {
     // portone-payment-confirm 호출
   }
   ```

4. **portone-payment-confirm 호출 시 body 구조 개선**
   ```typescript
   const confirmBody: { paymentId: string; orderId?: string | null } = {
     paymentId,
   };
   if (orderId) {
     confirmBody.orderId = orderId;
   }
   ```

5. **로그 개선**
   - 파싱 결과와 원본 raw 데이터 모두 로깅
   - 디버깅을 위한 상세 정보 추가

### 2. `supabase/functions/portone-payment-confirm/index.ts`

#### 주요 변경사항:

1. **orderId를 선택사항으로 변경**
   ```typescript
   interface PortOnePaymentConfirmPayload {
     paymentId: string; // 필수
     orderId?: string | null; // 선택사항
   }
   ```

2. **주문 조회 로직 개선**
   ```typescript
   // orderId가 있으면 id로, 없으면 transaction_id로 조회
   if (orderId) {
     // orderId로 조회
     const { data, error } = await supabase
       .from("orders")
       .select("*, order_items(*, drum_sheets(*))")
       .eq("id", orderId)
       .single();
   } else {
     // transaction_id로 조회 (가장 최근 주문)
     const { data, error } = await supabase
       .from("orders")
       .select("*, order_items(*, drum_sheets(*))")
       .eq("transaction_id", paymentId)
       .order("created_at", { ascending: false })
       .limit(1)
       .single();
   }
   ```

3. **orderId 검증 로직 완화**
   ```typescript
   // orderId가 있을 때만 검증
   if (orderId && portonePayment.orderId && portonePayment.orderId !== orderId) {
     // 오류 처리
   }
   
   // orderId가 없고 PortOne에서 orderId를 받은 경우
   if (!orderId && portonePayment.orderId) {
     // 경고만 로그, 계속 진행
   }
   ```

4. **payment_provider 결정 로직 개선**
   ```typescript
   let paymentProvider = "portone";
   if (isPayPalPayment) {
     paymentProvider = "paypal";
   } else if (isKakaoPayPayment) {
     paymentProvider = "kakaopay";
   }
   ```

5. **로그 개선**
   - PortOne API 응답의 상세 정보 로깅
   - tx_id, payment_id 등 필드 추가
   - 주문 조회 방법 (by_id / by_transaction_id) 표시

## 동작 방식

### Webhook 처리 플로우

1. **Webhook 수신** (`portone-webhook`)
   - PortOne에서 Webhook 전송
   - 시그니처 검증 (선택사항)
   - Payload 파싱 (V2 형식 지원)

2. **필드 추출**
   - `paymentId`: `paymentId`, `payment_id`, `tx_id`, `id` 중에서 추출
   - `status`: 대문자로 변환하여 비교
   - `orderId`: 있으면 추출, 없으면 `null`
   - `eventType`: 기본값 `'payment.paid'`

3. **결제 완료 확인**
   - `status === "PAID"` 확인
   - `portone-payment-confirm` 호출

4. **주문 조회** (`portone-payment-confirm`)
   - `orderId`가 있으면: `orders.id = orderId`로 조회
   - `orderId`가 없으면: `orders.transaction_id = paymentId`로 조회

5. **결제 검증 및 주문 업데이트**
   - PortOne API로 결제 상태 조회
   - 금액 검증
   - 주문 상태 업데이트 (`payment_status = 'paid'`, `status = 'completed'`)

## 필드 매핑

### PortOne V2 Webhook Payload → 내부 파싱

| PortOne V2 필드 | 내부 변수 | 우선순위 |
|---|---|---|
| `paymentId`, `payment_id`, `tx_id`, `id` | `paymentId` | 순서대로 시도 |
| `status`, `paymentStatus` | `status` (대문자 변환) | 순서대로 시도 |
| `orderId`, `order_id`, `merchant_uid`, `merchantUid` | `orderId` | 순서대로 시도 |
| `eventType`, `event_type`, `type` | `eventType` | 기본값: `'payment.paid'` |

## 테스트 시나리오

### 1. 카카오페이 3,000원 테스트 결제

1. **결제 진행**
   - 한국어 사이트에서 카카오페이로 3,000원 결제
   - 결제 완료

2. **Webhook 수신 확인**
   - PortOne 콘솔에서 Webhook 성공 여부 확인
   - Supabase `portone-webhook` 로그 확인:
     ```
     [portone-webhook] Webhook 수신 (파싱 결과) {
       eventType: 'payment.paid',
       paymentId: 'pay_xxx...',
       orderId: '...' 또는 null,
       status: 'PAID'
     }
     ```

3. **결제 확인 처리 확인**
   - `portone-payment-confirm` 로그 확인:
     ```
     [portone-payment-confirm] 주문 조회 성공
     [portone-payment-confirm] PortOne 결제 조회 성공
     [portone-payment-confirm] 결제 확인 및 주문 업데이트 성공
     ```

4. **주문 상태 확인**
   - `orders` 테이블에서 확인:
     - `payment_status = 'paid'`
     - `status = 'completed'`
     - `transaction_id = paymentId`
   - 관리자 페이지에서 확인:
     - 주문 상태가 "결제 완료"로 표시

## 로그 예시

### portone-webhook 로그

```
[portone-webhook] 전체 Webhook Payload {
  "tx_id": "pay_abc123...",
  "payment_id": "pay_abc123...",
  "status": "Paid"
}

[portone-webhook] Webhook 수신 (파싱 결과) {
  eventType: "payment.paid",
  paymentId: "pay_abc123...",
  orderId: null,
  status: "PAID",
  rawPaymentId: "pay_abc123...",
  rawStatus: "Paid"
}

[portone-webhook] portone-payment-confirm 호출 {
  paymentId: "pay_abc123...",
  orderId: null
}
```

### portone-payment-confirm 로그

```
[portone-payment-confirm] 결제 확인 요청 {
  paymentId: "pay_abc123...",
  orderId: null
}

[portone-payment-confirm] transaction_id로 주문 조회 {
  paymentId: "pay_abc123..."
}

[portone-payment-confirm] 주문 조회 성공 {
  orderId: "...",
  transaction_id: "pay_abc123...",
  payment_status: "pending",
  status: "pending",
  searchMethod: "by_transaction_id"
}

[portone-payment-confirm] PortOne 결제 조회 성공 {
  paymentId: "pay_abc123...",
  portonePaymentId: "pay_abc123...",
  status: "PAID",
  amount: { total: 3000, currency: "CURRENCY_KRW" },
  tx_id: "pay_abc123..."
}

[portone-payment-confirm] 결제 확인 및 주문 업데이트 성공 {
  orderId: "...",
  paymentId: "pay_abc123...",
  transaction_id: "pay_abc123...",
  isPayPalPayment: false,
  isKakaoPayPayment: true,
  payment_provider: "kakaopay",
  status: "paid"
}
```

## 영향 범위

### ✅ 개선된 부분

- PortOne V2 Webhook 정상 처리
- `orderId`가 없어도 `transaction_id`로 주문 조회 가능
- 카카오페이 결제 자동 완료 처리
- PayPal 결제는 기존 로직 유지 (영향 없음)

### ⚠️ 주의사항

1. **기존 주문 호환성**
   - `transaction_id`가 없는 기존 주문은 `orderId`로만 조회 가능
   - 새로운 주문부터는 `transaction_id` 저장됨

2. **멱등성 처리**
   - `markWebhookProcessed`는 `orderId`가 있을 때만 동작
   - `transaction_id` 기반 멱등성 체크는 향후 개선 가능

3. **PayPal 호환성**
   - PayPal은 기존 로직 그대로 유지
   - `orderId`가 항상 전달되므로 영향 없음

## 향후 개선 사항

- [ ] `transaction_id` 기반 멱등성 체크 추가
- [ ] Webhook 재시도 로직 개선
- [ ] 주문 조회 실패 시 상세 에러 메시지
- [ ] 카카오페이 결제 취소/환불 처리





