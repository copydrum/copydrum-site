export type Currency = 'KRW' | 'USD' | 'JPY';

const KRW_PER_UNIT: Record<Currency, number> = {
    KRW: 1,
    USD: 1300, // 1 USD = 1300 KRW
    JPY: 10,   // 1 JPY = 10 KRW
};

/**
 * 호스트네임에 따라 사이트 통화 결정
 * - en.copydrum.com → USD
 * - jp.copydrum.com → JPY
 * - 그 외 → KRW
 */
export function getSiteCurrency(hostname: string): Currency {
    if (hostname.includes('en.copydrum.com')) return 'USD';
    if (hostname.includes('jp.copydrum.com') || hostname.includes('ja.copydrum.com')) return 'JPY';

    // Also check for startsWith for local dev or other environments
    if (hostname.startsWith('en.')) return 'USD';
    if (hostname.startsWith('jp.') || hostname.startsWith('ja.')) return 'JPY';

    return 'KRW';
}

/**
 * KRW(원) 기준 금액을 사이트 통화로 변환
 */
export function convertFromKrw(krw: number, to: Currency): number {
    if (to === 'KRW') return krw;
    const krwPerUnit = KRW_PER_UNIT[to];
    if (!krwPerUnit) return krw;
    return Math.round(krw / krwPerUnit);
}

/**
 * 통화별 표시용 문자열 생성
 * - 리스트/상세/모달 UI에서 사용
 */
export function formatCurrency(amount: number, currency: Currency): string {
    switch (currency) {
        case 'USD':
            return `$${amount.toLocaleString('en-US')}`;
        case 'JPY':
            return `¥${amount.toLocaleString('ja-JP')}`;
        case 'KRW':
        default:
            return `${amount.toLocaleString('ko-KR')}원`;
    }
}
