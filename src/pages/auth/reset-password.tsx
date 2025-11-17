
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Footer from '../../components/common/Footer';

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
        // window.location을 직접 사용하여 React Router의 영향을 받지 않도록 함
        const fullUrl = window.location.href;
        const urlObj = new URL(fullUrl);
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        const searchParams = new URLSearchParams(urlObj.search);
        
        console.log('reset-password 페이지 로드:', {
          fullUrl: fullUrl.substring(0, 200), // URL이 길 수 있으므로 처음 200자만
          hash: urlObj.hash,
          search: urlObj.search,
          pathname: urlObj.pathname,
        });
        
        // 먼저 hash fragment에 토큰이 있는지 확인 (Supabase가 직접 리디렉션한 경우)
        const accessTokenFromHash = hashParams.get('access_token');
        const refreshTokenFromHash = hashParams.get('refresh_token');
        const typeFromHash = hashParams.get('type');
        
        console.log('Hash fragment 확인:', {
          hasAccessToken: !!accessTokenFromHash,
          hasRefreshToken: !!refreshTokenFromHash,
          type: typeFromHash,
        });
        
        // confirmation_url 쿼리 파라미터 확인 (이메일 prefetch 문제 해결을 위한 사용자 정의 링크)
        const confirmationUrl = searchParams.get('confirmation_url');
        
        console.log('confirmation_url 확인:', {
          hasConfirmationUrl: !!confirmationUrl,
          confirmationUrl: confirmationUrl ? confirmationUrl.substring(0, 100) : null,
        });
        
        if (confirmationUrl && !accessTokenFromHash) {
          // confirmation_url이 있고, 아직 토큰을 받지 않은 경우
          console.log('confirmation_url 감지:', confirmationUrl);
          try {
            const decodedUrl = decodeURIComponent(confirmationUrl);
            const url = new URL(decodedUrl);
            
            // confirmation_url에서 토큰 추출
            const token = url.searchParams.get('token');
            const type = url.searchParams.get('type');
            
            console.log('토큰 추출:', { hasToken: !!token, type });
            
            if (token && type === 'recovery') {
              // 토큰이 있으면 Supabase verifyOtp API를 사용하여 직접 검증
              console.log('verifyOtp로 토큰 검증 시도...');
              const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'recovery',
              });
              
              if (verifyError) {
                console.error('OTP 검증 오류:', verifyError);
                if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
                  setError('비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 새로운 재설정 링크를 요청해주세요.');
                } else {
                  setError('비밀번호 재설정 링크 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
                }
                setCheckingToken(false);
                return;
              }
              
              if (verifyData.session) {
                console.log('세션 설정 성공 (verifyOtp)');
                setIsValidToken(true);
                setCheckingToken(false);
                return;
              } else {
                console.error('세션 데이터가 없음:', verifyData);
                setError('세션을 설정할 수 없습니다. 새로운 재설정 링크를 요청해주세요.');
                setCheckingToken(false);
                return;
              }
            }
            
            // 토큰이 없거나 verifyOtp가 실패한 경우, redirect_to를 설정하고 Supabase로 리디렉션
            const currentOrigin = window.location.origin;
            const resetPasswordPath = `${currentOrigin}/auth/reset-password`;
            url.searchParams.set('redirect_to', resetPasswordPath);
            
            console.log('Supabase로 리디렉션 (fallback):', url.toString());
            window.location.href = url.toString();
            return;
          } catch (err) {
            console.error('confirmation_url 처리 오류:', err);
            // 파싱 실패 시 원본 URL로 리디렉션
            window.location.href = decodeURIComponent(confirmationUrl);
            return;
          }
        }
        
        // 오류 확인 (토큰 확인 전에 먼저 처리)
        const hashError = hashParams.get('error');
        const searchError = searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
        const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
        
        if (hashError || searchError) {
          console.log('에러 감지:', { hashError, searchError, errorCode, errorDescription });
          if (hashError === 'access_denied' || searchError === 'access_denied') {
            if (errorCode === 'otp_expired' || errorDescription?.includes('otp_expired') || errorDescription?.includes('expired') || errorDescription?.includes('invalid')) {
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

        console.log('토큰 확인:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
          hash: window.location.hash.substring(0, 100),
        });

        if (!accessToken || type !== 'recovery') {
          console.log('토큰이 없거나 타입이 맞지 않음');
          setError('유효하지 않은 비밀번호 재설정 링크입니다. 새로운 재설정 링크를 요청해주세요.');
          setCheckingToken(false);
          return;
        }

        // 세션 설정
        console.log('세션 설정 시도...');
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
          console.log('세션 설정 성공');
          setIsValidToken(true);
        } else {
          console.error('세션 데이터가 없음:', data);
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
      const { data: updatedUserResponse, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      try {
        const resolvedUserId =
          updatedUserResponse?.user?.id ||
          (await supabase.auth.getUser()).data.user?.id;

        if (resolvedUserId) {
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ migrated_at: null })
            .eq('id', resolvedUserId);

          if (profileUpdateError) {
            console.error('프로필 업데이트 오류:', profileUpdateError);
          }
        }
      } catch (profileUpdateCatchError) {
        console.error('마이그레이션 플래그 초기화 중 오류:', profileUpdateCatchError);
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

      <div className="mt-16">
        <Footer />
      </div>
    </div>
  );
}
