import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import UserSidebar from '../../components/feature/UserSidebar';
import { supabase } from '../../lib/supabase';

interface Partner {
  name: string;
  description: string;
  region: 'domestic' | 'global';
}

const domesticPartners: Partner[] = [];

const globalPartners: Partner[] = [];

export default function PartnershipPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user ?? null);
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <MainHeader user={user} />
      <UserSidebar user={user} />
      <div className={user ? 'md:mr-64' : ''}>
        <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-4">파트너십 안내</h1>
            <p className="text-lg text-purple-100 leading-relaxed">
              COPYDRUM은 파트너십을 통해 더 많은 드러머에게 최고의 콘텐츠를 전달합니다.
            </p>
          </div>
        </section>

        <main className="py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <section>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">파트너십 혜택</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">전용 악보 라이선스</h3>
                  <p className="text-gray-700 leading-relaxed">
                    공연, 레슨, 판매 등 다양한 환경에서 활용할 수 있도록 맞춤형 라이선스를 제공합니다.
                  </p>
                </div>
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">프리미엄 지원</h3>
                  <p className="text-gray-700 leading-relaxed">
                    신규 악보 요청, 커스텀 채보, 공동 마케팅 등 파트너를 위한 전담 지원을 제공합니다.
                  </p>
                </div>
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">공유 성장</h3>
                  <p className="text-gray-700 leading-relaxed">
                    공동 프로젝트와 이벤트를 통해 드러머 커뮤니티를 함께 확장합니다.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-gray-900 text-white rounded-2xl p-10 space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-4">파트너십 문의</h2>
                <p className="text-lg text-gray-200 leading-relaxed">
                  COPYDRUM과의 파트너십을 통해 함께 성장할 준비가 되셨나요? 아래 연락처로 문의해 주세요.
                </p>
              </div>
              <div className="space-y-3 text-lg">
                <p>
                  이메일{' '}
                  <a
                    href="mailto:copydrum.hanmail.net"
                    className="text-blue-200 hover:text-white underline underline-offset-4 cursor-pointer"
                  >
                    copydrum.hanmail.net
                  </a>
                </p>
                <p>담당자 빠른 회신을 위해 문의 내용을 상세히 작성해 주시면 감사하겠습니다.</p>
              </div>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

