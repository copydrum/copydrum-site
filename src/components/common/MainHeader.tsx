import { useMemo, useState, type KeyboardEvent, type ChangeEvent } from 'react';
import { createSearchParams, useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { googleAuth } from '../../lib/google';
import LanguageSelector from './LanguageSelector';
import { isGlobalSiteHost } from '../../config/hostType';

interface MainHeaderProps {
  user?: User | null;
}

export default function MainHeader({ user }: MainHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isGlobalSite = typeof window !== 'undefined' && isGlobalSiteHost(window.location.host);
  // location.search dependency is implicit because useLocation() triggers re-render

  const navItems = useMemo(
    () => [
      { label: t('nav.categories'), href: '/categories' },
      { label: t('nav.freeSheets'), href: '/free-sheets' },
      { label: t('nav.collections'), href: '/collections' },
      { label: t('nav.eventSale'), href: '/event-sale' },
      { label: t('nav.customOrder'), href: '/custom-order' },
    ],
    [t],
  );

  const containerClassName = useMemo(() => {
    const classes = ['hidden', 'md:block', 'bg-blue-700'];
    if (user) {
      classes.push('md:mr-64');
    }
    return classes.join(' ');
  }, [user]);

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    const searchParams = createSearchParams({ search: trimmed });
    navigate({ pathname: '/categories', search: `?${searchParams.toString()}` });
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleLogout = async () => {
    try {
      // 구글 로그아웃
      if (googleAuth.isLoggedIn()) {
        googleAuth.logout();
      }

      // Supabase 로그아웃
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  return (
    <div className={containerClassName}>
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-4 py-4">
        <div className="flex justify-end items-center gap-3">
          {user && (
            <button
              onClick={handleLogout}
              className="text-white hover:text-purple-300 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            >
              {t('nav.logout')}
            </button>
          )}
          <LanguageSelector />
        </div>
        {/* Logo, Search & Cart Row */}
        <div className="flex items-center relative">
          {/* Logo */}
          <div className="flex items-center -ml-4 absolute left-0">
            <img
              src="/logo.png"
              alt={t('site.name')}
              className={`h-12 w-auto cursor-pointer ${isGlobalSite ? '' : 'mr-3'}`}
              onClick={() => navigate('/')}
            />
            {!isGlobalSite && (
              <h1
                className="text-2xl font-bold text-white cursor-pointer"
                style={{ fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}
                onClick={() => navigate('/')}
              >
                {t('site.name')}
              </h1>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={handleChange}
                onKeyDown={handleKeyPress}
                className="w-full px-6 py-3 text-base border-0 rounded-full focus:outline-none pr-12 bg-blue-50 placeholder-gray-400 text-gray-900"
              />
              <button
                onClick={handleSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-700 cursor-pointer transition-colors duration-200"
              >
                <i className="ri-search-line text-xl"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex items-center justify-center space-x-8 pb-2">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.href);
              }}
              className="text-white hover:text-purple-300 hover:underline font-semibold text-lg whitespace-nowrap cursor-pointer transition-all duration-200"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

