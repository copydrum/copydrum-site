
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './router'
import { useEffect, Suspense } from 'react'
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary'

function App() {
  useEffect(() => {
    // URL 해시에서 토큰 확인
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      // 비밀번호 재설정 토큰이 있으면 재설정 페이지로 리다이렉트
      window.location.href = '/auth/reset-password' + hash;
    }
  }, []);

  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <Suspense fallback={<div>로딩 중...</div>}>
        <RouteErrorBoundary>
          <AppRoutes />
        </RouteErrorBoundary>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
