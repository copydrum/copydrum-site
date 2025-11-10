
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: 'user' as 'user' | 'admin',
    agreeTerms: false,
    agreePrivacy: false,
    agreeMarketing: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
            phone: formData.phone,
            role: formData.role
          }
        }
      });

      console.log('SIGNUP_DATA', data);
      console.error('SIGNUP_ERROR', signUpError);

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
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
              <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer">
                로그인
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-16 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
              로그인하기
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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
                <label htmlFor="phone" className="block text-sm font-medium text-gray-707">
                  휴대폰 번호
                </label>
                <div className="mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="휴대폰 번호를 입력하세요"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  계정 유형 *
                </label>
                <div className="mt-1">
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 pr-8 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="user">일반 사용자</option>
                    <option value="admin">관리자</option>
                  </select>
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
                    <a href="#" className="text-blue-600 hover:text-blue-500 underline">
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
                    <a href="#" className="text-blue-600 hover:text-blue-500 underline">
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

      {/* Footer */}
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
