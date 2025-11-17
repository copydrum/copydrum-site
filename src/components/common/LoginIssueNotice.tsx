import { useState, useEffect } from 'react';

export default function LoginIssueNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // localStorage에서 닫힘 상태 확인
    const isDismissed = localStorage.getItem('loginIssueNoticeDismissed');
    // 임시: 항상 표시 (테스트용)
    setIsVisible(true);
    // 원래 코드: if (!isDismissed) { setIsVisible(true); }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    // 24시간 동안 다시 보지 않기
    localStorage.setItem('loginIssueNoticeDismissed', 'true');
    // 24시간 후 자동으로 다시 표시되도록 설정 (선택사항)
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('loginIssueNoticeExpiry', expiryTime.toString());
  };

  // 만료 시간 확인 (24시간 후 다시 표시)
  useEffect(() => {
    const expiry = localStorage.getItem('loginIssueNoticeExpiry');
    if (expiry && Date.now() > parseInt(expiry)) {
      localStorage.removeItem('loginIssueNoticeDismissed');
      localStorage.removeItem('loginIssueNoticeExpiry');
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="닫기"
        >
          <i className="ri-close-line text-2xl" aria-hidden />
        </button>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <i className="ri-information-line text-2xl text-blue-600" aria-hidden />
            <h2 className="text-xl font-bold text-gray-900">공지사항</h2>
          </div>
          
          <div className="space-y-3 text-gray-700 leading-relaxed">
            <p>
              홈페이지 리뉴얼 작업으로 인해 현재 <strong className="text-red-600">로그인 및 비밀번호 재설정 기능</strong>에 일시적인 문제가 발생하고 있습니다.
            </p>
            <p>
              빠른 시일 내에 복구하도록 조치 중입니다.
            </p>
            <p className="text-sm text-gray-600 pt-2">
              불편을 드려 죄송합니다. 곧 정상적으로 이용하실 수 있도록 하겠습니다.
            </p>
          </div>
          
          <button
            onClick={handleClose}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

