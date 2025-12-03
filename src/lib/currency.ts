// 지원하는 모든 통화 타입
export type Currency = 
  | 'KRW' 
  | 'USD' 
  | 'JPY' 
  | 'CNY' 
  | 'TWD' 
  | 'EUR' 
  | 'BRL' 
  | 'RUB' 
  | 'THB' 
  | 'VND' 
  | 'IDR' 
  | 'INR' 
  | 'PHP';

// KRW 기준 환율 (1 단위 통화 = KRW_PER_UNIT[currency] 원)
const KRW_PER_UNIT: Record<Currency, number> = {
    KRW: 1,
    USD: 1300,    // 1 USD = 1300 KRW
    JPY: 10,      // 1 JPY = 10 KRW
    CNY: 180,     // 1 CNY = 180 KRW (약 7.2 CNY = 1 USD)
    TWD: 42,      // 1 TWD = 42 KRW (약 31 TWD = 1 USD)
    EUR: 1400,    // 1 EUR = 1400 KRW (약 1.08 EUR = 1 USD)
    BRL: 260,     // 1 BRL = 260 KRW (약 5 BRL = 1 USD)
    RUB: 14,      // 1 RUB = 14 KRW (약 93 RUB = 1 USD)
    THB: 36,      // 1 THB = 36 KRW (약 36 THB = 1 USD)
    VND: 0.052,   // 1 VND = 0.052 KRW (약 25,000 VND = 1 USD)
    IDR: 0.083,   // 1 IDR = 0.083 KRW (약 15,600 IDR = 1 USD)
    INR: 15.6,    // 1 INR = 15.6 KRW (약 83 INR = 1 USD)
    PHP: 23,      // 1 PHP = 23 KRW (약 57 PHP = 1 USD)
};

// Locale → Currency 매핑
const LOCALE_TO_CURRENCY: Record<string, Currency> = {
    'ko': 'KRW',
    'en': 'USD',
    'ja': 'JPY',
    'zh-CN': 'CNY',
    'zh-TW': 'TWD',
    'es': 'EUR',
    'fr': 'EUR',
    'de': 'EUR',
    'pt': 'BRL',
    'it': 'EUR',
    'ru': 'RUB',
    'th': 'THB',
    'vi': 'VND',
    'id': 'IDR',
    'ar': 'USD',
    'hi': 'INR',
    'fil': 'PHP',
    'tr': 'USD',
    'uk': 'USD',
};

// Currency → Locale 매핑 (formatCurrency에서 사용)
const CURRENCY_TO_LOCALE: Record<Currency, string> = {
    'KRW': 'ko-KR',
    'USD': 'en-US',
    'JPY': 'ja-JP',
    'CNY': 'zh-CN',
    'TWD': 'zh-TW',
    'EUR': 'de-DE', // 유럽 표준
    'BRL': 'pt-BR',
    'RUB': 'ru-RU',
    'THB': 'th-TH',
    'VND': 'vi-VN',
    'IDR': 'id-ID',
    'INR': 'hi-IN',
    'PHP': 'en-PH',
};

/**
 * Locale 기반으로 사이트 통화 결정
 * @param hostname 호스트네임 (fallback용, 호환성 유지)
 * @param locale i18n locale (예: 'ko', 'en', 'ja', 'zh-CN' 등)
 * @returns Currency 타입
 */
