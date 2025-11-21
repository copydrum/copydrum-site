// ⚠ 현재는 어디에서도 import하지 않는 템플릿 파일입니다.
// 향후 ja.copydrum.com, vi.copydrum.com 등을 열 때 사용할 예정입니다.

export const languageDomainMap = {
    ko: "https://copydrum.com",
    en: "https://en.copydrum.com",
    ja: "https://ja.copydrum.com",
    vi: "https://vi.copydrum.com",
    fr: "https://fr.copydrum.com",
    de: "https://de.copydrum.com",
    es: "https://es.copydrum.com",
    pt: "https://pt.copydrum.com",
    // TODO: 나머지 17개 언어 도메인을 여기서 관리
} as const;

export type SupportedLanguage = keyof typeof languageDomainMap;
