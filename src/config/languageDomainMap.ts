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
