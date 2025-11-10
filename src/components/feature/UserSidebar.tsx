
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { kakaoAuth } from '../../lib/kakao';
import { googleAuth } from '../../lib/google';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';

interface UserSidebarProps {
  user: User | null;
}

export default function UserSidebar({ user }: UserSidebarProps) {
  const [userCash, setUserCash] = useState(50000); // 모의 캐쉬 잔액
  const [showCashChargeModal, setShowCashChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState(10000);

  // 로그인 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();

  const { cartItems } = useCart();

  const menuItems = [
    { icon: 'ri-home-line', label: '홈', path: '/' },
    { icon: 'ri-list-check', label: '카테고리', path: '/categories' },
    { icon: 'ri-file-music-line', label: '주문제작', path: '/custom-order' },
    { icon: 'ri-file-list-3-line', label: '주문제작 신청내역', path: '/my-orders' },
    { icon: 'ri-shopping-cart-line', label: '장바구니', path: '/cart' },
    { icon: 'ri-user-line', label: '마이페이지', path: '/mypage' },
  ];

  const handleLogout = async () => {
    try {
      // 카카오 로그아웃
      if (kakaoAuth.isLoggedIn()) {
        kakaoAuth.logout();
      }
      
      // 구글 로그아웃
      if (googleAuth.isLoggedIn()) {
        googleAuth.logout();
      }
      
      // Supabase 로그아웃
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('로그인 오류:', err);
      if (err.message.includes('Invalid login credentials')) {
        setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message.includes('Email not confirmed')) {
        setLoginError('이메일 인증이 필요합니다. 이메일을 확인해주세요.');
      } else {
        setLoginError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    setLoginError('');

    try {
      const { userInfo } = await kakaoAuth.login();
      
      // 카카오 사용자 정보로 Supabase에 로그인/회원가입
      const kakaoEmail = userInfo.kakao_account?.email;
      const kakaoNickname = userInfo.kakao_account?.profile?.nickname;
      const kakaoId = userInfo.id.toString();

      if (!kakaoEmail) {
        throw new Error('카카오 계정에서 이메일 정보를 가져올 수 없습니다.');
      }

      // 기존 사용자 확인
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', kakaoEmail)
        .single();

      if (existingUser) {
        // 기존 사용자 - 카카오 ID 업데이트
        await supabase
          .from('profiles')
          .update({ 
            kakao_id: kakaoId,
            provider: 'kakao'
          })
          .eq('email', kakaoEmail);
      } else {
        // 새 사용자 - 프로필 생성
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            email: kakaoEmail,
            name: kakaoNickname || '카카오 사용자',
            kakao_id: kakaoId,
            provider: 'kakao'
          });

        if (profileError) {
          console.error('프로필 생성 오류:', profileError);
        }
      }

      // Supabase Auth에 사용자 정보 저장 (임시 비밀번호 사용)
      const tempPassword = `kakao_${kakaoId}_${Date.now()}`;
      
      try {
        // 기존 계정으로 로그인 시도
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: kakaoEmail,
          password: tempPassword,
        });

        if (signInError) {
          // 계정이 없으면 생성
          const { error: signUpError } = await supabase.auth.signUp({
            email: kakaoEmail,
            password: tempPassword,
            options: {
              data: {
                name: kakaoNickname || '카카오 사용자',
                kakao_id: kakaoId,
                provider: 'kakao'
              }
            }
          });

          if (signUpError) {
            throw signUpError;
          }
        }
      } catch (authError) {
        console.error('Supabase Auth 오류:', authError);
        // Auth 오류가 있어도 카카오 로그인은 성공으로 처리
      }

      // 성공 처리
      window.location.reload();

    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      setLoginError(error.message || '카카오 로그인에 실패했습니다.');
    } finally {
      setKakaoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setLoginError('');

    try {
      const { userInfo } = await googleAuth.login();
      
      // 구글 사용자 정보로 Supabase에 로그인/회원가입
      const googleEmail = userInfo.email;
      const googleName = userInfo.name;
      const googleId = userInfo.id;

      if (!googleEmail) {
        throw new Error('구글 계정에서 이메일 정보를 가져올 수 없습니다.');
      }

      // 기존 사용자 확인
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', googleEmail)
        .single();

      if (existingUser) {
        // 기존 사용자 - 구글 ID 업데이트
        await supabase
          .from('profiles')
          .update({ 
            google_id: googleId,
            provider: 'google'
          })
          .eq('email', googleEmail);
      } else {
        // 새 사용자 - 프로필 생성
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            email: googleEmail,
            name: googleName || '구글 사용자',
            google_id: googleId,
            provider: 'google'
          });

        if (profileError) {
          console.error('프로필 생성 오류:', profileError);
        }
      }

      // Supabase Auth에 사용자 정보 저장 (임시 비밀번호 사용)
      const tempPassword = `google_${googleId}_${Date.now()}`;
      
      try {
        // 기존 계정으로 로그인 시도
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: googleEmail,
          password: tempPassword,
        });

        if (signInError) {
          // 계정이 없으면 생성
          const { error: signUpError } = await supabase.auth.signUp({
            email: googleEmail,
            password: tempPassword,
            options: {
              data: {
                name: googleName || '구글 사용자',
                google_id: googleId,
                provider: 'google'
              }
            }
          });

          if (signUpError) {
            throw signUpError;
          }
        }
      } catch (authError) {
        console.error('Supabase Auth 오류:', authError);
        // Auth 오류가 있어도 구글 로그인은 성공으로 처리
      }

      // 성공 처리
      window.location.reload();

    } catch (error: any) {
      console.error('구글 로그인 오류:', error);
      setLoginError(error.message || '구글 로그인에 실패했습니다.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCashCharge = () => {
    setShowCashChargeModal(true);
  };

  const handleChargeConfirm = () => {
    // 실제로는 결제 API 연동
    setUserCash(prev => prev + chargeAmount);
    setShowCashChargeModal(false);
    alert(`${chargeAmount.toLocaleString()}원이 충전되었습니다!`);
  };

  const handleMyPageClick = () => {
    navigate('/mypage');
  };

  const handleCustomerSupportClick = () => {
    navigate('/customer-support');
  };

  const chargeOptions = [
    { amount: 30000, bonus: 0, label: '3천원' },
    { amount: 50000, bonus: 500, label: '5천원', bonusPercent: '10%' },
    { amount: 10000, bonus: 1500, label: '1만원', bonusPercent: '15%' },
    { amount: 30000, bonus: 6000, label: '3만원', bonusPercent: '20%' },
    { amount: 50000, bonus: 11000, label: '5만원', bonusPercent: '22%' },
    { amount: 100000, bonus: 25000, label: '10만원', bonusPercent: '25%' },
  ];

  const paymentMethods = [
    { id: 'kakaopay', name: '카카오페이', icon: 'ri-kakao-talk-fill', color: 'text-yellow-600' },
    { id: 'card', name: '신용카드', icon: 'ri-bank-card-line', color: 'text-blue-600' },
    { id: 'bank', name: '무통장입금', icon: 'ri-bank-line', color: 'text-green-600' },
    { id: 'phone', name: '휴대폰결제', icon: 'ri-smartphone-line', color: 'text-purple-600' },
  ];

  const [selectedPayment, setSelectedPayment] = useState('kakaopay');

  // 로그인하지 않은 경우 로그인 사이드바 표시
  if (!user) {
    return (
      <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 border-l border-gray-200">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <h2 className="text-lg font-bold text-center">로그인</h2>
          <p className="text-blue-100 text-xs text-center mt-1">악보 구매를 위해 로그인하세요</p>
        </div>

        {/* 로그인 폼 */}
        <div className="p-4 h-full overflow-y-auto pb-16">
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-xs">
                {loginError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일 주소
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이메일을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                아이디 저장
              </label>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {loginLoading ? (
                <div className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  로그인 중...
                </div>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* 소셜 로그인 */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">또는</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <button 
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
                    카카오톡 로그인
                  </>
                )}
              </button>

              <button 
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
                    구글 로그인
                  </>
                )}
              </button>
            </div>

            {/* 링크들 */}
            <div className="mt-6 space-y-3">
              <a
                href="/auth/register"
                className="w-full flex items-center justify-center py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm cursor-pointer"
              >
                <i className="ri-user-add-line mr-2"></i>
                회원가입
              </a>

              <div className="flex space-x-2">
                <a
                  href="/auth/forgot-password"
                  className="flex-1 text-center py-2 px-3 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md hover:bg-blue-50 cursor-pointer"
                >
                  아이디 찾기
                </a>
                <a
                  href="/auth/forgot-password"
                  className="flex-1 text-center py-2 px-3 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md hover:bg-blue-50 cursor-pointer"
                >
                  비밀번호 찾기
                </a>
              </div>
            </div>

            {/* 고객센터 */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">도움이 필요하신가요?</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleCustomerSupportClick}
                  className="w-full flex items-center p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <i className="ri-customer-service-2-line mr-2"></i>
                  고객센터
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 사이드바 - 항상 표시, 더 좁은 너비 */}
      <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 border-l border-gray-200">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{user?.user_metadata?.name || '사용자'}</h2>
              <button
                onClick={handleLogout}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white transition-colors cursor-pointer"
              >
                로그아웃
              </button>
            </div>
            <p className="text-blue-100 text-xs">{user?.email}</p>
          </div>

          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs text-blue-100">보유 악보캐쉬</p>
            <p className="text-xl font-bold">₩ {userCash.toLocaleString()}</p>
          </div>
        </div>

        {/* 메뉴 목록 */}
        <div className="flex-1 overflow-y-auto h-full pb-16">
          <div className="p-3 space-y-2">
            {/* 캐쉬충전 - 강조 */}
            <button
              onClick={handleCashCharge}
              className="w-full flex items-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-purple-100 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <i className="ri-wallet-3-line text-blue-600 text-sm"></i>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 text-sm">캐쉬충전</h3>
                <p className="text-xs text-blue-600">악보 구매용 캐쉬</p>
              </div>
            </button>

            {/* 일반 메뉴들 */}
            <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <i className="ri-history-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">악보캐쉬 내역</span>
            </button>

            <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <i className="ri-user-settings-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">회원정보 업데이트</span>
            </button>

            <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <i className="ri-shopping-cart-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">장바구니</span>
            </button>

            <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <i className="ri-file-list-3-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">구입목록</span>
            </button>

            <button 
                onClick={handleMyPageClick}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-user-line text-gray-600"></i>
                </div>
                <span className="text-gray-800 text-sm">마이페이지</span>
              </button>

            <button 
              onClick={handleCustomerSupportClick}
              className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-customer-service-2-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">고객센터</span>
            </button>

            <button className="w-full flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <i className="ri-question-line text-gray-600 text-sm mr-3"></i>
              <span className="text-gray-800 text-sm">검색/구매가이드</span>
            </button>
          </div>
        </div>
      </div>

      {/* 캐쉬충전 모달 */}
      {showCashChargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">포인트 충전</h2>
              <button
                onClick={() => setShowCashChargeModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-4">
              {/* 현재 포인트 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center">
                <i className="ri-coins-line text-yellow-600 text-lg mr-2"></i>
                <span className="text-sm text-gray-700">보유 포인트</span>
                <span className="ml-auto font-bold text-yellow-600">{userCash.toLocaleString()} P</span>
              </div>

              {/* 결제금액 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">결제금액</h3>
                <div className="grid grid-cols-2 gap-3">
                  {chargeOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => setChargeAmount(option.amount)}
                      className={`relative p-3 border rounded-lg text-left transition-colors cursor-pointer ${
                        chargeAmount === option.amount
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{option.label}</span>
                        <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                          {chargeAmount === option.amount && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      {option.bonus > 0 && (
                        <div className="mt-1">
                          <span className="text-xs text-gray-500">
                            +{option.bonus.toLocaleString()} 적립
                          </span>
                          <span className="ml-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                            {option.bonusPercent}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 결제방법 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">결제방법</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPayment(method.id)}
                      className={`p-3 border rounded-lg text-left transition-colors cursor-pointer ${
                        selectedPayment === method.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <i className={`${method.icon} ${method.color} text-lg mr-2`}></i>
                          <span className="text-sm font-medium">{method.name}</span>
                        </div>
                        <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                          {selectedPayment === method.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      {method.id === 'kakaopay' && (
                        <div className="mt-1 flex items-center">
                          <span className="bg-yellow-400 text-black text-xs px-2 py-0.5 rounded font-bold">
                            pay
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 약관 동의 */}
              <div className="mb-6">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-2 text-xs text-gray-600 leading-relaxed">
                    결제 내용을 확인하였으며, 약관에 동의합니다.
                    <button className="text-blue-600 hover:text-blue-800 ml-1">
                      <i className="ri-arrow-down-s-line"></i>
                    </button>
                  </span>
                </label>
              </div>

              {/* 충전하기 버튼 */}
              <button
                onClick={handleChargeConfirm}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold text-sm transition-colors cursor-pointer"
              >
                충전하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
