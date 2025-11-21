import type { SupportedLanguage } from "../../config/languageDomainMap";

export function getLocaleFromHost(host: string): SupportedLanguage {
    if (!host) return "ko"; // Default fallback

    const normalizedHost = host.toLowerCase();

    if (normalizedHost.startsWith("en.")) return "en";
    if (normalizedHost.startsWith("ja.")) return "ja";
    if (normalizedHost.startsWith("vi.")) return "vi";

    // Add other languages as needed

    return "ko";
}
