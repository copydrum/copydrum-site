# PortOne PayPal Webhook 테스트 및 운영 가이드

## 개요

이 문서는 PortOne PayPal 결제의 Webhook 처리 시스템을 테스트하고 모니터링하는 방법을 설명합니다.

## 환경 변수 설정 확인

다음 환경 변수가 Supabase 프로젝트에 설정되어 있는지 확인하세요:

### 필수 환경 변수
- `SUPABASE_URL` - 자동 설정됨
- `SUPABASE_SERVICE_ROLE_KEY` - 자동 설정됨
- `PORTONE_API_KEY` - PortOne API 키 (결제 상태 조회용)

### 선택 환경 변수 (보안 강화 권장)
- `PORTONE_WEBHOOK_SECRET` - PortOne Webhook 시그니처 검증용 시크릿

### 확인 방법
1. Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. 또는 Supabase CLI: `supabase secrets list`

## PortOne Webhook 설정

### 1. PortOne 콘솔에서 Webhook URL 설정

1. PortOne 콘솔에 로그인
2. 설정 → Webhook 메뉴로 이동
3. Webhook URL 설정:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/portone-webhook
   ```
4. 이벤트 선택: `payment.paid` (결제 완료 이벤트)
5. Webhook Secret 설정 (선택사항, 보안 강화 권장)

### 2. Webhook Secret 설정 (선택사항)

Webhook Secret을 설정한 경우, Supabase Secrets에도 동일한 값을 설정해야 합니다:

```bash
supabase secrets set PORTONE_WEBHOOK_SECRET=your_webhook_secret
```

## 로컬 테스트 방법

### 1. Edge Functions 로컬 실행

```bash
# Webhook 함수 실행
supabase functions serve portone-webhook

# 결제 확인 함수 실행 (별도 터미널)
supabase functions serve portone-payment-confirm
```

### 2. Webhook Payload 테스트

PortOne의 샘플 Webhook Payload를 사용하여 테스트:

```bash
curl -X POST http://localhost:54321/functions/v1/portone-webhook \
  -H "Content-Type: application/json" \
  -H "x-portone-signature: [서명]" \
  -H "x-portone-timestamp: [타임스탬프]" \
  -d '{
    "eventType": "payment.paid",
    "paymentId": "test_payment_id",
    "orderId": "test_order_id",
    "status": "PAID",
    "amount": {
      "total": 100,
      "currency": "CURRENCY_USD"
    }
  }'
```

**주의**: 실제 테스트 시에는 실제 주문 ID와 결제 ID를 사용해야 합니다.

## 프로덕션 모니터링

### 1. Supabase 로그 확인

1. Supabase Dashboard → Edge Functions → Logs
2. 함수 선택: `portone-webhook`, `portone-payment-confirm`
3. 다음 로그 라인을 확인:

#### 정상 처리 로그
```
[portone-webhook] Webhook 수신
  eventType: payment.paid
  paymentId: [결제 ID]
  orderId: [주문 ID]
  status: PAID

[portone-webhook] 결제 확인 및 처리 완료
  paymentId: [결제 ID]
  orderId: [주문 ID]

[portone-payment-confirm] PortOne 결제 조회 성공
  paymentId: [결제 ID]
  status: PAID

[portone-payment-confirm] 결제 확인 및 주문 업데이트 성공
  orderId: [주문 ID]
  paymentId: [결제 ID]
  isPayPalPayment: true
  payment_provider: paypal
  status: paid
```

#### 오류 로그
```
[portone-webhook] 시그니처 검증 실패
[portone-webhook] 결제 확인 실패
[portone-payment-confirm] PortOne API 조회 실패
[portone-payment-confirm] 주문 업데이트 오류
```

### 2. 주문 상태 확인

관리자 페이지에서 주문 상태를 확인:

1. 주문 내역 페이지 접속
2. PayPal 결제 주문 확인
3. 다음 필드 확인:
   - `payment_status`: `paid`
   - `status`: `completed`
   - `payment_provider`: `paypal` 또는 `portone`
   - `metadata.is_paypal_payment`: `true`
   - `metadata.last_webhook_at`: Webhook 수신 시간
   - `metadata.last_webhook_event`: `payment.paid`

### 3. 데이터베이스 직접 확인

Supabase SQL Editor에서 확인:

```sql
-- PayPal 결제 주문 확인
SELECT 
  id,
  order_number,
  payment_status,
  status,
  payment_provider,
  pg_transaction_id,
  paid_at,
  metadata->>'is_paypal_payment' as is_paypal,
  metadata->>'last_webhook_at' as webhook_time,
  metadata->>'last_webhook_event' as webhook_event,
  metadata->>'portone_payment_id' as portone_payment_id
