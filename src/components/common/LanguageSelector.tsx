import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { languages, getLanguageByCode } from '../../i18n/languages';
import { isGlobalSiteHost } from '../../config/hostType';

interface LanguageSelectorProps {
  variant?: 'desktop' | 'mobile';
  className?: string;
}

const buttonClassesByVariant: Record<'desktop' | 'mobile', string> = {
  desktop:
    'flex items-center space-x-2 px-4 py-2 text-blue-700 bg-white rounded-full border border-blue-100 shadow-sm hover:bg-blue-50 transition-colors duration-200',
  mobile:
    'flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-700 bg-white rounded-full border border-blue-100 shadow-sm',
};

const menuAlignmentByVariant: Record<'desktop' | 'mobile', string> = {
  desktop: 'right-0',
  mobile: 'left-0',
};

export default function LanguageSelector({ variant = 'desktop', className = '' }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = useMemo(
    () => getLanguageByCode(i18n.language) || languages[0],
    [i18n.language],
  );

  const renderFlag = (flagCode: string, flagEmoji: string, size: 24 | 20 = 24) => {
    if (!flagCode) {
      return (
        <span className="text-xl" aria-hidden="true">
          {flagEmoji}
        </span>
      );
    }

    const dimension = size === 24 ? 'w24' : 'w20';
    return (
      <img
        src={`https://flagcdn.com/${dimension}/${flagCode}.png`}
        alt=""
        width={size}
        height={Math.round((size * 3) / 4)}
        className="rounded-sm object-cover"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  };

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (langCode: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentHost = window.location.host;
    const currentPath = location.pathname + location.search;
    const isCurrentlyGlobal = isGlobalSiteHost(currentHost);
    const wantsEnglish = langCode === 'en';
    const wantsKorean = langCode === 'ko';

    // 로컬 환경에서는 도메인 변경 대신 쿼리 파라미터 사용
    if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
      const searchParams = new URLSearchParams(window.location.search);

      // 한국어(기본값)인 경우 파라미터 제거, 그 외에는 lang 파라미터 설정
      if (langCode === 'ko') {
        searchParams.delete('lang');
        searchParams.delete('en'); // 레거시 파라미터 제거
      } else {
        searchParams.set('lang', langCode);
        searchParams.delete('en'); // 레거시 파라미터 제거
      }

      window.location.search = searchParams.toString();
      return;
    }

    // 호스트 변경이 필요한 경우 (영어 <-> 한국어 등 도메인 분리된 언어)
    // 현재는 en.copydrum.com / copydrum.com / ja.copydrum.com(예정) 등
    // 로컬이 아닌 프로덕션 환경에서의 도메인 전환 로직

    // TODO: 추후 ja.copydrum.com 등 서브도메인이 실제 운영되면 해당 로직 추가 필요
    // 현재는 영어/한국어 전환만 도메인 이동으로 처리하고, 나머지는 i18n.changeLanguage로 처리하거나
    // 아직 도메인이 없으므로 동작하지 않게 둠.

    if ((isCurrentlyGlobal && wantsKorean) || (!isCurrentlyGlobal && wantsEnglish)) {
      let targetHost: string;

      if (wantsEnglish) {
        // 한국어 사이트에서 영어 사이트로 이동
        targetHost = currentHost.replace(/^(www\.)?copydrum\.com$/, 'en.copydrum.com');
        if (targetHost === currentHost) {
          // 이미 en.copydrum.com이거나 다른 서브도메인인 경우
          targetHost = 'en.copydrum.com';
        }
      } else {
        // 영어 사이트에서 한국어 사이트로 이동
        targetHost = currentHost.replace(/^en\.copydrum\.com$/, 'copydrum.com');
        if (targetHost === currentHost) {
          // 이미 copydrum.com이거나 다른 도메인인 경우
          targetHost = 'copydrum.com';
        }
      }

      // 프로토콜 포함 전체 URL 생성
      const protocol = window.location.protocol;
      const targetUrl = `${protocol}//${targetHost}${currentPath}`;

      // 호스트 변경하여 리다이렉트
      window.location.href = targetUrl;
      return;
    }

    // 같은 언어 그룹 내에서만 언어 변경 (예: 영어 -> 일본어)
    // 주의: 도메인 기반 언어 강제 정책으로 인해 실제로는 도메인 언어로 리셋될 수 있음
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 언어 선택 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassesByVariant[variant]}
        aria-label="언어 선택"
      >
        <span className="flex items-center gap-2">
          {renderFlag(currentLanguage.flagCode, currentLanguage.flagEmoji)}
        </span>
        <span className="font-medium">{currentLanguage.nativeName}</span>
        <span className="text-xs uppercase text-gray-500">{currentLanguage.code}</span>
        <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line text-lg`}></i>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div
          className={`absolute ${menuAlignmentByVariant[variant]} mt-3 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto`}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center space-x-3 px-4 py-2 hover:bg-blue-50 transition-colors duration-150 ${currentLanguage.code === lang.code ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                {renderFlag(lang.flagCode, lang.flagEmoji, 20)}
              </span>
              <div className="flex-1 text-left">
                <div className="font-medium">{lang.nativeName}</div>
                <div className="text-xs text-gray-500">{lang.name}</div>
              </div>
              {currentLanguage.code === lang.code && (
                <i className="ri-check-line text-blue-600"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

