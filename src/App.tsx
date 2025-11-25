import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './router';
import { useEffect, Suspense, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { supabase } from './lib/supabase';
import MobileHeader from './components/mobile/MobileHeader';
import MobileMenuSidebar from './components/mobile/MobileMenuSidebar';
// MobileBottomNav 제거됨 - 모바일 하단 탭바 제거
import MobileSearchOverlay from './components/mobile/MobileSearchOverlay';
import HreflangTags from './components/common/HreflangTags';
import MaintenanceNotice from './components/common/MaintenanceNotice';
import { recordPageView } from './lib/dashboardAnalytics';

console.log('VITE_MAINTENANCE_MODE =', import.meta.env.VITE_MAINTENANCE_MODE);

interface AppInnerProps {
  user: User | null;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  isMobileSearchOpen: boolean;
  setIsMobileSearchOpen: (v: boolean) => void;
}

function AppInner({
  user,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isMobileSearchOpen,
  setIsMobileSearchOpen,
}: AppInnerProps) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const sessionIdRef = useRef<string | null>(null);
  const previousPathRef = useRef<string>('');

  // 세션 ID 생성 또는 가져오기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SESSION_ID_KEY = 'copydrum_session_id';
    const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30분

    const stored = localStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      try {
        const { sessionId, timestamp } = JSON.parse(stored);
        const now = Date.now();
        if (now - timestamp < SESSION_EXPIRY_MS) {
          sessionIdRef.current = sessionId;
          return;
        }
      } catch {
        // 파싱 실패 시 새로 생성
      }
    }

    // 새 세션 ID 생성
    const newSessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionIdRef.current = newSessionId;
    localStorage.setItem(SESSION_ID_KEY, JSON.stringify({ sessionId: newSessionId, timestamp: Date.now() }));
  }, []);

  // 페이지뷰 기록 (관리자 페이지 제외)
  useEffect(() => {
    if (isAdminPage) return;
    if (typeof window === 'undefined') return;

    const currentPath = location.pathname + location.search;
    
    // 같은 경로로의 중복 기록 방지 (초기 로드 제외)
    if (previousPathRef.current === currentPath && previousPathRef.current !== '') {
      return;
    }
    previousPathRef.current = currentPath;

    // 페이지뷰 기록 (비동기, 에러는 조용히 처리)
    const logPageView = async () => {
      try {
        const pageUrl = window.location.href;
        const referrer = document.referrer || null;
        const userAgent = navigator.userAgent || null;

        await recordPageView({
          user_id: user?.id ?? null,
          session_id: sessionIdRef.current,
          page_url: pageUrl,
          referrer,
          user_agent: userAgent,
        });

        console.log('[PageView] 기록 완료:', { pageUrl, userId: user?.id ?? 'anonymous' });
      } catch (error) {
        // 에러는 조용히 처리 (콘솔에만 기록)
        console.warn('[PageView] 기록 실패:', error);
      }
    };

    // 약간의 지연을 두어 페이지 로드 완료 후 기록
    const timeoutId = setTimeout(() => {
      void logPageView();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, user?.id, isAdminPage]);

  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <RouteErrorBoundary>
        {/* SEO: hreflang 태그 */}
        <HreflangTags />

        {!isAdminPage && (
          <MobileHeader
            user={user}
            onMenuToggle={() => setIsMobileMenuOpen(true)}
            onSearchToggle={() => setIsMobileSearchOpen(true)}
          />
        )}
        <MobileMenuSidebar
          user={user ?? null}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <MobileSearchOverlay
          isOpen={isMobileSearchOpen}
          onClose={() => setIsMobileSearchOpen(false)}
        />
        <div
          className={`min-h-screen bg-white md:pb-0 ${isAdminPage ? '' : 'pt-[160px]'
            } md:pt-0`}
        >
          <AppRoutes />
        </div>
        {/* 모바일 하단 탭바 제거됨 */}
      </RouteErrorBoundary>
    </Suspense>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
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
    const hasRecoveryError =
      hash.includes('error') && (hash.includes('otp_expired') || hash.includes('access_denied'));

    if (
      (hasRecoveryToken || hasRecoveryError) &&
      !pathname.includes('/auth/reset-password') &&
      !hasConfirmationUrl
    ) {
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

  if (isMaintenanceMode) {
    return <MaintenanceNotice />;
  }

  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <AppInner
        user={user}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isMobileSearchOpen={isMobileSearchOpen}
        setIsMobileSearchOpen={setIsMobileSearchOpen}
      />
    </BrowserRouter>
  );
}

export default App;
