import { isKoreanHost } from '../i18n/languages';

const ENV_USD_RATE = Number(import.meta.env.VITE_DEFAULT_USD_RATE);
export const DEFAULT_USD_RATE = Number.isFinite(ENV_USD_RATE) && ENV_USD_RATE > 0 ? ENV_USD_RATE : 0.00077; // ≈ KRW → USD (1 USD ≈ 1,300 KRW)

export interface FormatPriceOptions {
  amountKRW: number | null | undefined;
  usdRate?: number;
  currencyMode?: 'auto' | 'krw' | 'usd';
  locale?: string;
  host?: string;
  language?: string;
}

export interface FormatPriceResult {
  currency: 'KRW' | 'USD';
  amount: number;
  formatted: string;
  isKRW: boolean;
}

const DEFAULTS = {
  localeKR: 'ko-KR',
  localeUS: 'en-US',
};

const getRuntimeUsdRate = () => {
  if (typeof window !== 'undefined') {
    const runtimeRate = Number((window as any).__USD_RATE__);
    if (Number.isFinite(runtimeRate) && runtimeRate > 0) {
      return runtimeRate;
    }
  }
  return undefined;
};

const resolveUsdRate = (overrideRate?: number) => {
  if (Number.isFinite(overrideRate) && overrideRate && overrideRate > 0) {
    return overrideRate;
  }
  const runtimeRate = getRuntimeUsdRate();
  if (Number.isFinite(runtimeRate) && runtimeRate && runtimeRate > 0) {
    return runtimeRate;
  }
  return DEFAULT_USD_RATE;
};

const getHost = (explicitHost?: string) => {
  if (explicitHost) return explicitHost;
  if (typeof window !== 'undefined') {
    return window.location.host;
  }
  return undefined;
};

const formatCurrency = (value: number, locale: string, currency: 'KRW' | 'USD') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value);

export const formatPrice = ({
  amountKRW,
  usdRate,
  currencyMode = 'auto',
  locale,
  host,
  language,
}: FormatPriceOptions): FormatPriceResult => {
  const safeAmount = Number(amountKRW ?? 0);
  const resolvedHost = getHost(host);
  
  // 언어가 영어이고 currencyMode가 auto일 때는 달러 사용
  const isEnglishLanguage = language?.startsWith('en') || (!language && typeof window !== 'undefined' && window.location.hostname.includes('en.copydrum.com'));
  
  const shouldUseKRW =
    currencyMode === 'krw' ||
    (currencyMode === 'auto' && !isEnglishLanguage && isKoreanHost(resolvedHost));
  const appliedUsdRate = resolveUsdRate(usdRate);

  if (shouldUseKRW) {
    return {
      currency: 'KRW',
      amount: safeAmount,
      formatted: formatCurrency(safeAmount, locale ?? DEFAULTS.localeKR, 'KRW'),
      isKRW: true,
    };
  }

  const usdAmountRaw = safeAmount * appliedUsdRate;
  const usdAmount = Math.round(usdAmountRaw * 100) / 100; // round to cents

  return {
    currency: 'USD',
    amount: usdAmount,
    formatted: formatCurrency(usdAmount, locale ?? DEFAULTS.localeUS, 'USD'),
    isKRW: false,
  };
};

export const getCurrencySymbol = (currency: 'KRW' | 'USD') =>
  currency === 'KRW' ? '₩' : '$';

// USD를 KRW로 변환
export const convertUSDToKRW = (usdAmount: number, usdRate?: number): number => {
  const rate = resolveUsdRate(usdRate);
  return Math.round(usdAmount / rate);
};

// KRW를 USD로 변환
export const convertKRWToUSD = (krwAmount: number, usdRate?: number): number => {
  const rate = resolveUsdRate(usdRate);
  return Math.round(krwAmount * rate * 100) / 100;
};

