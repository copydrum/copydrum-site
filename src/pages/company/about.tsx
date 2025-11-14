import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import UserSidebar from '../../components/feature/UserSidebar';
import { supabase } from '../../lib/supabase';

export default function CompanyAboutPage() {
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
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-4">COPYDRUM 소개</h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              2010년부터 전문 드러머와 드럼 애호가들을 위해 최고의 악보를 제작하고 서비스해온 카피드럼을
              소개합니다.
            </p>
          </div>
        </section>

        <main className="py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <section>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">우리의 미션</h2>
              <p className="text-lg leading-relaxed text-gray-700">
                COPYDRUM은 드러머들이 언제 어디서나 신뢰할 수 있는 악보를 통해 음악적 영감을 얻고 연주력을
                향상시킬 수 있도록 돕는 것을 목표로 합니다. 우리는 정교한 채보, 고품질 PDF, 실용적인 편곡을 통해
                모든 드러머에게 필요한 자료를 제공합니다.
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">10년이 넘는 노하우</h3>
                <p className="text-gray-700 leading-relaxed">
                  2010년부터 운영해온 카피드럼은 국내외의 수많은 드러머들과 함께 성장해 왔습니다. 오랜 시간 쌓아온
                  채보 경험과 노하우로 초급부터 프로 뮤지션까지 모든 수준의 연주자를 위한 악보를 제공합니다.
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">전 세계로 확장된 네트워크</h3>
                <p className="text-gray-700 leading-relaxed">
                  COPYDRUM은 아시아와 북미, 유럽 등 전 세계 드러머들에게 악보를 공급하며 글로벌 네트워크를 구축해
                  왔습니다. 다양한 장르와 스타일의 드러머들이 신뢰하고 찾는 글로벌 악보 플랫폼으로 성장하고 있습니다.
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <h4 className="text-xl font-semibold text-blue-900 mb-3">전문 채보진</h4>
                <p className="text-blue-800 leading-relaxed">
                  10년 이상 경력을 가진 전문 채보진과 현직 드러머들이 직접 검수하여 완성도 높은 악보를 제공합니다.
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                <h4 className="text-xl font-semibold text-purple-900 mb-3">다양한 장르</h4>
                <p className="text-purple-800 leading-relaxed">
                  가요, 팝, 락, 재즈, CCM, OST 등 다양한 장르의 악보를 보유하고 있으며, 최신 곡도 빠르게 업데이트합니다.
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                <h4 className="text-xl font-semibold text-emerald-900 mb-3">지속적인 업데이트</h4>
                <p className="text-emerald-800 leading-relaxed">
                  오랜 시간 운영하면서 쌓아온 데이터와 사용자 피드백을 기반으로 새로운 악보를 꾸준히 업데이트합니다.
                </p>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-lg p-10 border border-gray-100">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">COPYDRUM이 약속하는 가치</h3>
              <ul className="space-y-4 text-gray-700 leading-relaxed">
                <li>
                  <span className="font-semibold text-blue-600">정확성</span> — 실제 연주에 기반한 정밀한 채보로
                  연습 시간을 단축합니다.
                </li>
                <li>
                  <span className="font-semibold text-blue-600">접근성</span> — 모바일과 태블릿에서도 최적화된 고화질
                  PDF를 제공합니다.
                </li>
                <li>
                  <span className="font-semibold text-blue-600">연결성</span> — 드러머 커뮤니티와 함께 성장하며 필요한
                  콘텐츠를 빠르게 제공합니다.
                </li>
              </ul>
            </section>

            <section>
              <div className="bg-gray-900 text-white rounded-2xl p-10">
                <h3 className="text-2xl font-semibold mb-4">드러머들의 성장 파트너</h3>
                <p className="text-gray-200 leading-relaxed">
                  COPYDRUM은 드러머들이 꿈꾸는 무대를 함께 만들어가는 파트너가 되겠습니다. 앞으로도 최고의 악보와
                  서비스로 여러분 곁을 지키겠습니다.
                </p>
              </div>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}


