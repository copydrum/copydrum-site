# 다국어 도메인 라우팅 구현 완료

## 📋 수정된 파일 목록

1. **`src/i18n/getLocaleFromHost.ts`**
   - 모든 언어 도메인 매핑 추가
   - zh-CN, zh-TW 하이픈 처리 (zh-cn, zh-tw 도메인 지원)

2. **`src/config/languageDomainMap.ts`**
   - 모든 언어 도메인 URL 추가
   - SupportedLanguage 타입 자동 업데이트

3. **`src/components/common/LanguageSelector.tsx`**
   - 언어 변경 시 모든 언어 도메인으로 리다이렉트 로직 추가
   - 도메인 매핑이 없는 경우 경고 처리

## 🌍 도메인-언어 매핑

| 도메인 | 언어 | Locale 폴더 | 통화 | 결제수단 |
|--------|------|-------------|------|----------|
| `copydrum.com` | 한국어 (ko) | `src/i18n/locales/ko` | KRW | 무통장입금만 |
| `en.copydrum.com` | 영어 (en) | `src/i18n/locales/en` | USD | PayPal만 |
| `jp.copydrum.com` | 일본어 (ja) | `src/i18n/locales/ja` | JPY | PayPal만 |
| `de.copydrum.com` | 독일어 (de) | `src/i18n/locales/de` | USD | PayPal만 |
| `es.copydrum.com` | 스페인어 (es) | `src/i18n/locales/es` | USD | PayPal만 |
| `fr.copydrum.com` | 프랑스어 (fr) | `src/i18n/locales/fr` | USD | PayPal만 |
| `hi.copydrum.com` | 힌디어 (hi) | `src/i18n/locales/hi` | USD | PayPal만 |
| `id.copydrum.com` | 인도네시아어 (id) | `src/i18n/locales/id` | USD | PayPal만 |
| `it.copydrum.com` | 이탈리아어 (it) | `src/i18n/locales/it` | USD | PayPal만 |
| `pt.copydrum.com` | 포르투갈어 (pt) | `src/i18n/locales/pt` | USD | PayPal만 |
| `ru.copydrum.com` | 러시아어 (ru) | `src/i18n/locales/ru` | USD | PayPal만 |
| `th.copydrum.com` | 태국어 (th) | `src/i18n/locales/th` | USD | PayPal만 |
| `tr.copydrum.com` | 터키어 (tr) | `src/i18n/locales/tr` | USD | PayPal만 |
| `uk.copydrum.com` | 우크라이나어 (uk) | `src/i18n/locales/uk` | USD | PayPal만 |
| `vi.copydrum.com` | 베트남어 (vi) | `src/i18n/locales/vi` | USD | PayPal만 |
| `zh-cn.copydrum.com` | 중국어 간체 (zh-CN) | `src/i18n/locales/zh-CN` | USD | PayPal만 |
| `zh-tw.copydrum.com` | 중국어 번체 (zh-TW) | `src/i18n/locales/zh-TW` | USD | PayPal만 |

## 🔒 보호된 설정 (변경 금지)

다음 언어들은 이미 올바르게 설정되어 있으며 **변경하지 않았습니다**:

- ✅ 한국어 (ko) → `copydrum.com`
- ✅ 영어 (en) → `en.copydrum.com`
- ✅ 일본어 (ja) → `jp.copydrum.com` (또는 `ja.copydrum.com`)

## 💳 결제 규칙

### 한국 사이트 (copydrum.com)
- **통화**: KRW (원)
- **결제수단**: 무통장입금만
- **구현 위치**: `src/components/payments/PaymentMethodSelector.tsx`

### 글로벌 사이트 (모든 서브도메인)
- **통화**: USD (달러) 또는 JPY (엔)
- **결제수단**: PayPal만
- **구현 위치**: `src/components/payments/PaymentMethodSelector.tsx`

## 🔧 주요 변경 사항

### 1. `getLocaleFromHost.ts`

```typescript
// ✅ 이미 설정된 언어들 (변경 금지)
if (hostWithoutWww === "copydrum.com") return "ko";
if (hostWithoutWww.startsWith("en.")) return "en";
if (hostWithoutWww.startsWith("jp.") || hostWithoutWww.startsWith("ja.")) return "ja";

// ✅ 나머지 언어 도메인 매핑
if (hostWithoutWww.startsWith("de.")) return "de";
if (hostWithoutWww.startsWith("es.")) return "es";
// ... (모든 언어 추가)
```

### 2. `languageDomainMap.ts`

```typescript
export const languageDomainMap = {
    ko: "https://copydrum.com",
    en: "https://en.copydrum.com",
    ja: "https://jp.copydrum.com",
    de: "https://de.copydrum.com",
    // ... (모든 언어 추가)
    "zh-CN": "https://zh-cn.copydrum.com",
    "zh-TW": "https://zh-tw.copydrum.com",
} as const;
```

