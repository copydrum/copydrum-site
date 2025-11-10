
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setMessage('비밀번호 재설정 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.');
    } catch (err: any) {
      console.error('비밀번호 재설정 오류:', err);
      if (err.message.includes('Invalid email')) {
        setError('올바른 이메일 형식을 입력해주세요.');
      } else {
        setError('비밀번호 재설정 요청에 실패했습니다. 다시 시도해주세요.');
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
          <h2 className="text-3xl font-bold text-gray-900">비밀번호 찾기</h2>
          <p className="mt-2 text-sm text-gray-600">
            가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
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

              {message && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
                  {message}
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
                    placeholder="가입하신 이메일을 입력하세요"
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
                      전송 중...
                    </div>
                  ) : (
                    '비밀번호 재설정 링크 전송'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <div className="text-sm space-y-2">
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                  로그인으로 돌아가기
                </Link>
                <div className="text-gray-500">또는</div>
                <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                  새 계정 만들기
                </Link>
              </div>
            </div>
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
