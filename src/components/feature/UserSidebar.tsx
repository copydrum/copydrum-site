
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/supabase';
import { getSiteUrl } from '../../lib/siteUrl';
import { googleAuth } from '../../lib/google';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useUserCashBalance } from '../../hooks/useUserCashBalance';
import { startCashCharge } from '../../lib/payments';
import type { VirtualAccountInfo } from '../../lib/payments';
import { useTranslation } from 'react-i18next';
import { formatPrice, convertUSDToKRW } from '../../lib/priceFormatter';
import { isEnglishHost } from '../../i18n/languages';
import { getUserDisplayName } from '../../utils/userDisplayName';

interface UserSidebarProps {
  user: User | null;
}

export default function UserSidebar({ user }: UserSidebarProps) {
  // 캐시 잔액 조회: 통일된 훅 사용 (profiles 테이블의 credits 필드가 기준)
  const { credits: userCash, loading: cashLoading, error: cashError, refresh: refreshCash } = useUserCashBalance(user);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showCashChargeModal, setShowCashChargeModal] = useState(false);
  
  // 영문 사이트 여부 확인 (초기 상태에서 사용되므로 먼저 정의)
  const isEnglishSiteForState = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isEnglishHost(window.location.host);
  }, []);
  
  const [chargeAmount, setChargeAmount] = useState(
    isEnglishSiteForState ? convertUSDToKRW(10) : 10000
  );
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'kakaopay' | 'bank' | 'paypal'>(isEnglishSiteForState ? 'paypal' : 'bank');
  const [chargeAgreementChecked, setChargeAgreementChecked] = useState(false);
  const [chargeProcessing, setChargeProcessing] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<VirtualAccountInfo | null>(null);
  const [showDepositorInput, setShowDepositorInput] = useState(false);
  const [depositorName, setDepositorName] = useState('');

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
  const { i18n, t } = useTranslation();
  const formatCurrency = useCallback(
    (value: number) => formatPrice({ amountKRW: value, language: i18n.language }).formatted,
    [i18n.language],
  );
  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(i18n.language?.startsWith('ko') ? 'ko-KR' : 'en-US').format(value),
    [i18n.language],
  );
  
  // 포인트 포맷 함수 (숫자 + P)
  const formatPoints = useCallback(
    (value: number) => `${value.toLocaleString('en-US')} P`,
    [],
  );

  const { cartItems } = useCart();

  // 영문 사이트 여부 확인 (formatCash보다 먼저 정의되어야 함)
  const isEnglishSite = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isEnglishHost(window.location.host);
  }, []);

  // 캐시 표시용 포맷 함수 (영문 사이트는 USD, 한국어 사이트는 KRW)
  const formatCash = useCallback(
    (value: number) => {
      return formatPrice({ 
        amountKRW: value, 
        language: i18n.language,
        host: typeof window !== 'undefined' ? window.location.host : undefined
      }).formatted;
    },
    [i18n.language],
  );

  const handleLogout = async () => {
    try {
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
        setLoginError('카카오 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        setKakaoLoading(false);
      }
      // 성공 시 리다이렉트되므로 여기서는 아무것도 하지 않음
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      setLoginError(error.message || '카카오 로그인에 실패했습니다.');
      setKakaoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setLoginError('');

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
        setLoginError('구글 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        setGoogleLoading(false);
      }
      // 성공 시 리다이렉트되므로 여기서는 아무것도 하지 않음
    } catch (error: any) {
      console.error('구글 로그인 오류:', error);
      setLoginError(error.message || '구글 로그인에 실패했습니다.');
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

  const handleChargeConfirm = async () => {
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

    // legacy: 카카오페이는 현재 비활성화 (포트원 심사 진행 중)
    // if (selectedPayment === 'kakaopay') { ... }

    if (selectedPayment === 'paypal') {
      // PayPal 결제 처리 (직접 PayPal API 사용, PortOne 미사용)
      setChargeProcessing(true);
      try {
        const description = `${selectedOption.label} (${formatCurrency(selectedOption.amount)})`;
        await startCashCharge({
          userId: user.id,
          amount: selectedOption.amount,
          bonusAmount: selectedOption.bonus ?? 0,
          paymentMethod: 'paypal',
          description,
          buyerName: getUserDisplayName(profile, user.email || null) ?? null,
          buyerEmail: user.email ?? null,
          // returnUrl은 requestPayPalPayment에서 자동으로 생성
        });

        // PayPal은 리다이렉트되므로 알림 불필요
        // PayPal 승인 URL로 자동 리다이렉트됨
      } catch (error) {
        console.error('캐쉬 충전 오류:', error);
        alert(error instanceof Error ? error.message : '캐쉬 충전 중 오류가 발생했습니다.');
        setChargeProcessing(false);
      }
      return;
    }

    // legacy: 카드 결제는 현재 비활성화 (포트원 심사 진행 중)
    // if (selectedPayment === 'card') { ... }

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
      await refreshCash();
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
        label: t('sidebar.cashHistory'),
        onClick: () => handleNavigate('/mypage?section=cash-history'),
      },
      {
        icon: 'ri-user-settings-line',
        label: t('sidebar.updateProfile'),
        onClick: () => handleNavigate('/mypage?section=profile'),
      },
      {
        icon: 'ri-shopping-cart-line',
        label: t('sidebar.cart'),
        onClick: () => handleNavigate('/cart'),
        badge: cartItems.length,
      },
      {
        icon: 'ri-file-list-3-line',
        label: t('sidebar.purchaseHistory'),
        onClick: () => handleNavigate('/my-orders'),
      },
      {
        icon: 'ri-edit-2-line',
        label: t('sidebar.customOrder'),
        onClick: () => handleNavigate('/custom-order'),
      },
      {
        icon: 'ri-user-line',
        label: t('sidebar.myPage'),
        onClick: () => handleNavigate('/mypage'),
      },
      {
        icon: 'ri-customer-service-2-line',
        label: t('sidebar.customerSupport'),
        onClick: () => handleNavigate('/customer-support'),
      },
      {
        icon: 'ri-question-answer-line',
        label: t('sidebar.inquiry'),
        onClick: () => handleNavigate('/mypage?section=inquiries'),
      },
      {
        icon: 'ri-question-line',
        label: t('sidebar.guide'),
        onClick: () => handleNavigate('/guide'),
      },
    ],
    [cartItems.length, handleNavigate, t],
  );

  const chargeOptions = useMemo(() => {
    if (isEnglishSite) {
      // 영문 사이트: 달러 단위
      return [
        { amount: convertUSDToKRW(3), bonus: 0, label: '$3', amountUSD: 3, bonusUSD: 0 },
        { amount: convertUSDToKRW(5), bonus: convertUSDToKRW(0.5), label: '$5', amountUSD: 5, bonusUSD: 0.5 },
        { amount: convertUSDToKRW(10), bonus: convertUSDToKRW(1), label: '$10', amountUSD: 10, bonusUSD: 1 },
        { amount: convertUSDToKRW(30), bonus: convertUSDToKRW(6), label: '$30', amountUSD: 30, bonusUSD: 6 },
        { amount: convertUSDToKRW(50), bonus: convertUSDToKRW(11), label: '$50', amountUSD: 50, bonusUSD: 11 },
        { amount: convertUSDToKRW(100), bonus: convertUSDToKRW(25), label: '$100', amountUSD: 100, bonusUSD: 25 },
      ];
    }
    // 한국어 사이트: 원화 단위
    return [
      { amount: 3000, bonus: 0, label: '3천원' },
      { amount: 5000, bonus: 500, label: '5천원', bonusPercent: '10%' },
      { amount: 10000, bonus: 1500, label: '1만원', bonusPercent: '15%' },
      { amount: 30000, bonus: 6000, label: '3만원', bonusPercent: '20%' },
      { amount: 50000, bonus: 11000, label: '5만원', bonusPercent: '22%' },
      { amount: 100000, bonus: 25000, label: '10만원', bonusPercent: '25%' },
    ];
  }, [isEnglishSite]);

  const paymentMethods = useMemo(() => {
    // 영문 사이트: PayPal만 표시
    if (isEnglishSite) {
      return [
        {
          id: 'paypal',
          name: t('payment.paypal'),
          icon: 'ri-paypal-line',
          color: 'text-blue-700',
          disabled: false,
          badge: undefined,
        },
      ];
    }

    // 한국 사이트: 무통장 입금만 표시 (포트원 카드/카카오페이는 심사 진행 중)
    return [
      { 
        id: 'bank', 
        name: '무통장입금', 
        icon: 'ri-bank-line', 
        color: 'text-green-600',
        disabled: false,
        badge: undefined,
      },
    ];
  }, [isEnglishSite, t]);

  // 프로필 정보 로드 (display_name, email 등)
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[UserSidebar] 프로필 조회 오류:', error);
        setProfile(null);
        return;
      }

      if (data) {
        setProfile(data as Profile);
      }
    } catch (error) {
      console.error('[UserSidebar] 프로필 로드 오류:', error);
      setProfile(null);
    }
  }, [user]);

  // 프로필 정보 로드
  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // 캐시 잔액 에러가 발생한 경우 콘솔에 로그 출력
  useEffect(() => {
    if (cashError) {
      console.error('[UserSidebar] 캐시 잔액 조회 실패:', cashError);
    }
  }, [cashError]);


  // 로그인하지 않은 경우 로그인 사이드바 표시
  if (!user) {
    return (
      <div className="hidden md:block">
        <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 border-l border-gray-200">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white flex flex-col items-center justify-center" style={{ height: '156px' }}>
          <h2 className="text-lg font-bold text-center">{t('sidebar.loginTitle')}</h2>
          <p className="text-blue-100 text-xs text-center mt-1">{t('sidebar.loginDescription')}</p>
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
                {t('sidebar.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('sidebar.emailPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('sidebar.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('sidebar.passwordPlaceholder')}
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
                {t('sidebar.rememberMe')}
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
                  {t('sidebar.loggingIn')}
                </div>
              ) : (
                t('sidebar.login')
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
                <span className="px-2 bg-white text-gray-500">{t('sidebar.or')}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* 카카오톡 로그인 버튼 (한국어 사이트에서만 표시) */}
              {!isEnglishSite && (
                <button 
                  onClick={handleKakaoLogin}
                  disabled={kakaoLoading}
                  className="w-full flex items-center justify-center py-3 px-4 bg-yellow-400 text-gray-900 rounded-md shadow-sm font-bold text-sm hover:bg-yellow-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {kakaoLoading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg mr-2"></i>
                      {t('sidebar.kakaoLoggingIn')}
                    </>
                  ) : (
                    <>
                      <i className="ri-kakao-talk-fill text-lg mr-2"></i>
                      {t('sidebar.kakaoLogin')}
                    </>
                  )}
                </button>
              )}

              <button 
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-md shadow-sm font-bold text-sm hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg mr-2"></i>
                    {t('sidebar.googleLoggingIn')}
                  </>
                ) : (
                  <>
                    <i className="ri-google-fill text-red-500 text-lg mr-2"></i>
                    {t('sidebar.googleLogin')}
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
                {t('sidebar.register')}
              </a>

            <div className="flex space-x-2">
              <a
                href="/auth/forgot-password"
                className="flex-1 text-center py-2 px-3 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md hover:bg-blue-50 cursor-pointer"
              >
                {t('sidebar.findId')}
              </a>
              <a
                href="/auth/forgot-password"
                className="flex-1 text-center py-2 px-3 text-xs text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-md cursor-pointer"
              >
                {t('sidebar.findPassword')}
              </a>
            </div>
            </div>

            {/* 고객센터 */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('sidebar.needHelp')}</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleCustomerSupportClick}
                  className="w-full flex items-center p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <i className="ri-customer-service-2-line mr-2"></i>
                  {t('sidebar.customerSupport')}
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
              <h2 className="text-lg font-bold">{getUserDisplayName(profile, user?.email || null) || t('sidebar.user')}</h2>
              <button
                onClick={handleLogout}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white transition-colors cursor-pointer"
              >
                {t('sidebar.logout')}
              </button>
            </div>
            <p className="text-blue-100 text-xs">{user?.email}</p>
          </div>

          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs text-blue-100">{t('sidebar.availableCash')}</p>
            {cashLoading ? (
              <p className="text-xl font-bold text-blue-200 animate-pulse">로딩 중...</p>
            ) : cashError ? (
              <p className="text-sm font-bold text-red-200">
                오류: {cashError.message}
              </p>
            ) : (
              <p className="text-xl font-bold">{formatCash(userCash)}</p>
            )}
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
                <h3 className="font-semibold text-blue-900 text-sm">{t('sidebar.cashCharge')}</h3>
                <p className="text-xs text-blue-600">{t('sidebar.cashForPurchase')}</p>
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

                {item.label === t('sidebar.guide') && !isEnglishSite && (
                  <div className="pt-2 pb-2">
                    <button
                      onClick={handleKakaoChatClick}
                      className="group w-full rounded-2xl border border-yellow-300 bg-gradient-to-r from-[#FEE500] to-[#FFD43B] p-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-black/85 text-[#FEE500]">
                          <i className="ri-kakao-talk-fill text-lg"></i>
                        </div>
                        <span className="flex-1 text-center text-sm font-semibold text-gray-900">{t('sidebar.kakaoChat')}</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/35 text-gray-900 transition-transform group-hover:translate-x-0.5">
                          <i className="ri-arrow-right-up-line text-base"></i>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-gray-900/80">
                        {t('sidebar.kakaoChatDescription')}
                      </p>
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
              <h2 className="text-lg font-bold text-gray-900">{t('sidebar.cashChargeTitle')}</h2>
              <button onClick={handleCloseCashChargeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-4">
              {/* 현재 포인트 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center">
                <i className="ri-coins-line text-yellow-600 text-lg mr-2"></i>
                <span className="text-sm text-gray-700">{t('sidebar.currentCash')}</span>
                {cashLoading ? (
                  <span className="ml-auto font-bold text-yellow-400 animate-pulse">로딩 중...</span>
                ) : cashError ? (
                  <span className="ml-auto text-sm font-bold text-red-600">오류</span>
                ) : (
                  <span className="ml-auto font-bold text-yellow-600">{formatNumber(userCash)} P</span>
                )}
              </div>

              {showDepositorInput ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{t('sidebar.amountToDeposit')}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(chargeAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 border border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{t('sidebar.bank')}</span>
                      <span className="font-semibold text-gray-900">카카오뱅크</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{t('sidebar.accountNumber')}</span>
                      <span className="font-semibold text-gray-900">3333-15-0302437</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{t('sidebar.accountHolder')}</span>
                      <span className="font-semibold text-gray-900">강만수</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      {t('sidebar.depositorName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={depositorName}
                      onChange={(event) => setDepositorName(event.target.value)}
                      placeholder={t('sidebar.depositorNamePlaceholder')}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      {t('sidebar.depositorNote')}
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-gray-700 space-y-1">
                    <p>{t('sidebar.chargeNotice1')}</p>
                    <p>{t('sidebar.chargeNotice2')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDepositorInput(false);
                        setDepositorName('');
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                      {t('sidebar.previous')}
                    </button>
                    <button
                      onClick={handleBankTransferConfirm}
                      disabled={chargeProcessing}
                      className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-70 font-medium text-sm transition-colors"
                    >
                      {chargeProcessing ? t('sidebar.processing') : t('sidebar.confirm')}
                    </button>
                  </div>
                </div>
              ) : bankTransferInfo ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3">{t('sidebar.bankTransferInfo')}</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>
                        <span className="font-medium text-gray-900">{t('sidebar.bank')}</span> {bankTransferInfo.bankName}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">{t('sidebar.accountNumber')}</span>{' '}
                        {bankTransferInfo.accountNumber}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">{t('sidebar.accountHolder')}</span> {bankTransferInfo.depositor}
                      </li>
                      <li>
                        <span className="font-medium text-gray-900">{t('sidebar.depositAmount')}</span>{' '}
                        {formatCurrency(bankTransferInfo.amount ?? chargeAmount)}
                      </li>
                      {bankTransferInfo.expectedDepositor ? (
                        <li>
                          <span className="font-medium text-gray-900">{t('sidebar.depositorName')}</span>{' '}
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
                    {t('sidebar.confirm')}
                  </button>
                </div>
              ) : (
                <>
                  {/* 포인트 패키지 선택 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{t('sidebar.pointPackage')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {chargeOptions.map((option, index) => {
                        const totalPoints = option.amount + (option.bonus ?? 0);
                        const bonusPercent = option.bonus && option.amount > 0
                          ? Math.round((option.bonus / option.amount) * 100)
                          : 0;
                        const paymentAmount = isEnglishSite && 'amountUSD' in option
                          ? `$${option.amountUSD}`
                          : formatCurrency(option.amount);
                        
                        return (
                          <button
                            key={index}
                            onClick={() => setChargeAmount(option.amount)}
                            className={`relative p-3 border rounded-lg text-left transition-colors ${
                              chargeAmount === option.amount
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-base font-bold text-gray-900">
                                {t('sidebar.totalPoints', { amount: formatPoints(totalPoints) })}
                              </span>
                              <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                                {chargeAmount === option.amount && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                              </div>
                            </div>
                            {option.bonus && option.bonus > 0 ? (
                              <p className="text-xs text-gray-600 mt-1">
                                {t('sidebar.payAndBonus', {
                                  payment: paymentAmount,
                                  bonus: formatPoints(option.bonus),
                                  percent: `${bonusPercent}%`
                                })}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-600 mt-1">
                                {paymentAmount} {isEnglishSite ? 'payment' : '결제'}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 결제방법 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{t('sidebar.paymentMethod')}</h3>
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
                                alert(t('mobile.cash.paymentUnavailable'));
                                return;
                              }
                              setSelectedPayment(method.id as 'card' | 'kakaopay' | 'bank' | 'paypal');
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
                                <span className="text-sm font-medium">
                                  {method.id === 'card' 
                                    ? t('sidebar.creditCard') 
                                    : method.id === 'kakaopay' 
                                    ? t('sidebar.kakaoPay') 
                                    : method.id === 'paypal'
                                    ? t('payment.paypal')
                                    : t('sidebar.bankTransfer')}
                                </span>
                              </div>
                              <div className="w-4 h-4 border-2 rounded-full flex items-center justify-center">
                                {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                              </div>
                            </div>
                            {method.badge ? (
                              <div className="mt-1">
                                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
                                  {t('sidebar.preparing')}
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
                        {t('sidebar.agreement')}
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
                    {chargeProcessing ? t('sidebar.processing') : t('sidebar.charge')}
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
