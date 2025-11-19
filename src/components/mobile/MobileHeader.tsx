import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../common/LanguageSelector';
import { isEnglishHost } from '../../i18n/languages';

interface MobileHeaderProps {
  user?: User | null;
  onMenuToggle: () => void;
  onSearchToggle: () => void;
}

export default function MobileHeader({
  user,
  onMenuToggle,
  onSearchToggle,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const siteName = t('site.name');
  const isEnglishSite = typeof window !== 'undefined' && isEnglishHost(window.location.host);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-blue-700 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={t('mobile.header.openMenu')}
          className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-blue-600 transition-colors"
        >
          <i className="ri-menu-line text-2xl" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex flex-col items-center justify-center"
          aria-label={t('mobile.header.goHome', { site: siteName })}
        >
          <img
            src="/logo.png"
            alt={siteName}
            className="h-10 w-auto"
          />
          {!isEnglishSite && (
            <span className="text-xs font-semibold mt-1 tracking-wide">
              {siteName}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onSearchToggle}
          aria-label={t('mobile.header.openSearch')}
          className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-blue-600 transition-colors"
        >
          <i className="ri-search-line text-2xl" />
        </button>
      </div>
      <div className="px-4 pb-3 flex justify-center">
        <LanguageSelector variant="mobile" />
      </div>
    </header>
  );
}


