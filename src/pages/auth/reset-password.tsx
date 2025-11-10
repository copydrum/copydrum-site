
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    const checkTokenAndSetSession = async () => {
      try {
        // URL에서 파라미터 확인 (hash와 search params 모두 확인)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        // 오류 확인
        const hashError = hashParams.get('error');
        const searchError = searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
        
        if (hashError || searchError) {
          if (hashError === 'access_denied' || searchError === 'access_denied') {
            if (errorDescription?.includes('otp_expired') || errorDescription?.includes('expired')) {
              setError('비밀번호 재설정 링크가 만료되었습니다. 새로운 재설정 링크를 요청해주세요.');
            } else {
              setError('비밀번호 재설정 링크가 유효하지 않습니다. 새로운 재설정 링크를 요청해주세요.');
            }
          } else {
            setError('비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.');
          }
          setCheckingToken(false);
          return;
        }

        // 토큰 확인
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');

        if (!accessToken || type !== 'recovery') {
          setError('유효하지 않은 비밀번호 재설정 링크입니다. 새로운 재설정 링크를 요청해주세요.');
          setCheckingToken(false);
          return;
        }

        // 세션 설정
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('세션 설정 오류:', sessionError);
          setError('비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 새로운 재설정 링크를 요청해주세요.');
          setCheckingToken(false);
          return;
        }

        if (data.session) {
          setIsValidToken(true);
        } else {
          setError('세션을 설정할 수 없습니다. 새로운 재설정 링크를 요청해주세요.');
        }
      } catch (err) {
        console.error('토큰 확인 오류:', err);
        setError('비밀번호 재설정 링크 확인 중 오류가 발생했습니다.');
      } finally {
        setCheckingToken(false);
      }
    };

    checkTokenAndSetSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess('비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.');
      
      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      console.error('비밀번호 변경 오류:', err);
      if (err.message.includes('session_not_found') || err.message.includes('invalid_token')) {
        setError('세션이 만료되었습니다. 새로운 비밀번호 재설정 링크를 요청해주세요.');
      } else {
        setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate('/auth/forgot-password');
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex flex-col items-start">
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif', fontWeight: 800 }}>
                  카피드럼
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">국내 최대 드럼악보 사이트</p>
              </Link>
              <nav className="hidden md:flex space-x-8">
                <a href="/categories" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">악보 카테고리</a>
                <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">신규 악보</a>
                <a href="/event-sale" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">이벤트 할인악보</a>
              </nav>
              <div className="flex items-center space-x-4">
                <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                  <i className="ri-search-line text-xl"></i>
                </button>
                <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                  <i className="ri-shopping-cart-line text-xl"></i>
                </button>
                <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer">
                  로그인
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-16 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="flex justify-center">
              <i className="ri-loader-4-line animate-spin text-4xl text-blue-600"></i>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">링크 확인 중...</h2>
            <p className="mt-2 text-sm text-gray-600">
              비밀번호 재설정 링크를 확인하고 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex flex-col items-start">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif', fontWeight: 800 }}>
                카피드럼
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">국내 최대 드럼악보 사이트</p>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link to="/" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">홈</Link>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">악보 카테고리</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">신규 악보</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">인기 악보</a>
            </nav>
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <i className="ri-search-line text-xl"></i>
              </button>
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <i className="ri-shopping-cart-line text-xl"></i>
              </button>
              <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer">
                로그인
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-16 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {isValidToken ? '새 비밀번호 설정' : '링크 오류'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isValidToken 
              ? '새로운 비밀번호를 입력해주세요.' 
              : '비밀번호 재설정 링크에 문제가 있습니다.'
            }
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {!isValidToken ? (
              <div className="text-center space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <div className="space-y-4">
                  <p className="text-gray-600 text-sm">
                    비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. 
                    새로운 재설정 링크를 요청해주세요.
                  </p>
                  
                  <button
                    onClick={handleRequestNewLink}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap cursor-pointer"
                  >
                    새 재설정 링크 요청하기
                  </button>
                  
                  <Link 
                    to="/login" 
                    className="block text-center font-medium text-blue-600 hover:text-blue-500 cursor-pointer"
                  >
                    로그인으로 돌아가기
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
                    {success}
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    새 비밀번호
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="새 비밀번호를 입력하세요 (8자 이상)"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    8자 이상, 영문, 숫자, 특수문자 조합
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    비밀번호 확인
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="비밀번호를 다시 입력하세요"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        변경 중...
                      </div>
                    ) : (
                      '비밀번호 변경'
                    )}
                  </button>
                </div>
              </form>
            )}

            {isValidToken && (
              <div className="mt-6 text-center">
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                  로그인으로 돌아가기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-xl font-bold mb-4" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif', fontWeight: 800 }}>
                카피드럼
              </h4>
              <p className="text-gray-400 mb-4">
                전문 드러머를 위한 최고 품질의 드럼 악보를 제공합니다.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                  <i className="ri-facebook-fill text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                  <i className="ri-instagram-line text-xl"></i>
                </a>
                <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                  <i className="ri-youtube-fill text-xl"></i>
                </a>
              </div>
            </div>
            <div>
              <h5 className="font-semibold mb-4">악보 카테고리</h5>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">록 드럼</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">재즈 드럼</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">팝 드럼</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">메탈 드럼</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">고객 지원</h5>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">자주 묻는 질문</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">다운로드 가이드</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">환불 정책</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">문의하기</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">회사 정보</h5>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">회사 소개</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">이용약관</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">개인정보처리방침</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white cursor-pointer">파트너십</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 카피드럼. All rights reserved. | 
              <a href="https://readdy.ai/?origin=logo" className="text-gray-400 hover:text-white ml-1 cursor-pointer">
                Website Builder
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