### 3. `LanguageSelector.tsx`

```typescript
// 언어 변경 시 도메인 리다이렉트
const domainMap: Record<string, string> = {
    'de': 'de.copydrum.com',
    'es': 'es.copydrum.com',
    // ... (모든 언어 추가)
};

targetHost = domainMap[langCode];
if (!targetHost) {
    console.warn(`[LanguageSelector] 도메인 매핑이 없습니다: ${langCode}`);
    // 현재 도메인 유지
}
```

## 🧪 테스트 방법

### 1. 로컬 개발 환경

```bash
# 한국어 사이트 (기본)
http://localhost:5173

# 영어 사이트
http://localhost:5173?lang=en

# 일본어 사이트
http://localhost:5173?lang=ja
```

### 2. 프로덕션 환경

각 도메인에 접속하여 다음을 확인:

1. **언어 자동 감지**
   - `de.copydrum.com` → 독일어로 표시
   - `fr.copydrum.com` → 프랑스어로 표시
   - `zh-cn.copydrum.com` → 중국어 간체로 표시

2. **결제수단 확인**
   - `copydrum.com` → 무통장입금만 표시
   - `en.copydrum.com` → PayPal만 표시
   - `de.copydrum.com` → PayPal만 표시

3. **언어 선택기**
   - 언어 선택 시 해당 언어 도메인으로 리다이렉트
   - URL 경로 유지 (`/sheets`, `/mypage`, `/cart` 등)

## ⚠️ 주의사항

### zh-CN & zh-TW 도메인

도메인에서는 하이픈(`-`)을 사용할 수 있지만, 일부 DNS/CDN 설정에서 문제가 될 수 있습니다.

**현재 설정**:
- `zh-cn.copydrum.com` → `zh-CN` locale
- `zh-tw.copydrum.com` → `zh-TW` locale

**대안** (필요시):
- `zhcn.copydrum.com` → `zh-CN` locale (하이픈 제거)
- `zhtw.copydrum.com` → `zh-TW` locale (하이픈 제거)

현재 코드는 두 가지 모두 지원합니다:
```typescript
if (hostWithoutWww.startsWith("zh-cn.") || hostWithoutWww.startsWith("zhcn.")) return "zh-CN";
if (hostWithoutWww.startsWith("zh-tw.") || hostWithoutWww.startsWith("zhtw.")) return "zh-TW";
```

## 📝 예상 동작

### 각 도메인별 동작

1. **자동 언어 감지**
   - 호스트명에서 언어 자동 감지
   - i18n 리소스 자동 로드
   - 메뉴, 버튼, 메시지 모두 해당 언어로 표시

2. **URL 경로 유지**
   - `/sheets` → 모든 언어에서 동일
   - `/mypage` → 모든 언어에서 동일
   - `/cart` → 모든 언어에서 동일

3. **결제 플로우**
   - 한국 사이트: 무통장입금 모달만 표시
   - 글로벌 사이트: PayPal 모달만 표시

4. **언어 선택기**
   - 언어 변경 시 해당 언어 도메인으로 리다이렉트
   - 현재 페이지 경로 유지

## 🔍 문제 해결

### 언어 폴더가 없는 경우

코드는 경고만 출력하고 기본값(한국어)으로 폴백합니다:

```typescript
if (!targetHost) {
    console.warn(`[LanguageSelector] 도메인 매핑이 없습니다: ${langCode}`);
    // 현재 도메인 유지
}
```

### 결제수단이 잘못 표시되는 경우

`src/lib/currency.ts`의 `getSiteCurrency` 함수를 확인하세요:
- 한국 사이트 → KRW → 무통장입금
- 그 외 → USD/JPY → PayPal

## ✅ 완료 체크리스트

- [x] 모든 언어 도메인 매핑 추가
- [x] `getLocaleFromHost.ts` 업데이트
- [x] `languageDomainMap.ts` 업데이트
- [x] `LanguageSelector.tsx` 업데이트
- [x] 결제 규칙 확인 (한국=무통장입금, 글로벌=PayPal)
- [x] zh-CN, zh-TW 하이픈 처리
- [x] 기존 설정 보호 (ko, en, ja 변경 금지)
- [x] 경고 처리 (도메인 매핑 없을 때)

## 📚 관련 파일

- `src/i18n/getLocaleFromHost.ts` - 호스트에서 언어 감지
- `src/config/languageDomainMap.ts` - 언어-도메인 매핑
- `src/components/common/LanguageSelector.tsx` - 언어 선택 UI
- `src/lib/currency.ts` - 통화 결정 로직
- `src/components/payments/PaymentMethodSelector.tsx` - 결제수단 선택
- `src/config/hostType.ts` - 사이트 타입 판단

