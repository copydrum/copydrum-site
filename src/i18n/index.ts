import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import messages from './local/index';
import { supportedLanguages, defaultLanguage } from './languages';

// JSON 기반 번역 파일 로드
const jsonModules = import.meta.glob('./locales/*/*.json', { eager: true });

const jsonMessages: Record<string, { translation: Record<string, any> }> = {};

Object.keys(jsonModules).forEach((path) => {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const [, lang, fileName] = match;
    const module = jsonModules[path] as { default?: Record<string, any> };

    if (!jsonMessages[lang]) {
      jsonMessages[lang] = { translation: {} };
    }

    // JSON 파일 내용을 파일명을 키로 하여 직접 병합
    // 예: authLogin.json -> authLogin.title 형태로 접근 가능하도록
    if (module.default) {
      // JSON 내용을 평탄화하여 파일명을 prefix로 추가
      const flattenJson = (obj: Record<string, any>, prefix = ''): Record<string, any> => {
        const result: Record<string, any> = {};
        Object.keys(obj).forEach((key) => {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flattenJson(obj[key], newKey));
          } else {
            result[newKey] = obj[key];
          }
        });
        return result;
      };

      const flattened = flattenJson(module.default, fileName);
      Object.assign(jsonMessages[lang].translation, flattened);
    }
  }
});

// 기존 TypeScript 번역과 JSON 번역 병합
const mergedMessages: Record<string, { translation: Record<string, any> }> = { ...messages };

Object.keys(jsonMessages).forEach((lang) => {
  if (!mergedMessages[lang]) {
    mergedMessages[lang] = { translation: {} };
  }
  // JSON 번역을 기존 번역에 병합 (JSON이 우선순위)
  mergedMessages[lang].translation = {
    ...mergedMessages[lang].translation,
    ...jsonMessages[lang].translation,
  };
});

import { getLocaleFromHost } from './getLocaleFromHost';

const getCurrentHostLanguage = () => {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }

  // 1. Query Param Check (Preserve existing dev/testing behavior)
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  if (langParam && supportedLanguages.includes(langParam)) {
    return langParam;
  }
  if (params.get('en') === 'true') {
    return 'en';
  }

  // 2. Hostname Check (New logic)
  return getLocaleFromHost(window.location.host);
};

const initialLanguage = getCurrentHostLanguage();

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLanguage,
    lng: initialLanguage,
    supportedLngs: supportedLanguages, // 지원하는 언어 목록
    debug: false,
    resources: mergedMessages,
    interpolation: {
      escapeValue: false, // React에서는 XSS 보호가 자동으로 됨
    },
  });

// 도메인 기반 언어 강제 설정
if (typeof window !== 'undefined') {
  const domainLanguage = getCurrentHostLanguage();
  if (i18n.language !== domainLanguage) {
    i18n.changeLanguage(domainLanguage);
  }

  // 언어 변경 시 항상 도메인 기반 언어로 강제
  i18n.on('languageChanged', (lng) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lng;
    }

    // 도메인 기반 언어와 다르면 강제로 변경
    const domainLanguage = getCurrentHostLanguage();
    if (lng !== domainLanguage) {
      i18n.changeLanguage(domainLanguage);
    }
  });
}

export default i18n;