export function getSiteCurrency(hostname?: string, locale?: string): Currency {
    // 1. Locale 우선 (가장 중요)
    if (locale) {
        // locale이 'ko-KR' 형태일 수도 있으므로 첫 부분만 추출
        const localeCode = locale.split('-')[0];
        if (LOCALE_TO_CURRENCY[localeCode]) {
            const currency = LOCALE_TO_CURRENCY[localeCode];
            // tr, uk 디버깅 로그
            if (localeCode === 'tr' || localeCode === 'uk') {
                console.log(`[Currency] Locale: ${locale} (code: ${localeCode}) → Currency: ${currency}`);
            }
            return currency;
        }
        // 전체 locale도 체크
        if (LOCALE_TO_CURRENCY[locale]) {
            const currency = LOCALE_TO_CURRENCY[locale];
            // tr, uk 디버깅 로그
            if (locale === 'tr' || locale === 'uk' || locale.startsWith('tr-') || locale.startsWith('uk-')) {
                console.log(`[Currency] Locale: ${locale} → Currency: ${currency}`);
            }
            return currency;
        }
    }

    // 2. Fallback: 호스트네임 기반 (기존 호환성 유지)
    if (hostname) {
        if (hostname.includes('en.copydrum.com')) return 'USD';
        if (hostname.includes('jp.copydrum.com') || hostname.includes('ja.copydrum.com')) return 'JPY';
        if (hostname.includes('zh-cn.copydrum.com') || hostname.includes('zhcn.copydrum.com')) return 'CNY';
        if (hostname.includes('zh-tw.copydrum.com') || hostname.includes('zhtw.copydrum.com')) return 'TWD';
        if (hostname.includes('tr.copydrum.com')) {
            console.log(`[Currency] Hostname: ${hostname} → Currency: USD`);
            return 'USD';
        }
        if (hostname.includes('uk.copydrum.com')) {
            console.log(`[Currency] Hostname: ${hostname} → Currency: USD`);
            return 'USD';
        }
        if (hostname.startsWith('en.')) return 'USD';
        if (hostname.startsWith('jp.') || hostname.startsWith('ja.')) return 'JPY';
        if (hostname.startsWith('zh-cn.') || hostname.startsWith('zhcn.')) return 'CNY';
        if (hostname.startsWith('zh-tw.') || hostname.startsWith('zhtw.')) return 'TWD';
        if (hostname.startsWith('tr.')) {
            console.log(`[Currency] Hostname: ${hostname} → Currency: USD`);
            return 'USD';
        }
        if (hostname.startsWith('uk.')) {
            console.log(`[Currency] Hostname: ${hostname} → Currency: USD`);
            return 'USD';
        }
    }

    // 3. 기본값: KRW
    // tr, uk의 경우 기본값이 KRW로 떨어지면 경고
    if (locale) {
        const localeCode = locale.split('-')[0];
        if (localeCode === 'tr' || localeCode === 'uk') {
            console.warn(`[Currency] Warning: Locale ${locale} (code: ${localeCode}) not found in LOCALE_TO_CURRENCY, falling back to KRW. This should not happen!`);
        }
    }
    return 'KRW';
}

/**
 * KRW(원) 기준 금액을 사이트 통화로 변환
 * 
 * @param krw - KRW 금액
 * @param to - 변환할 통화
 * @returns 변환된 금액 (소수점 포함, 반올림하지 않음)
 * 
 * 예시:
 * - convertFromKrw(3000, 'USD') → 2.3076923076923075 (3000 / 1300)
 * - convertFromKrw(3000, 'JPY') → 300 (3000 / 10)
 */
export function convertFromKrw(krw: number, to: Currency): number {
    if (to === 'KRW') return krw;
    const krwPerUnit = KRW_PER_UNIT[to];
    if (!krwPerUnit || krwPerUnit <= 0) return krw;
    
    // 소수점 통화(VND, IDR)는 정수로 반올림
    if (to === 'VND' || to === 'IDR') {
        return Math.round(krw / krwPerUnit);
    }
    
    // 일반 통화는 소수점을 유지하여 반환 (반올림하지 않음)
    // PayPal 등에서 센트 단위로 변환할 때 정확한 계산을 위해 필요
    return krw / krwPerUnit;
}

/**
 * 통화별 표시용 문자열 생성
 * - 리스트/상세/모달 UI에서 사용
 * - Intl.NumberFormat을 사용하여 각 통화의 표준 형식으로 표시
 */
export function formatCurrency(amount: number, currency: Currency): string {
    // TWD는 Intl.NumberFormat이 일관되게 지원하지 않을 수 있으므로 항상 fallback 사용
    if (currency === 'TWD') {
        return `NT$${amount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    const locale = CURRENCY_TO_LOCALE[currency] || 'en-US';
    
    try {
        // Intl.NumberFormat을 사용하여 통화 형식으로 표시
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: (currency === 'KRW' || currency === 'JPY' || currency === 'VND' || currency === 'IDR') ? 0 : 2,
            maximumFractionDigits: (currency === 'KRW' || currency === 'JPY' || currency === 'VND' || currency === 'IDR') ? 0 : 2,
        });
        
        const formatted = formatter.format(amount);
        
        // TWD가 아닌데도 $로 표시되는 경우 체크 (Intl.NumberFormat이 TWD를 지원하지 않는 경우)
        // 이 경우는 이미 위에서 처리했으므로 여기서는 다른 통화만 처리
        return formatted;
    } catch (error) {
        // Intl.NumberFormat이 지원하지 않는 통화인 경우 fallback
        console.warn(`Currency ${currency} not supported by Intl.NumberFormat, using fallback`);
        
        // Fallback: 수동 포맷팅
        switch (currency) {
            case 'USD':
                return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'JPY':
                return `¥${amount.toLocaleString('ja-JP')}`;
            case 'CNY':
                return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'TWD':
                return `NT$${amount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'EUR':
                return `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'BRL':
                return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'RUB':
                return `₽${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'THB':
                return `฿${amount.toLocaleString('th-TH')}`;
            case 'VND':
                return `₫${amount.toLocaleString('vi-VN')}`;
            case 'IDR':
                return `Rp${amount.toLocaleString('id-ID')}`;
            case 'INR':
                return `₹${amount.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'PHP':
                return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'KRW':
            default:
                return `${amount.toLocaleString('ko-KR')}원`;
        }
    }
}
