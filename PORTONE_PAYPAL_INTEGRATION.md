# 포트원 + PayPal 연동 작업 내역

## 작업 개요

기존 KG이니시스 및 직접 PayPal 연동 코드를 포트원(PortOne) 기반으로 전환하고, PayPal 결제를 포트원을 통해 통합 연동했습니다.

## 작업 일시

2024년 작업 완료

## 주요 변경 사항

### 1. 새로 생성된 파일

#### 프론트엔드
- **`src/lib/payments/portone.ts`**
  - 포트원 스크립트 로딩 및 초기화
  - PayPal 결제 요청 함수 (`requestPayPalPayment`)
  - KRW → USD 환율 변환 로직
  - 포트원 결제 파라미터 구성 및 콜백 처리

- **`src/pages/payments/portone-paypal-return/page.tsx`**
  - 포트원 PayPal 결제 완료 후 리다이렉트 페이지
  - 결제 결과 확인 및 주문 상태 업데이트
  - 성공/실패 UI 표시

#### 백엔드 (Edge Functions)
- **`supabase/functions/payments-portone-paypal/index.ts`**
  - 포트원 PayPal 결제 완료 처리 Edge Function
  - 주문 상태를 `paid`로 업데이트
  - 포트원 거래 정보(`imp_uid`, `merchant_uid`) 저장

### 2. 수정된 파일

#### 프론트엔드
- **`src/lib/payments/productPurchase.ts`**
  - KG이니시스 관련 import 주석 처리
  - 직접 PayPal 연동 관련 import 주석 처리
  - 포트원 PayPal 연동으로 전환
  - 카드 결제는 현재 비활성화 (포트원으로 전환 예정)

- **`src/lib/payments/index.ts`**
  - KG이니시스 export 주석 처리
  - 포트원 모듈 export 추가

- **`src/router/config.tsx`**
  - 포트원 PayPal 반환 페이지 라우트 추가 (`/payments/portone-paypal/return`)

### 3. 비활성화된 코드 (주석 처리)

#### KG이니시스 관련
- `src/lib/payments/inicis.ts` - export 비활성화
- `src/lib/payments/productPurchase.ts` - KG이니시스 결제 로직 주석 처리
- 카드 결제 기능 일시 중단 (포트원으로 전환 예정)

#### 직접 PayPal 연동 관련
- `src/lib/payments/paypal.ts` - export는 유지하되 사용하지 않음
- `src/lib/payments/productPurchase.ts` - 직접 PayPal 연동 로직 주석 처리

### 4. 유지된 코드

#### 무통장입금 관련
- 무통장입금 로직은 최소한의 형태로 유지
- 타입 정의 (`VirtualAccountInfo`) 유지
- 주문 상태 enum (`awaiting_deposit`) 유지
- 나중에 포트원/페이액션 연동 시 재사용 가능

## 결제 흐름 (포트원 + PayPal)

### 1. 결제 요청 단계
```
사용자 → 결제 수단 선택 (PayPal) 
  → startSheetPurchase() 호출
  → requestPayPalPayment() 호출
  → 포트원 스크립트 로드 및 초기화
  → IMP.request_pay() 호출
```

### 2. 결제 처리 단계
```
포트원 결제 창 열림
  → 사용자가 PayPal에서 결제 완료
  → 포트원 콜백 실행 (성공/실패)
  → m_redirect_url로 리다이렉트
```

### 3. 결제 완료 처리 단계
```
리다이렉트 페이지 (/payments/portone-paypal/return)
  → URL 파라미터에서 결제 결과 확인
  → Edge Function 호출 (payments-portone-paypal)
  → 주문 상태 업데이트 (paid)
  → 주문 내역 페이지로 이동
```

## 환경 변수 설정

다음 환경 변수를 설정해야 합니다:

### 프론트엔드 (`.env` 또는 Vercel 환경 변수)
```bash
VITE_PORTONE_MERCHANT_CODE=your_merchant_code
```

### 백엔드 (Supabase Secrets)
- `SUPABASE_URL` (자동 설정)
- `SUPABASE_SERVICE_ROLE_KEY` (자동 설정)

## 포트원 설정

### 채널 정보
- **채널 이름**: `copydrum_paypal`
- **PG Provider**: `paypal`
- **결제 수단**: PayPal

### 사용 방법
포트원 콘솔에서 `copydrum_paypal` 채널을 사용하여 PayPal 결제를 처리합니다.

## 테스트 방법

### 개발 환경
1. 포트원 테스트 모드 사용 (포트원 콘솔에서 설정)
2. 테스트 금액으로 결제 테스트
3. 브라우저 콘솔에서 로그 확인:
   - `[portone]` 접두사로 시작하는 로그
   - `[portone-paypal-return]` 접두사로 시작하는 로그

### 프로덕션 환경
1. 포트원 라이브 모드로 전환
2. 실제 PayPal 계정으로 결제 테스트
3. 주문 내역에서 결제 상태 확인

## 주의 사항

### 현재 제한 사항
1. **카드 결제 비활성화**: 카드 결제는 현재 사용할 수 없습니다. 포트원을 통한 카드 결제 연동이 필요합니다.
2. **환율 변환**: KRW → USD 변환은 `DEFAULT_USD_RATE`를 사용합니다. 실제 환율 API 연동이 필요할 수 있습니다.

### 향후 작업
1. 포트원을 통한 카드 결제 연동
2. 실제 환율 API 연동 (선택사항)
3. 무통장입금 포트원/페이액션 연동

## 파일 구조

```
src/
├── lib/
│   └── payments/
│       ├── portone.ts          # 새로 생성 (포트원 연동)
│       ├── productPurchase.ts  # 수정 (포트원 PayPal 사용)
│       ├── inicis.ts           # 비활성화 (주석 처리)
│       ├── paypal.ts           # 유지 (직접 연동, 사용 안 함)
│       └── index.ts            # 수정 (포트원 export 추가)
├── pages/
│   └── payments/
│       └── portone-paypal-return/
│           └── page.tsx        # 새로 생성 (반환 페이지)
└── router/
    └── config.tsx              # 수정 (라우트 추가)

supabase/
└── functions/
    └── payments-portone-paypal/
        └── index.ts             # 새로 생성 (Edge Function)
```

## 디버깅

### 콘솔 로그 확인
- `[portone]` - 포트원 초기화 및 결제 요청
- `[portone-paypal-return]` - 결제 반환 페이지 처리
- `[portone-paypal]` - Edge Function 처리

### 일반적인 문제 해결

1. **포트원 스크립트 로드 실패**
   - 네트워크 연결 확인
   - 포트원 CDN 접근 가능 여부 확인

2. **결제 창이 열리지 않음**
   - 포트원 가맹점 코드 확인
   - 채널 이름(`copydrum_paypal`) 확인

3. **결제 완료 후 주문 상태가 업데이트되지 않음**
   - Edge Function 로그 확인
   - Supabase 연결 확인
   - 주문 ID 확인

## 참고 자료

- [포트원 개발자 문서](https://developers.portone.io/)
- [포트원 PayPal 연동 가이드](https://developers.portone.io/docs/ko/pg/paypal)









