
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { kakaoAuth } from '../../lib/kakao';
import { googleAuth } from '../../lib/google';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        navigate('/');
      }
    } catch (err: any) {
      console.error('로그인 오류:', err);
      if (err.message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('이메일 인증이 필요합니다. 이메일을 확인해주세요.');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    setError('');

    try {
      const { userInfo } = await kakaoAuth.login();
      console.log('카카오 사용자 정보:', userInfo);
      
      // Edge Function을 통해 소셜 로그인 처리 - UTF-8 헤더 추가
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/social-auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          'Accept': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          provider: 'kakao',
          userInfo: userInfo
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '카카오 로그인 처리 중 오류가 발생했습니다.');
      }

      console.log('카카오 로그인 성공:', result);

      // 매직링크를 통한 자동 로그인
      if (result.authUrl) {
        // 매직링크에서 토큰 추출하여 세션 설정
        const url = new URL(result.authUrl);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('세션 설정 오류:', sessionError);
          }
        }
      }

      // 성공 처리
      navigate('/');

    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      setError(error.message || '카카오 로그인에 실패했습니다.');
    } finally {
      setKakaoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const { userInfo } = await googleAuth.login();
      console.log('구글 사용자 정보:', userInfo);
      
      // Edge Function을 통해 소셜 로그인 처리 - UTF-8 헤더 추가
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/social-auth-handler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          'Accept': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          provider: 'google',
          userInfo: userInfo
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '구글 로그인 처리 중 오류가 발생했습니다.');
      }

      console.log('구글 로그인 성공:', result);

      // 매직링크를 통한 자동 로그인
      if (result.authUrl) {
        // 매직링크에서 토큰 추출하여 세션 설정
        const url = new URL(result.authUrl);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('세션 설정 오류:', sessionError);
          }
        }
      }

      // 성공 처리
      navigate('/');

    } catch (error: any) {
      console.error('구글 로그인 오류:', error);
      setError(error.message || '구글 로그인에 실패했습니다.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <i className="ri-music-2-line text-2xl text-blue-600"></i>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            로그인
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            또는{' '}
            <Link
              to="/auth/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              새 계정 만들기
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 주소
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="이메일을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호를 입력하세요"
              />
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  로그인 상태 유지
                </label>
              </div>

              <div className="text-sm">
                <Link to="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            </div>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                또는 소셜 계정으로 로그인
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={handleKakaoLogin}
              disabled={kakaoLoading}
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-yellow-300 text-sm font-medium text-gray-700 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {kakaoLoading ? (
                <span className="flex items-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  로그인 중...
                </span>
              ) : (
                <>
                  <i className="ri-kakao-talk-line text-lg mr-2"></i>
                  카카오 로그인
                </>
              )}
            </button>

            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {googleLoading ? (
                <span className="flex items-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  로그인 중...
                </span>
              ) : (
                <>
                  <i className="ri-google-line text-lg mr-2"></i>
                  구글 로그인
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
