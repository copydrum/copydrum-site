
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { kakaoAuth } from '../../lib/kakao';
import { googleAuth } from '../../lib/google';
import { useNavigate, Link } from 'react-router-dom';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    // 비밀번호 길이 확인
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // 프로필 테이블에 사용자 정보 저장
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: formData.email,
            name: formData.name,
            provider: 'email'
          });

        if (profileError) {
          console.error('프로필 생성 오류:', profileError);
        }

        setSuccess('회원가입이 완료되었습니다! 이메일을 확인하여 계정을 활성화해주세요.');
        
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      }
    } catch (err: any) {
      console.error('회원가입 오류:', err);
      if (err.message.includes('User already registered')) {
        setError('이미 등록된 이메일입니다.');
      } else if (err.message.includes('Password should be at least 6 characters')) {
        setError('비밀번호는 최소 6자 이상이어야 합니다.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
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
            회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            또는{' '}
            <Link
              to="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              기존 계정으로 로그인
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="이름을 입력하세요"
              />
            </div>

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
                value={formData.email}
                onChange={handleChange}
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
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호를 입력하세요 (최소 6자)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  회원가입 중...
                </div>
              ) : (
                '회원가입'
              )}
            </button>
          </div>

          {/* 소셜 로그인 */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">또는</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleKakaoLogin}
                disabled={kakaoLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-yellow-400 text-gray-900 rounded-md shadow-sm font-bold text-sm hover:bg-yellow-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {kakaoLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg mr-2"></i>
                    카카오 로그인 중...
                  </>
                ) : (
                  <>
                    <i className="ri-kakao-talk-fill text-lg mr-2"></i>
                    카카오톡으로 시작하기
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-md shadow-sm font-bold text-sm hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg mr-2"></i>
                    구글 로그인 중...
                  </>
                ) : (
                  <>
                    <i className="ri-google-fill text-red-500 text-lg mr-2"></i>
                    구글로 시작하기
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
