
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
import { getSiteUrl } from '../../lib/siteUrl';
import { kakaoAuth } from '../../lib/kakao';
import { googleAuth } from '../../lib/google';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { startCashCharge } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

interface UserSidebarProps {
  user: User | null;
}

export default function UserSidebar({ user }: UserSidebarProps) {
  const [userCash, setUserCash] = useState(0);
  const [showCashChargeModal, setShowCashChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState(10000);
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'kakaopay' | 'bank'>('bank');
  const [chargeAgreementChecked, setChargeAgreementChecked] = useState(false);
  const [chargeProcessing, setChargeProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showDepositorInput, setShowDepositorInput] = useState(false);
  const [depositorName, setDepositorName] = useState('');
  const [isKakaoChatReady, setIsKakaoChatReady] = useState(false);

  // 로그인 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US').format(value),
    [i18n.language],
  );

  const { cartItems } = useCart();

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
    setLoginInfo('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
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
      if (err.message?.includes('Invalid login credentials')) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('migrated_at')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (!profileError && profile?.migrated_at) {
            const redirectBase = getSiteUrl();
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
              redirectTo: `${redirectBase}/auth/reset-password`,
            });

            if (resetError) {
              console.error('비밀번호 재설정 메일 발송 오류:', resetError);
              setLoginError('비밀번호 재설정 메일 발송 중 오류가 발생했습니다. 다시 시도해주세요.');
            } else {
              setLoginInfo('기존 회원님이시군요! 비밀번호 재설정 이메일을 발송했습니다. 메일함을 확인해주세요.');
            }
            return;
          }

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('프로필 조회 오류:', profileError);
          }
        } catch (checkError) {
          console.error('마이그레이션 사용자 확인 오류:', checkError);
        }

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
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    setBankTransferInfo(null);
    setChargeAgreementChecked(false);
    setChargeProcessing(false);
    setShowDepositorInput(false);
    setDepositorName('');
    setSelectedPayment('bank');
    setShowCashChargeModal(true);
  };

  const handleCloseCashChargeModal = () => {
    setShowCashChargeModal(false);
    setChargeAgreementChecked(false);
    setChargeProcessing(false);
    setBankTransferInfo(null);
    setShowDepositorInput(false);
    setDepositorName('');
  };

  const handleChargeConfirm = () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!chargeAgreementChecked) {
      alert('결제 약관에 동의해 주세요.');
      return;
    }

    const selectedOption = chargeOptions.find((option) => option.amount === chargeAmount);
    if (!selectedOption) {
      alert('선택한 충전 금액을 확인할 수 없습니다.');
      return;
    }

    if (selectedPayment === 'card' || selectedPayment === 'kakaopay') {
      alert('카드/카카오페이 결제는 준비 중입니다. 무통장입금을 이용해주세요.');
      return;
    }

    if (selectedPayment === 'bank') {
      setShowDepositorInput(true);
      setBankTransferInfo(null);
    }
  };

  const handleBankTransferConfirm = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!depositorName.trim()) {
      alert('입금자명을 입력해 주세요.');
      return;
    }

    const selectedOption = chargeOptions.find((option) => option.amount === chargeAmount);
    if (!selectedOption) {
      alert('선택한 충전 금액을 확인할 수 없습니다.');
      return;
    }

    setChargeProcessing(true);

    try {
      const description = `${selectedOption.label} (${formatCurrency(selectedOption.amount)})`;
      const result = await startCashCharge({
        userId: user.id,
        amount: selectedOption.amount,
        bonusAmount: selectedOption.bonus ?? 0,
        paymentMethod: 'bank_transfer',
        description,
        buyerName: user.user_metadata?.name ?? user.email ?? null,
        buyerEmail: user.email ?? null,
        depositorName: depositorName.trim(),
        returnUrl: new URL('/payments/inicis/return', window.location.origin).toString(),
      });

      setBankTransferInfo(result.virtualAccountInfo ?? null);
      setShowDepositorInput(false);
      setChargeAgreementChecked(false);
      setDepositorName('');
      await loadUserCash();
      alert('주문이 접수되었습니다.\n입금 확인 후 관리자가 캐시 충전을 완료합니다.');
    } catch (error) {
      console.error('캐쉬 충전 오류:', error);
      alert(error instanceof Error ? error.message : '캐쉬 충전 중 오류가 발생했습니다.');
    } finally {
      setChargeProcessing(false);
    }
  };

  const handleCustomerSupportClick = () => {
    navigate('/customer-support');
  };

  const handleNavigate = useCallback(
    (path: string) => {
      if (!path) {
        return;
      }
      navigate(path);
    },
    [navigate],
  );

  const handleKakaoChatClick = useCallback(() => {
    window.open('https://pf.kakao.com/_Hbxezxl/chat', '_blank', 'noopener,noreferrer');
  }, []);

  const sidebarMenuItems = useMemo(
    () => [
      {
        icon: 'ri-history-line',
        label: '악보캐쉬 내역',
        onClick: () => handleNavigate('/mypage?section=cash-history'),
      },
      {
        icon: 'ri-user-settings-line',
        label: '회원정보 업데이트',
        onClick: () => handleNavigate('/mypage?section=profile'),
      },
      {
        icon: 'ri-shopping-cart-line',
        label: '장바구니',
        onClick: () => handleNavigate('/cart'),
        badge: cartItems.length,
      },
      {
        icon: 'ri-file-list-3-line',
        label: '구입목록',
        onClick: () => handleNavigate('/my-orders'),
      },
      {
        icon: 'ri-edit-2-line',
        label: '주문제작하기',
        onClick: () => handleNavigate('/custom-order'),
      },
      {
        icon: 'ri-user-line',
        label: '마이페이지',
        onClick: () => handleNavigate('/mypage'),
      },
      {
        icon: 'ri-customer-service-2-line',
        label: '고객센터',
        onClick: () => handleNavigate('/customer-support'),
      },
      {
        icon: 'ri-question-answer-line',
        label: '1:1 문의',
        onClick: () => handleNavigate('/mypage?section=inquiries'),
      },
      {
        icon: 'ri-question-line',
        label: '검색/구매가이드',
        onClick: () => handleNavigate('/guide'),
      },
    ],
    [cartItems.length, handleNavigate],
  );

  const chargeOptions = [
    { amount: 3000, bonus: 0, label: '3천원' },
    { amount: 5000, bonus: 500, label: '5천원', bonusPercent: '10%' },
    { amount: 10000, bonus: 1500, label: '1만원', bonusPercent: '15%' },
    { amount: 30000, bonus: 6000, label: '3만원', bonusPercent: '20%' },
    { amount: 50000, bonus: 11000, label: '5만원', bonusPercent: '22%' },
    { amount: 100000, bonus: 25000, label: '10만원', bonusPercent: '25%' },
  ];

  const paymentMethods = [
    {
      id: 'card',
      name: '신용카드',
      icon: 'ri-bank-card-line',
      color: 'text-blue-600',
      disabled: true,
      badge: '준비 중',
    },
    {
      id: 'kakaopay',
      name: '카카오페이',
      icon: 'ri-kakao-talk-fill',
      color: 'text-yellow-600',
      disabled: true,
      badge: '준비 중',
    },
    { id: 'bank', name: '무통장입금', icon: 'ri-bank-line', color: 'text-green-600' },
  ] as const;

  const loadUserCash = useCallback(async () => {
    if (!user) {
      setUserCash(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('캐쉬 조회 오류:', error);
        setUserCash(0);
        return;
      }

      setUserCash(data?.credits || 0);
    } catch (error) {
      console.error('캐쉬 로드 오류:', error);
      setUserCash(0);
    }
  }, [user]);

  // 사용자 캐쉬 로드
  useEffect(() => {
    void loadUserCash();
  }, [loadUserCash]);

  useEffect(() => {
    const ensureKakaoSdk = () => {
      const kakao = window.Kakao;
      if (kakao) {
        try {
          if (!kakao.isInitialized()) {
            kakao.init('f8269368f9d501a595c3f3d6d99e4ff5');
          }
          setIsKakaoChatReady(true);
        } catch (error) {
          console.error('카카오 SDK 초기화 중 오류:', error);
        }
        return;
      }

      const existingScript = document.getElementById('kakao-sdk');
      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.id = 'kakao-sdk';
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      script.integrity = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        try {
          const kakaoOnLoad = window.Kakao;
          if (kakaoOnLoad && !kakaoOnLoad.isInitialized()) {
            kakaoOnLoad.init('f8269368f9d501a595c3f3d6d99e4ff5');
          }
          setIsKakaoChatReady(true);
        } catch (error) {
          console.error('카카오 SDK 로드 후 초기화 실패:', error);
        }
      };
      script.onerror = () => {
        console.error('카카오 SDK 로드 실패');
      };

      document.head.appendChild(script);
    };

    ensureKakaoSdk();
  }, []);

  // 로그인하지 않은 경우 로그인 사이드바 표시
  if (!user) {
    return (
      <div className="hidden md:block">
        <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 border-l border-gray-200">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white flex flex-col items-center justify-center" style={{ height: '156px' }}>
          <h2 className="text-lg font-bold text-center">로그인</h2>
          <p className="text-blue-100 text-xs text-center mt-1">악보 구매를 위해 로그인하세요</p>
        </div>

        {/* 로그인 폼 */}
        <div className="p-4 h-full overflow-y-auto pb-16">
          <form onSubmit={handleLogin} className="space-y-4">
            {loginInfo && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-md text-xs">
                {loginInfo}
              </div>
            )}

            {loginError && (
              <div className="space-y-2">
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-xs">
                  {loginError}
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-md">
                  로그인이 되지 않는 경우, 사이트 이전으로 인해 비밀번호 재설정이 필요할 수 있습니다.<br />
                  아래 <span className="font-semibold text-blue-600">비밀번호 찾기</span>를 눌러 새 비밀번호를 설정해 주세요.
                </div>
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
                className="flex-1 text-center py-2 px-3 text-xs text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-md cursor-pointer"
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
      </div>
    );
  }

  return (
    <div className="hidden md:block">
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
            <p className="text-xl font-bold">{formatCurrency(userCash)}</p>
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

            {sidebarMenuItems.map((item) => (
              <Fragment key={item.label}>
                <button
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex items-center">
                    <i className={`${item.icon} text-gray-600 text-sm mr-3`}></i>
                    <span className="text-gray-800 text-sm">{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600">
                      {item.badge}
                    </span>
                  ) : null}
                </button>

                {item.label === '검색/구매가이드' && (
                  <div className="pt-2 pb-2">
                    <button
                      onClick={handleKakaoChatClick}
                      className="group w-full rounded-2xl border border-yellow-300 bg-gradient-to-r from-[#FEE500] to-[#FFD43B] p-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-black/85 text-[#FEE500]">
                          <i className="ri-kakao-talk-fill text-lg"></i>
                        </div>
                        <span className="flex-1 text-center text-sm font-semibold text-gray-900">카카오 채팅 상담</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/35 text-gray-900 transition-transform group-hover:translate-x-0.5">
                          <i className="ri-arrow-right-up-line text-base"></i>
                        </div>
                      </div>
                      {!isKakaoChatReady && (
                        <p className="mt-3 text-xs font-medium text-gray-900/80">
                          클릭하면 새 창에서 카카오톡 상담이 열립니다.
                        </p>
                      )}
                    </button>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 캐쉬충전 모달 */}
      {showCashChargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">캐쉬충전</h2>
              <button onClick={handleCloseCashChargeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-4">
              {/* 현재 포인트 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center">
                <i className="ri-coins-line text-yellow-600 text-lg mr-2"></i>
                <span className="text-sm text-gray-700">보유 악보캐쉬</span>
                <span className="ml-auto font-bold text-yellow-600">{formatNumber(userCash)} P</span>
              </div>

              {showDepositorInput ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">입금하실 금액</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(chargeAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 border border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>은행</span>
                      <span className="font-semibold text-gray-900">농협</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>계좌번호</span>
                      <span className="font-semibold text-gray-900">106-02-303742</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>예금주</span>
                      <span className="font-semibold text-gray-900">강만수</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      입금자명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={depositorName}
                      onChange={(event) => setDepositorName(event.target.value)}
                      placeholder="입금자명을 입력하세요"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      회원명과 입금자가 다르면 확인이 지연될 수 있으니 정확히 입력해주세요.
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-gray-700 space-y-1">
                    <p>• 입금 확인 후 관리자가 수동으로 캐시 충전을 완료합니다.</p>
                    <p>• 입금 확인까지 영업일 기준 1~2일 소요될 수 있습니다.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDepositorInput(false);
                        setDepositorName('');
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                      이전
                    </button>
                    <button
                      onClick={handleBankTransferConfirm}
                      disabled={chargeProcessing}
                      className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-70 font-medium text-sm transition-colors"
                    >
                      {chargeProcessing ? '처리 중...' : '확인'}
                    </button>
                  </div>
                </div>
              ) : bankTransferInfo ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3">무통장입금 안내</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>
                        <span className="font-medium text-gray-900">은행</span> {bankTransferInfo.bankName}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">계좌번호</span>{' '}
                        {bankTransferInfo.accountNumber}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">예금주</span> {bankTransferInfo.depositor}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">입금금액</span>{' '}
                        {formatCurrency(bankTransferInfo.amount ?? chargeAmount)}
                      </li>
                      {bankTransferInfo.expectedDepositor ? (
                        <li>
                          <span className="font-medium text-gray-900">입금자명</span>{' '}
                          <span className="text-blue-600 font-semibold">
                            {bankTransferInfo.expectedDepositor}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                    {bankTransferInfo.message ? (
                      <p className="mt-4 text-xs text-gray-600">{bankTransferInfo.message}</p>
                    ) : null}
                  </div>

                  <button
                    onClick={handleCloseCashChargeModal}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  {/* 결제금액 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">결제금액</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {chargeOptions.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => setChargeAmount(option.amount)}
                          className={`relative p-3 border rounded-lg text-left transition-colors ${
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
                                +{formatNumber(option.bonus)} 적립
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
                      {paymentMethods.map((method) => {
                        const isSelected = selectedPayment === method.id;
                        const isDisabled = method.disabled;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              if (isDisabled) {
                                alert('해당 결제수단은 현재 준비 중입니다.');
                                return;
                              }
                              setSelectedPayment(method.id);
                            }}
                            disabled={isDisabled}
                            className={`p-3 border rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <i className={`${method.icon} ${method.color} text-lg mr-2`}></i>
                                <span className="text-sm font-medium">{method.name}</span>
                              </div>
                              <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                                {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                              </div>
                            </div>
                            {method.badge ? (
                              <div className="mt-1">
                                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
                                  {method.badge}
                                </span>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 약관 동의 */}
                  <div className="mb-6">
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chargeAgreementChecked}
                        onChange={(event) => setChargeAgreementChecked(event.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                      <span className="ml-2 text-xs text-gray-600 leading-relaxed">
                        결제 내용을 확인하였으며, 약관에 동의합니다.
                        <button type="button" className="text-blue-600 hover:text-blue-800 ml-1">
                          <i className="ri-arrow-down-s-line"></i>
                        </button>
                      </span>
                    </label>
                  </div>

                  {/* 충전하기 버튼 */}
                  <button
                    onClick={handleChargeConfirm}
                    disabled={chargeProcessing}
                    className={`w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-bold text-sm transition-colors ${
                      chargeProcessing ? 'opacity-70 cursor-not-allowed' : 'hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    {chargeProcessing ? '결제 준비 중...' : '충전하기'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
