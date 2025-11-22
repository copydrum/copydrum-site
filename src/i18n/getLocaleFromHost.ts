import type { SupportedLanguage } from "../../config/languageDomainMap";

export function getLocaleFromHost(host: string): SupportedLanguage {
    if (!host) return "ko"; // Default fallback

    const normalizedHost = host.toLowerCase();

    // www 제거 (www.copydrum.com → copydrum.com)
    const hostWithoutWww = normalizedHost.replace(/^www\./, '');

    // 영어 서브도메인 확인
    if (hostWithoutWww.startsWith("en.")) return "en";
    
    // ✅ 일본어 서브도메인: jp. 또는 ja. 모두 지원
    if (hostWithoutWww.startsWith("jp.") || hostWithoutWww.startsWith("ja.")) return "ja";
    
    // 베트남어 서브도메인
    if (hostWithoutWww.startsWith("vi.")) return "vi";

    // copydrum.com 또는 www.copydrum.com은 한국어
    if (hostWithoutWww === "copydrum.com") return "ko";

    // Add other languages as needed

    // 기본값: 한국어 (copydrum.com은 한국어 사이트)
    return "ko";
}
