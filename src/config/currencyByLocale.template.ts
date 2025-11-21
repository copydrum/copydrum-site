// ⚠ 현재는 어디에서도 import하지 않는 템플릿 파일입니다.
// 향후 글로벌 사이트에서 통화 표시/결제 요청에 사용할 예정입니다.

export const currencyByLocale = {
    ko: "KRW",
    en: "USD",
    ja: "JPY",
    vi: "VND",
    fr: "EUR",
    de: "EUR",
    es: "EUR",
    pt: "EUR",
    // TODO: 나머지 언어와 통화 매핑 추가
} as const;

export type SupportedCurrency = typeof currencyByLocale[keyof typeof currencyByLocale];
