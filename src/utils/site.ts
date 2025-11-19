import { isEnglishHost } from '../i18n/languages';

/**
 * 현재 사이트가 영문 사이트인지 확인하는 함수
 * SSR 안전성을 위해 window 객체 체크를 포함합니다.
 * 
 * @returns {boolean} 영문 사이트(en.copydrum.com)인 경우 true, 그렇지 않으면 false
 */
export function isEnglishSite(): boolean {
  if (typeof window === 'undefined') {
    // SSR 단계에서는 일단 false 반환 (필요 시 조정)
    return false;
  }
  
  const hostname = window.location.hostname;
  // isEnglishHost 함수를 사용하여 영문 사이트 여부 확인
  return isEnglishHost(window.location.host);
}

