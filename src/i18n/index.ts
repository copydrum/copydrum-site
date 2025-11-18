import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import messages from './local/index';
import { supportedLanguages, defaultLanguage, getDefaultLanguageForHost } from './languages';

const getCurrentHostLanguage = () => {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }
  return getDefaultLanguageForHost(window.location.host);
};

const initialLanguage = getCurrentHostLanguage();

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLanguage,
    lng: initialLanguage,
    supportedLngs: supportedLanguages, // 지원하는 언어 목록
    debug: false,
    resources: messages,
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