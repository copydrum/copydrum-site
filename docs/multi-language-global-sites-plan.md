# Multi-Language Global Sites Expansion Plan

## 1. Current Architecture Analysis

### Domain & Routing
Currently, the application distinguishes between Korean and English sites based on the hostname at runtime.
- **Korean (`ko`)**: `copydrum.com`, `www.copydrum.com`, `localhost` (default)
- **English (`en`)**: `en.copydrum.com`, `localhost?lang=en`

This logic is centralized in `src/i18n/languages.ts`:
- `isEnglishHost(host)`: Checks for `en.copydrum.com` or `lang=en` query param.
- `isKoreanPrimaryHost(host)`: Checks for `copydrum.com` or default fallback.
- `getDefaultLanguageForHost(host)`: Returns 'en' or 'ko' based on the above.

### i18n Structure
The project uses `react-i18next` with a hybrid approach for translation resources:
1.  **Legacy/TypeScript**: `src/i18n/local/index.ts` (likely older structure).
2.  **JSON Modules**: `src/i18n/locales/{lang}/{namespace}.json`.
    -   Loaded dynamically via `import.meta.glob`.
    -   Flattened and merged into the resource bundle.
    -   Namespace is used as a prefix (e.g., `auth.login` comes from `auth.json`).

### PayPal Integration
PayPal integration is handled in `src/lib/payments/portone.ts` and `src/components/payments/PayPalPaymentModal.tsx`.
-   It uses the PortOne V2 SDK.
-   It is currently triggered when the payment method is 'paypal', which is typically enabled for the English site.

## 2. Expansion Plan (Template-Based)

To support `ja.copydrum.com`, `vi.copydrum.com`, etc., we will extend the current pattern without modifying the existing `ko` and `en` logic.

### (1) Domain Mapping Strategy
We will introduce a configuration map to define the relationship between domains and languages. This will replace or augment the hardcoded checks in `src/i18n/languages.ts`.

**Proposed Structure:**
```typescript
export const LANGUAGE_DOMAIN_MAP = {
  ko: 'https://copydrum.com',
  en: 'https://en.copydrum.com',
  ja: 'https://ja.copydrum.com',
  vi: 'https://vi.copydrum.com',
  // ... others
} as const;
```

### (2) Currency Mapping Strategy
Each language/region will have a primary currency.

**Proposed Structure:**
```typescript
export const CURRENCY_BY_LOCALE = {
  ko: 'KRW',
  en: 'USD',
  ja: 'JPY',
  vi: 'VND',
  fr: 'EUR',
  // ... others
} as const;
```

### (3) Folder Structure for New Languages
We will replicate the `en` folder structure in `src/i18n/locales` for new languages.

```
src/i18n/locales/
├── en/
│   ├── common.json
│   ├── auth.json
│   └── ...
├── ko/
│   └── ...
├── ja/ (New)
│   ├── common.json (Copy of en/common.json)
│   └── ...
└── vi/ (New)
    └── ...
```

### (4) Runtime Logic Updates (Future Work)
When implementing the actual expansion, we will need to:
1.  Update `src/i18n/languages.ts` to import and use the new configuration maps.
2.  Update `getDefaultLanguageForHost` to check against the new domains.
3.  Ensure `PayPalPaymentModal` and other payment logic respect the `CURRENCY_BY_LOCALE` setting instead of hardcoding USD for non-KRW.

## 3. Proposed Templates

We will create the following template files to facilitate this expansion:

1.  `src/config/languageDomainMap.template.ts`: Defines the domain-language mapping.
2.  `src/config/currencyByLocale.template.ts`: Defines the currency-language mapping.
3.  `src/i18n/locales/ja.template.json`: A sample translation file for Japanese (based on English).

These files will be created but **not imported** by the application code, ensuring zero impact on production.
