import type { User } from '@supabase/supabase-js';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/supabase';
import { googleAuth } from '../../lib/google';
import { formatPrice } from '../../lib/priceFormatter';
import { getUserDisplayName } from '../../utils/userDisplayName';
import { getActiveCurrency } from '../../lib/payments/getActiveCurrency';
import { convertPriceForLocale } from '../../lib/pricing/convertForLocale';
import { formatCurrency as formatCurrencyUi } from '../../lib/pricing/formatCurrency';
import { useUserCashBalance } from '../../hooks/useUserCashBalance';

interface MobileMenuSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

interface NavItem {
  labelKey: string;
  href: string;
  icon: string;
}

const menuItems: NavItem[] = [
  { labelKey: 'nav.categories', href: '/categories', icon: 'ri-apps-line' },
  { labelKey: 'nav.freeSheets', href: '/free-sheets', icon: 'ri-music-line' },
  { labelKey: 'nav.collections', href: '/collections', icon: 'ri-album-line' },
  { labelKey: 'nav.eventSale', href: '/event-sale', icon: 'ri-fire-line' },
  { labelKey: 'nav.customOrder', href: '/custom-order', icon: 'ri-edit-line' },
];

export default function MobileMenuSidebar({
  isOpen,
  onClose,
  user,
}: MobileMenuSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);

  // 마이페이지와 동일한 훅 사용 (통일된 캐시 잔액 조회)
  const { credits: userCash, loading: cashLoading, error: cashError } = useUserCashBalance(user);

  const greeting = useMemo(() => {
    if (!user) {
      return t('auth.loginRequired');
    }
    const name = getUserDisplayName(profile, user.email || null);
    return t('mobile.menu.greeting', { name });
  }, [t, user, profile]);

  const formatCurrency = useCallback(
    (value: number) => {
      if (i18n.language === 'ko') {
        return formatPrice({ amountKRW: value, language: 'ko' }).formatted;
      }
      const currency = getActiveCurrency();
      const converted = convertPriceForLocale(value, i18n.language, currency);
      return formatCurrencyUi(converted, currency);
    },
    [i18n.language],
  );

  // 프로필 정보 로드 (display_name, email 등)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('모바일 프로필 조회 오류:', error);
          return;
        }

        if (data) {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error('모바일 프로필 로드 오류:', error);
      }
    };

    if (isOpen) {
      void loadProfile();
    }
  }, [isOpen, user]);

  const handleNavigate = (href: string) => {
    navigate(href);
    onClose();
  };

  const handleLogout = async () => {
    try {
      // 구글 로그아웃
      if (googleAuth.isLoggedIn()) {
        googleAuth.logout();
      }

      // Supabase 로그아웃
      await supabase.auth.signOut();
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="absolute inset-y-0 left-0 flex h-full w-72 flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t('site.name')}</p>
            {user ? (
              <>
                <p className="text-xs text-gray-500 mt-1">{greeting}</p>
                <div className="mt-2 flex items-center gap-2">
                  <i className="ri-wallet-3-line text-blue-600"></i>
                  <span className="text-xs text-gray-600">보유 악보캐쉬</span>
                  {cashLoading ? (
                    <span className="text-sm font-bold text-blue-400 animate-pulse">{t('sidebar.loading')}</span>
                  ) : cashError ? (
                    <span className="text-sm font-bold text-red-500">{t('sidebar.error')}</span>
                  ) : (
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(userCash)}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-1">{greeting}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('mobile.menu.close')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavigate(item.href)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-white text-gray-700 border border-gray-100 hover:bg-gray-50'
                  }`}
              >
                <i
                  className={`${item.icon} mr-3 text-lg ${isActive ? 'text-blue-500' : 'text-gray-400'
                    }`}
                />
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 px-5 py-4 pb-24 space-y-2">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => handleNavigate('/mypage')}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                {t('nav.mypage')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <i className="ri-logout-box-line mr-2"></i>
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleNavigate('/login')}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              {t('nav.login')} / {t('nav.register')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}


