import type { SupportedLanguage } from "../../config/languageDomainMap";

export function getLocaleFromHost(host: string): SupportedLanguage {
    if (!host) return "ko"; // Default fallback

    const normalizedHost = host.toLowerCase();

    if (normalizedHost.startsWith("en.")) return "en";
    // ✅ 일본어 서브도메인: jp. 또는 ja. 모두 지원
    if (normalizedHost.startsWith("jp.") || normalizedHost.startsWith("ja.")) return "ja";
    if (normalizedHost.startsWith("vi.")) return "vi";

    // Add other languages as needed

    return "ko";
}
