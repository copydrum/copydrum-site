import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PortOneReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // URL 파라미터 확인
    const code = searchParams.get('code'); // 에러 코드
    const message = searchParams.get('message'); // 에러 메시지

    // 화면이 깜빡이는 것을 방지하기 위해 0.5초 뒤 실행
    const timer = setTimeout(() => {
      if (code && code !== '0') {
        // 결제 실패 시
        alert(`결제에 실패했습니다.\n${message || ''}`);
        navigate('/'); // 메인으로 이동
      } else {
        // 결제 성공 시 -> 구매내역 페이지로 이동
        // alert('결제가 완료되었습니다.'); // (선택사항) 알림이 필요 없으면 이 줄 삭제
        navigate('/purchases'); // ✅ 사장님이 원하신 주소
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [navigate, searchParams]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">결제 확인 중입니다...</p>
    </div>
  );
}

