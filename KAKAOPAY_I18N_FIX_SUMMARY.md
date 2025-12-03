# 카카오페이 i18n 번역 키 추가 완료 보고서

## 문제 상황

한국어 사이트에서 카카오페이 결제수단 선택 모달에서 번역 키 문자열이 그대로 노출되는 문제가 있었습니다:
- 라벨: `payment.kakaopay` (키 문자열 그대로 노출)
- 설명: `payment.kakaopayDescription` (키 문자열 그대로 노출)

## 수정 완료 사항

### 1. 번역 키 추가 위치

#### `src/i18n/local/ko/common.ts` (한국어)
- `payment.kakaopay`: `'카카오페이'` 추가
- `payment.kakaopayDescription`: `'카카오페이로 간편하게 결제합니다.'` 추가

#### `src/i18n/local/en/common.ts` (영어)
- `payment.kakaopay`: `'KakaoPay'` 추가
- `payment.kakaopayDescription`: `'Pay easily with KakaoPay.'` 추가

### 2. 번역 키 사용 위치 확인

다음 파일에서 `payment.kakaopay` 및 `payment.kakaopayDescription` 키를 사용 중이며, 이미 올바른 형태로 구현되어 있었습니다:
- `src/components/payments/PaymentMethodSelector.tsx` - `t('payment.kakaopay')`, `t('payment.kakaopayDescription')` 사용
- `src/components/payments/PointChargeModal.tsx` - `t('payment.kakaopay')` 사용 (description은 사용하지 않음)

## 변경된 파일

1. **src/i18n/local/ko/common.ts**
   - 라인 89-90에 카카오페이 번역 키 추가
   ```typescript
   'payment.kakaopay': '카카오페이',
   'payment.kakaopayDescription': '카카오페이로 간편하게 결제합니다.',
   ```

2. **src/i18n/local/en/common.ts**
   - 라인 89-90에 카카오페이 번역 키 추가
   ```typescript
   'payment.kakaopay': 'KakaoPay',
   'payment.kakaopayDescription': 'Pay easily with KakaoPay.',
   ```

## UI에서 기대되는 결과

### 한국어 사이트 (KRW)
- **라벨**: "카카오페이" (번역 키가 정상적으로 적용됨)
- **설명**: "카카오페이로 간편하게 결제합니다." (번역 키가 정상적으로 적용됨)

### 영어/글로벌 사이트
- 카카오페이 옵션이 노출되지 않음 (한국어 사이트 전용이므로 정상 동작)
- 기존 PayPal 등 다른 결제수단은 정상 작동

## 기능 테스트 시나리오

### 테스트 1: 한국어 사이트에서 카카오페이 표시 확인

1. **악보 바로구매 테스트**
   - 한국어 사이트 (`copydrum.com` 또는 `localhost`) 접속
   - 악보 상세 페이지에서 "바로구매" 버튼 클릭
   - 결제수단 선택 모달이 열림
   - 결제수단 목록에서 확인:
     - ✅ "카카오페이" (키 문자열이 아닌 실제 번역 텍스트)
     - ✅ "카카오페이로 간편하게 결제합니다." (설명 텍스트)

2. **장바구니 결제 테스트**
   - 장바구니에 악보 추가
   - "결제하기" 버튼 클릭
   - 결제수단 선택 모달 확인
   - 카카오페이 옵션이 올바른 한국어 텍스트로 표시되는지 확인

3. **포인트 충전 테스트**
   - 사이드바에서 포인트 충전 모달 열기
   - 결제수단 선택 시 카카오페이 옵션 확인
   - ✅ "카카오페이"로 올바르게 표시되는지 확인

### 테스트 2: 다른 언어 사이트에서 카카오페이 미노출 확인

1. **영어 사이트 테스트**
   - `en.copydrum.com` 접속
   - 결제수단 선택 모달 열기
   - ✅ 카카오페이 옵션이 보이지 않아야 함
   - ✅ PayPal 옵션만 표시됨 (정상)

2. **일본어 사이트 테스트**
   - `jp.copydrum.com` 접속
   - 결제수단 선택 모달 열기
   - ✅ 카카오페이 옵션이 보이지 않아야 함
   - ✅ PayPal 옵션만 표시됨 (정상)

### 테스트 3: 번역 키 누락 시 Fallback 확인

현재 코드에 fallback 텍스트가 있어, 번역 키가 없어도 기본값이 표시됩니다:
- `t('payment.kakaopay') || '카카오페이'`
- `t('payment.kakaopayDescription') || '간편하게 카카오페이로 결제'`

하지만 이제 번역 키가 추가되었으므로 번역 텍스트가 정상적으로 표시됩니다.

## 주의사항

- ✅ 다른 결제수단(무통장입금, 포인트, PayPal)의 번역 키는 변경하지 않음
- ✅ 기존 `payment.kakao` 키는 그대로 유지 (다른 곳에서 사용할 수 있음)
- ✅ 결제 로직(PortOne/KakaoPay 관련 코드)은 변경하지 않음
- ✅ 타입 에러 없음 (linter 확인 완료)

## 추가 작업 필요 없음

- 다른 언어 로케일(ja, zh-CN, vi 등)에는 추가하지 않음
  - 한국어 사이트 전용 기능이므로 영어로 fallback되어도 문제없음
  - 필요 시 추후 추가 가능







