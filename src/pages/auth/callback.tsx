import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import MainHeader from '../../components/common/MainHeader';

export default function AuthCallback() {
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
          console.error('OAuth 오류:', error, errorDescription);
          alert(`로그인에 실패했습니다: ${errorDescription || error}`);
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
              
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  email: data.user.email || '',
                  name: userMetadata.name || userMetadata.full_name || userMetadata.nickname || '사용자',
                  kakao_id: provider === 'kakao' ? userMetadata.sub : null,
                  google_id: provider === 'google' ? userMetadata.sub : null,
                  provider: provider,
                  role: 'user',
                });

              if (insertError) {
                console.error('프로필 생성 오류:', insertError);
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

            // 로그인 성공 - 현재 호스트의 홈으로 이동 (호스트 유지)
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            } else {
              navigate('/');
            }
          }
        } else {
          // 토큰이 없으면 로그인 페이지로
          navigate('/login');
        }
      } catch (err: any) {
        console.error('인증 콜백 처리 오류:', err);
        alert('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
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
          <p className="text-gray-600">로그인 처리 중...</p>
        </div>
      </main>
    </div>
  );
}

