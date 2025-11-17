
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { useEffect, Suspense, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { supabase } from './lib/supabase';
import { CASH_CHARGE_MODAL_EVENT } from './lib/cashChargeModal';
import MobileHeader from './components/mobile/MobileHeader';
import MobileMenuSidebar from './components/mobile/MobileMenuSidebar';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import MobileSearchOverlay from './components/mobile/MobileSearchOverlay';
import MobileCashChargeModal from './components/mobile/MobileCashChargeModal';
import HreflangTags from './components/common/HreflangTags';
import MaintenanceNotice from './components/common/MaintenanceNotice';
import PaymentNotice from './components/common/PaymentNotice';

console.log('VITE_MAINTENANCE_MODE =', import.meta.env.VITE_MAINTENANCE_MODE);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

  useEffect(() => {
    // URL 해시에서 토큰 확인
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    const search = window.location.search;
    
    // confirmation_url이 있으면 리디렉션하지 않음 (reset-password.tsx에서 처리)
    const hasConfirmationUrl = search.includes('confirmation_url');
    
    // 비밀번호 재설정 관련 hash fragment가 있고, 아직 reset-password 페이지가 아닌 경우 리디렉션
    const hasRecoveryToken = hash.includes('access_token') && hash.includes('type=recovery');
    const hasRecoveryError = hash.includes('error') && (hash.includes('otp_expired') || hash.includes('access_denied'));
    
    if ((hasRecoveryToken || hasRecoveryError) && !pathname.includes('/auth/reset-password') && !hasConfirmationUrl) {
      // 비밀번호 재설정 토큰 또는 에러가 있으면 재설정 페이지로 리다이렉트
      // search params는 유지하지 않음 (confirmation_url 제거)
      window.location.replace('/auth/reset-password' + hash);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(currentUser ?? null);
        }
      } catch (error) {
        console.error('앱 사용자 정보 로드 오류:', error);
        if (isMounted) {
          setUser(null);
        }
      }
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOpenCashCharge = () => setIsCashModalOpen(true);

    window.addEventListener(CASH_CHARGE_MODAL_EVENT, handleOpenCashCharge);

    return () => {
      window.removeEventListener(CASH_CHARGE_MODAL_EVENT, handleOpenCashCharge);
    };
  }, []);

  if (isMaintenanceMode) {
    return <MaintenanceNotice />;
  }

  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <Suspense fallback={<div>로딩 중...</div>}>
        <RouteErrorBoundary>
          {/* SEO: hreflang 태그 */}
          <HreflangTags />
          
          {/* 결제 공지 */}
          <PaymentNotice />
          
          <MobileHeader
            user={user}
            onMenuToggle={() => setIsMobileMenuOpen(true)}
            onSearchToggle={() => setIsMobileSearchOpen(true)}
          />
          <MobileMenuSidebar
            user={user ?? null}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          />
          <MobileSearchOverlay
            isOpen={isMobileSearchOpen}
            onClose={() => setIsMobileSearchOpen(false)}
          />
          <MobileCashChargeModal
            isOpen={isCashModalOpen}
            onClose={() => setIsCashModalOpen(false)}
            user={user ?? null}
          />
          <div className="min-h-screen bg-white pb-[80px] md:pb-0" style={{ paddingTop: 'calc(var(--payment-notice-height, 0px) + 108px)' }}>
            <AppRoutes />
          </div>
          <MobileBottomNav
            user={user ?? null}
            onSearchToggle={() => setIsMobileSearchOpen(true)}
            onCashChargeToggle={() => setIsCashModalOpen(true)}
          />
        </RouteErrorBoundary>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
