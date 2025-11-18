
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Footer from '../../components/common/Footer';
import MainHeader from '../../components/common/MainHeader';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreeMarketing: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleKakaoLogin = async () => {
    try {
      // 현재 호스트를 유지하여 리다이렉트
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://copydrum.com';
      const redirectUrl = `${currentOrigin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: redirectUrl,
        },
      });
      
      if (error) {
        console.error('카카오 로그인 오류:', error);
        alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('카카오 로그인 오류:', err);
      alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // 현재 호스트를 유지하여 리다이렉트
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://copydrum.com';
      const currentHost = typeof window !== 'undefined' ? window.location.host : 'copydrum.com';
      
      // 원래 호스트를 localStorage에 저장 (콜백에서 확인용)
      if (typeof window !== 'undefined') {
        localStorage.setItem('oauth_original_host', currentHost);
      }
      
      const redirectUrl = `${currentOrigin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            // 추가 파라미터로 호스트 정보 전달 (Supabase가 무시할 수 있지만 시도)
            host: currentHost,
          },
        },
      });
      
      if (error) {
        console.error('구글 로그인 오류:', error);
        alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('구글 로그인 오류:', err);
      alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // 유효성 검사
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    if (!formData.agreeTerms || !formData.agreePrivacy) {
      setError('필수 약관에 동의해주세요.');
      setLoading(false);
      return;
    }

    try {
      // Supabase 회원가입 - 메타데이터에 추가 정보 포함
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
          data: {
            name: formData.name,
            role: 'user' // 기본값으로 'user' 고정
          }
        }
      });

      console.log('SIGNUP_DATA', data);
      console.error('SIGNUP_ERROR', signUpError);

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // 프로필 생성 (이름이 있으면 사용, 없으면 이메일 앞부분 사용)
        const userName = formData.name.trim() || formData.email.split('@')[0];
        
        // 먼저 프로필이 이미 존재하는지 확인
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('프로필 확인 오류:', checkError);
          // 프로필 확인 실패 시 Auth 사용자 삭제 (롤백)
          try {
            await supabase.functions.invoke('rollback-signup', {
              body: { userId: data.user.id }
            });
          } catch (rollbackError) {
            console.error('롤백 중 오류:', rollbackError);
          }
          throw new Error('프로필 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
        }

        // 프로필이 없을 때만 생성
        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: formData.email,
              name: userName,
              role: 'user'
            });

          if (profileError) {
            console.error('프로필 생성 오류:', profileError);
            // 409 에러 또는 중복 키 에러는 이미 프로필이 존재하는 경우이므로 성공으로 처리
            const isDuplicateError = 
              profileError.code === '23505' || 
              profileError.code === 'PGRST301' ||
              profileError.statusCode === 409 ||
              profileError.message?.includes('duplicate') ||
              profileError.message?.includes('already exists');
            
            if (isDuplicateError) {
              console.log('프로필이 이미 존재합니다. 계속 진행합니다.');
            } else {
              // 프로필 생성 실패 시 Auth 사용자도 삭제 (롤백)
              try {
                const { error: functionError } = await supabase.functions.invoke('rollback-signup', {
                  body: { userId: data.user.id }
                });
                
                if (functionError) {
                  console.error('롤백 함수 호출 오류:', functionError);
                } else {
                  console.log('회원가입 롤백 완료');
                }
              } catch (rollbackError) {
                console.error('롤백 중 오류:', rollbackError);
              }
              
              // 다른 에러는 실패로 처리
              throw new Error('프로필 생성에 실패했습니다. 다시 시도해주세요.');
            }
          }
        } else {
          console.log('프로필이 이미 존재합니다. 계속 진행합니다.');
        }

        setSuccess('회원가입이 완료되었습니다! 이메일을 확인 후 로그인해주세요.');
        
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err: any) {
      console.error('회원가입 오류:', err);
      if (err.message.includes('already registered')) {
        setError('이미 등록된 이메일입니다.');
      } else if (err.message.includes('Invalid email')) {
        setError('올바른 이메일 형식을 입력해주세요.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MainHeader />

      <main className="flex-1 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">회원가입</h2>
            <p className="mt-2 text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                로그인하기
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
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
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    이름 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    이메일 주소 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="이메일을 입력하세요"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    비밀번호 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="비밀번호를 입력하세요 (8자 이상)"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    8자 이상, 영문, 숫자, 특수문자 조합
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-707">
                    비밀번호 확인 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="비밀번호를 다시 입력하세요"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start">
                    <input
                      id="agreeTerms"
                      name="agreeTerms"
                      type="checkbox"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mt-0.5"
                    />
                    <label htmlFor="agreeTerms" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      <span className="text-red-500">*</span> 이용약관에 동의합니다{' '}
                      <a href="/guide#terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline">
                        (보기)
                      </a>
                    </label>
                  </div>

                  <div className="flex items-start">
                    <input
                      id="agreePrivacy"
                      name="agreePrivacy"
                      type="checkbox"
                      checked={formData.agreePrivacy}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mt-0.5"
                    />
                    <label htmlFor="agreePrivacy" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      <span className="text-red-500">*</span> 개인정보 수집 및 이용에 동의합니다{' '}
                      <a href="/guide#privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline">
                        (보기)
                      </a>
                    </label>
                  </div>

                  <div className="flex items-start">
                    <input
                      id="agreeMarketing"
                      name="agreeMarketing"
                      type="checkbox"
                      checked={formData.agreeMarketing}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mt-0.5"
                    />
                    <label htmlFor="agreeMarketing" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      마케팅 정보 수신에 동의합니다 (선택)
                    </label>
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
                        가입 중...
                      </div>
                    ) : (
                      '회원가입'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">또는</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 cursor-pointer"
                  >
                    <i className="ri-google-fill text-red-500 text-lg"></i>
                    <span className="ml-2">Google</span>
                  </button>

                  <button 
                    type="button"
                    onClick={handleKakaoLogin}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 cursor-pointer"
                  >
                    <i className="ri-kakao-talk-fill text-yellow-500 text-lg"></i>
                    <span className="ml-2">카카오</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
