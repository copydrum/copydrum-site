
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        // 사용자 프로필 정보 가져오기
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('프로필 조회 오류:', profileError);
          
          // 프로필이 없으면 기본 프로필 생성
          if (profileError.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.user_metadata?.name || '사용자',
                phone: data.user.user_metadata?.phone || null,
                role: data.user.user_metadata?.role || 'user'
              });
            
            if (insertError) {
              console.error('프로필 생성 오류:', insertError);
            }
          }
        }

        // 로그인 성공 시 홈페이지로 이동
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Pacifico", serif' }}>
                카피드럼
              </h1>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link to="/" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">홈</Link>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">악보 카테고리</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">신규 악보</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">인기 악보</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">고객지원</a>
            </nav>
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <i className="ri-search-line text-xl"></i>
              </button>
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <i className="ri-shopping-cart-line text-xl"></i>
              </button>
              <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer">
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-16 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">로그인</h2>
          <p className="mt-2 text-sm text-gray-600">
            계정이 없으신가요?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
              회원가입하기
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  이메일 주소
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="이메일을 입력하세요"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  비밀번호
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="비밀번호를 입력하세요"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                    로그인 상태 유지
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                    비밀번호를 잊으셨나요?
                  </a>
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
                      로그인 중...
                    </div>
                  ) : (
                    '로그인'
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
                <button className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 cursor-pointer">
                  <i className="ri-google-fill text-red-500 text-lg"></i>
                  <span className="ml-2">Google</span>
                </button>

                <button className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 cursor-pointer">
                  <i className="ri-kakao-talk-fill text-yellow-500 text-lg"></i>
                  <span className="ml-2">카카오</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-xl font-bold mb-4" style={{ fontFamily: '"Pacifico", serif' }}>
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
