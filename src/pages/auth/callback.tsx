import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MainHeader from '../../components/common/MainHeader';

export default function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // URL에서 hash fragment 추출
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        if (error) {
          console.error(t('authCallback.console.oauthError'), error, errorDescription);
          alert(`${t('authCallback.errors.oauthError')}: ${errorDescription || error}`);
          navigate('/login');
          return;
        }

        if (accessToken && refreshToken) {
          // Supabase 세션 설정
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }

          if (data.user) {
            // 사용자 프로필 확인 및 생성
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError && profileError.code === 'PGRST116') {
              // 프로필이 없으면 생성
              const userMetadata = data.user.user_metadata || {};
              const provider = data.user.app_metadata?.provider || 'oauth';
              
              // name 필드는 null로 설정 (표시명은 getUserDisplayName으로 처리)
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  email: data.user.email || '',
                  name: null,
                  kakao_id: provider === 'kakao' ? userMetadata.sub : null,
                  google_id: provider === 'google' ? userMetadata.sub : null,
                  provider: provider,
                  role: 'user',
                });

              if (insertError) {
                console.error(t('authCallback.console.profileCreationError'), insertError);
              }
            } else if (profile) {
              // 기존 프로필 업데이트 (소셜 ID가 없으면 추가)
              const provider = data.user.app_metadata?.provider || 'oauth';
              const userMetadata = data.user.user_metadata || {};
              const updates: any = {};

              if (provider === 'kakao' && !profile.kakao_id) {
                updates.kakao_id = userMetadata.sub;
              }
              if (provider === 'google' && !profile.google_id) {
                updates.google_id = userMetadata.sub;
              }
              if (!profile.provider) {
                updates.provider = provider;
              }

              if (Object.keys(updates).length > 0) {
                await supabase
                  .from('profiles')
                  .update(updates)
                  .eq('id', data.user.id);
              }
            }

            // 로그인 성공 - 현재 호스트의 홈으로 이동 (호스트 유지, 해시 제거)
            // 만약 잘못된 호스트로 리다이렉트되었다면 올바른 호스트로 이동
            if (typeof window !== 'undefined') {
              const currentOrigin = window.location.origin;
              const currentHost = window.location.host;
              
              // en.copydrum.com에서 시작했는데 copydrum.com으로 왔다면 다시 en.copydrum.com으로
              // localStorage에 원래 호스트 정보 저장 (로그인 시작 시 저장)
              const originalHost = localStorage.getItem('oauth_original_host');
              if (originalHost && originalHost !== currentHost) {
                const protocol = window.location.protocol;
                window.location.replace(`${protocol}//${originalHost}/`);
                localStorage.removeItem('oauth_original_host');
                return;
              }
              
              window.location.replace(`${currentOrigin}/`);
            } else {
              navigate('/');
            }
          }
        } else {
          // 토큰이 없으면 로그인 페이지로
          navigate('/login');
        }
      } catch (err: any) {
        console.error(t('authCallback.console.callbackError'), err);
        alert(t('authCallback.errors.callbackError'));
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MainHeader />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">{t('authCallback.loading')}</p>
        </div>
      </main>
    </div>
  );
}

