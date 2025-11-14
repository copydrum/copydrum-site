import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, getLanguageByCode } from '../../i18n/languages';

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
    i18n.changeLanguage(langCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', langCode);
    }
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
              className={`w-full flex items-center space-x-3 px-4 py-2 hover:bg-blue-50 transition-colors duration-150 ${
                currentLanguage.code === lang.code ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
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