FROM orders
WHERE payment_provider IN ('paypal', 'portone')
  AND metadata->>'payment_method' = 'paypal'
ORDER BY created_at DESC
LIMIT 10;
```

## 문제 해결

### 문제 1: Webhook이 수신되지 않음

**증상**: Supabase 로그에 `[portone-webhook] Webhook 수신` 로그가 없음

**해결 방법**:
1. PortOne 콘솔에서 Webhook URL이 올바르게 설정되었는지 확인
2. Supabase Edge Function이 배포되었는지 확인
3. PortOne 콘솔에서 Webhook 테스트 기능 사용
4. 네트워크 방화벽 설정 확인

### 문제 2: 시그니처 검증 실패

**증상**: 로그에 `[portone-webhook] 시그니처 검증 실패` 메시지

**해결 방법**:
1. `PORTONE_WEBHOOK_SECRET` 환경 변수가 올바르게 설정되었는지 확인
2. PortOne 콘솔의 Webhook Secret과 Supabase Secrets의 값이 일치하는지 확인
3. 시그니처 검증을 일시적으로 비활성화하여 테스트 (프로덕션에서는 권장하지 않음)

### 문제 3: 결제 확인 실패

**증상**: 로그에 `[portone-webhook] 결제 확인 실패` 메시지

**해결 방법**:
1. `PORTONE_API_KEY` 환경 변수가 올바르게 설정되었는지 확인
2. `portone-payment-confirm` 함수 로그 확인
3. PortOne API 응답 확인 (결제 상태가 `PAID`인지 확인)
4. 주문 ID와 결제 ID가 올바른지 확인

### 문제 4: 주문 상태가 업데이트되지 않음

**증상**: Webhook은 수신되었지만 주문 상태가 `paid`로 변경되지 않음

**해결 방법**:
1. `[portone-payment-confirm]` 로그 확인
2. 주문 ID가 올바른지 확인
3. 금액 검증 실패 여부 확인 (로그에서 `금액 불일치` 확인)
4. 데이터베이스 권한 확인 (RLS 정책 확인)
5. 주문이 이미 `paid` 상태인지 확인 (중복 처리 방지)

### 문제 5: 중복 처리

**증상**: 동일한 Webhook이 여러 번 처리됨

**해결 방법**:
1. 멱등성 체크 로직 확인 (`isWebhookProcessed` 함수)
2. `metadata.processed_webhooks` 배열 확인
3. Webhook 처리 기록이 올바르게 저장되는지 확인

## 운영 체크리스트

### 일일 확인 사항
- [ ] Supabase 로그에서 Webhook 수신 확인
- [ ] 결제 완료 주문의 상태가 `paid`로 업데이트되었는지 확인
- [ ] 오류 로그 확인 및 대응

### 주간 확인 사항
- [ ] PortOne 콘솔에서 Webhook 전송 상태 확인
- [ ] 결제 완료 주문과 실제 PayPal 결제 내역 비교
- [ ] 환경 변수 설정 재확인

### 월간 확인 사항
- [ ] Webhook 처리 성공률 확인
- [ ] 평균 처리 시간 확인
- [ ] 오류 패턴 분석 및 개선

## 알림 설정 (선택사항)

중요한 오류 발생 시 알림을 받도록 설정할 수 있습니다:

1. Supabase Dashboard → Project Settings → Alerts
2. Edge Function 오류 알림 설정
3. 또는 외부 모니터링 서비스 (예: Sentry) 연동

## 참고 자료

- [PortOne Webhook 문서](https://developers.portone.io/docs/ko/webhook)
- [Supabase Edge Functions 문서](https://supabase.com/docs/guides/functions)
- [PORTONE_PAYPAL_INTEGRATION.md](./PORTONE_PAYPAL_INTEGRATION.md)






