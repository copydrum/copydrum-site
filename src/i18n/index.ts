import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import messages from './local/index';
import { supportedLanguages, defaultLanguage, getDefaultLanguageForHost } from './languages';

const getCurrentHostLanguage = () => {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }
  return getDefaultLanguageForHost(window.location.host);
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector({
  name: 'domainDetector',
  lookup() {
    return getCurrentHostLanguage();
  },
  cacheUserLanguage() {},
});

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLanguage,
    lng: getCurrentHostLanguage(),
    supportedLngs: supportedLanguages, // 지원하는 언어 목록
    debug: false,
    resources: messages,
    interpolation: {
      escapeValue: false, // React에서는 XSS 보호가 자동으로 됨
    },
    detection: {
      order: ['localStorage', 'domainDetector'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;