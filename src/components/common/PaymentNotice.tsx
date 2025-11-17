import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { isEnglishHost } from '../../i18n/languages';

export default function PaymentNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();
  const isEnglish = typeof window !== 'undefined' && isEnglishHost(window.location.host);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // localStorage에서 닫힘 상태 확인
    const isDismissed = localStorage.getItem('paymentNoticeDismissed');
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  // PaymentNotice 높이를 CSS 변수로 설정 (모바일 헤더 위치 조정용)
  useEffect(() => {
    if (isVisible && noticeRef.current) {
      const height = noticeRef.current.offsetHeight;
      document.documentElement.style.setProperty('--payment-notice-height', `${height}px`);
    } else {
      document.documentElement.style.setProperty('--payment-notice-height', '0px');
    }
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    // 24시간 동안 다시 보지 않기
    localStorage.setItem('paymentNoticeDismissed', 'true');
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('paymentNoticeExpiry', expiryTime.toString());
  };

  // 만료 시간 확인 (24시간 후 다시 표시)
  useEffect(() => {
    const expiry = localStorage.getItem('paymentNoticeExpiry');
    if (expiry && Date.now() > parseInt(expiry)) {
      localStorage.removeItem('paymentNoticeDismissed');
      localStorage.removeItem('paymentNoticeExpiry');
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div ref={noticeRef} className="fixed top-0 left-0 right-0 z-[100] bg-yellow-50 border-b border-yellow-200 px-4 py-3 md:relative md:z-auto md:top-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <i className="ri-information-line text-xl text-yellow-600 flex-shrink-0" aria-hidden />
          <p className="text-sm sm:text-base text-yellow-800 font-medium">
            {isEnglish 
              ? 'We are currently working on a site renewal, so sheet music purchases are temporarily unavailable. We will restore normal service shortly.'
              : '현재 사이트 리뉴얼 작업 중으로, 악보 결제는 어렵습니다. 곧 정상화하겠습니다.'}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="text-yellow-600 hover:text-yellow-800 transition-colors flex-shrink-0"
          aria-label={t('button.close')}
        >
          <i className="ri-close-line text-xl" aria-hidden />
        </button>
      </div>
    </div>
  );
}

