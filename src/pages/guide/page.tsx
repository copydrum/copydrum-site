import { useEffect, useMemo, useState } from 'react';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import UserSidebar from '../../components/feature/UserSidebar';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface GuideSection {
  title: string;
  icon: string;
  description: string;
  steps: {
    title: string;
    detail: string;
    highlight?: string;
  }[];
  cta?: {
    label: string;
    href: string;
  }[];
}

export default function GuidePage() {
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

  const guideSections = useMemo<GuideSection[]>(() => [
    {
      title: '3분 만에 따라하는 첫 구매',
      icon: 'ri-rocket-line',
      description: '처음 오신 분들을 위한 초간단 요약입니다. 아래 순서대로 진행하면 첫 악보 구매를 바로 완료할 수 있습니다.',
      steps: [
        {
          title: '1분 – 계정 만들기',
          detail: '회원가입 또는 소셜 로그인을 통해 빠르게 계정을 생성하세요.',
          highlight: '로그인 후 장바구니, 다운로드 메뉴가 활성화됩니다.'
        },
        {
          title: '1분 – 악보 찾기',
          detail: '검색창에서 곡명이나 아티스트를 입력하고 마음에 드는 악보를 선택합니다.'
        },
        {
          title: '1분 – 결제 & 다운로드',
          detail: '장바구니에 담아 결제를 완료하면 PDF 악보를 즉시 다운로드할 수 있습니다.'
        }
      ],
      cta: [
        { label: '회원가입 바로가기', href: '/register' },
        { label: '인기 악보 보러가기', href: '/categories' }
      ]
    },
    {
      title: '효과적으로 악보 검색하기',
      icon: 'ri-search-line',
      description: '검색 결과가 너무 많거나 원하는 곡이 보이지 않는다면, 다음 방법으로 검색을 정교하게 조정해 보세요.',
      steps: [
        {
          title: '키워드 조합',
          detail: '곡명+아티스트 처럼 단어를 두 개 이상 조합하면 정확도가 높아집니다.',
          highlight: '예: "봄날 드럼", "BTS 락 편곡"'
        },
        {
          title: '필터로 좁히기',
          detail: '카테고리 페이지에서 장르, 가격대, 난이도를 선택하면 원하는 악보만 추려집니다.'
        },
        {
          title: '결과 없음 대처',
          detail: '스펠링을 확인하고, 유사 키워드로 다시 검색해 보세요.'
        }
      ],
      cta: [
        { label: '악보 카테고리 보기', href: '/categories' },
        { label: '무료악보 확인', href: '/free-sheets' }
      ]
    },
    {
      title: '내게 맞는 악보 고르기',
      icon: 'ri-music-2-line',
      description: '난이도, 편곡 스타일, 악보 구성 등을 비교해보고 연습 목적에 맞는 악보를 선택하세요.',
      steps: [
        {
          title: '난이도 체크',
          detail: '초급/중급/고급으로 구분되어 있으며, 상세 설명에서 필요한 테크닉을 확인할 수 있습니다.',
          highlight: '초급: 기본 패턴, 중급: 필인 포함, 고급: 속도·테크닉 강조'
        },
        {
          title: '미리보기 활용',
          detail: '샘플 페이지와 데모 영상을 통해 원하는 스타일인지 확인하세요.'
        },
        {
          title: '가격 비교',
          detail: '단품, 모음집, 이벤트 악보를 함께 비교하면 더 합리적인 선택을 할 수 있습니다.'
        }
      ],
      cta: [
        { label: '이벤트 악보 둘러보기', href: '/event-sale' },
        { label: '악보 모음집 보기', href: '/collections' }
      ]
    },
    {
      title: '구매 프로세스 완벽 가이드',
      icon: 'ri-shopping-cart-2-line',
      description: '장바구니부터 결제 완료까지 실수 없이 진행할 수 있도록 단계별로 정리했습니다.',
      steps: [
        {
          title: '장바구니 담기',
          detail: '악보 상세 페이지에서 장바구니 버튼을 누르면 여러 악보를 한 번에 결제할 수 있습니다.',
          highlight: '장바구니 상단에서 프로모션 코드 입력 가능'
        },
        {
          title: '결제 정보 확인',
          detail: '결제 전 주문 내역, 할인 적용 여부, 이용 약관을 반드시 확인하세요.'
        },
        {
          title: '결제 수단 선택',
          detail: '신용카드, 계좌이체, 카카오페이 등을 지원하며, 결제 완료 후 안내 메일이 발송됩니다.'
        }
      ],
      cta: [
        { label: '장바구니 이동', href: '/cart' }
      ]
    },
    {
      title: '악보 다운로드',
      icon: 'ri-download-cloud-2-line',
      description: '구매한 악보는 즉시 PDF로 다운로드할 수 있으며, 언제든지 다시 받을 수 있습니다.',
      steps: [
        {
          title: '즉시 다운로드',
          detail: '구매 직후 구매 완료 페이지에서 바로 PDF 파일을 다운로드할 수 있습니다.'
        },
        {
          title: '마이페이지 재다운로드',
          detail: '마이페이지의 구매 내역에서 이미 구매한 악보를 다시 다운로드할 수 있습니다.',
          highlight: '구매한 악보는 제한 없이 재다운로드 가능합니다.'
        },
        {
          title: 'PDF 활용',
          detail: '고화질 PDF 파일로 제공되어 태블릿, 노트북에서 바로 연습하거나 원하는 크기로 인쇄할 수 있습니다.'
        }
      ],
      cta: [
        { label: '마이페이지 열기', href: '/mypage' },
        { label: '구매 내역 확인', href: '/my-orders' }
      ]
    },
    {
      title: '할인과 혜택 200% 활용하기',
      icon: 'ri-gift-line',
      description: '특가 이벤트, 악보캐쉬 충전 보너스, 주문제작 서비스를 활용하여 더 풍성한 연습 환경을 만들어보세요.',
      steps: [
        {
          title: '이벤트 악보',
          detail: '특가 코너에서 한정 기간 동안 100원 또는 할인된 가격으로 제공되는 악보를 확인하세요.',
          highlight: '이벤트 악보는 한정 수량/기간이므로 빠르게 확인!'
        },
        {
          title: '악보캐쉬 충전',
          detail: '충전 금액에 따라 추가 보너스가 지급됩니다. 대량 구매 예정이라면 미리 충전해 두세요.'
        },
        {
          title: '주문제작 비교',
          detail: '찾는 악보가 없다면 주문제작으로 정확한 편곡을 받아볼 수 있습니다. 예산과 일정에 맞게 선택하세요.'
        }
      ],
      cta: [
        { label: '주문제작 신청하기', href: '/custom-order' },
        { label: '진행중 주문 확인', href: '/custom-orders' }
      ]
    }
  ], []);

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <UserSidebar user={user} />
      <div className={user ? 'mr-64' : ''}>
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-white/15 mb-6">
            검색부터 다운로드까지, 한 번에 정리
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
            카피드럼 검색/구매 가이드
          </h1>
          <p className="text-lg text-blue-100 leading-relaxed max-w-3xl mx-auto">
            원하는 드럼 악보를 빠르게 찾고, 합리적으로 구매하고,<br />
            문제 없이 다운로드하는 방법을 한곳에 모았습니다.<br />
            신규 사용자부터 기존 회원까지 효율적인 연습을 위한 핵심 노하우를 확인해 보세요.
          </p>
        </div>
      </section>

        <main className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8">
              {guideSections.map((section) => (
                <div
                  key={section.title}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="p-8 sm:p-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <i className={`${section.icon} text-2xl text-blue-600`}></i>
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-2">{section.title}</h2>
                          <p className="text-gray-600 leading-relaxed">{section.description}</p>
                        </div>
                      </div>
                      {section.cta && (
                        <div className="flex flex-wrap gap-3">
                          {section.cta.map((item) => (
                            <a
                              key={item.label}
                              href={item.href}
                              className="inline-flex items-center px-5 py-2.5 rounded-full bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              {item.label}
                              <i className="ri-arrow-right-up-line text-lg ml-2"></i>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {section.steps.map((step, index) => (
                        <div
                          key={step.title}
                          className="group relative rounded-2xl border border-gray-100 bg-white p-6 hover:border-blue-200 hover:shadow-lg transition-all"
                        >
                          <div className="absolute -top-4 left-6 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-semibold">
                            {index + 1}
                          </div>
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{step.title}</h3>
                            <p className="text-gray-600 leading-relaxed text-sm">{step.detail}</p>
                            {step.highlight && (
                              <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 font-medium">
                                {step.highlight}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <section className="bg-white py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-8">
                <h3 className="text-2xl font-bold text-blue-900 mb-4">검색 꿀팁 모음</h3>
                <ul className="space-y-3 text-sm text-blue-900">
                  <li className="flex items-start">
                    <span className="mt-1 mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-blue-600">1</span>
                    <div>
                      <p className="font-semibold">추천 키워드</p>
                      <p className="text-blue-800/80">곡명 + 아티스트 로 검색하면 정확도가 상승합니다.</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="mt-1 mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-blue-600">2</span>
                    <div>
                      <p className="font-semibold">필터 조합</p>
                      <p className="text-blue-800/80">장르 + 난이도 + 가격대를 함께 설정하면 필요한 악보만 남습니다.</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="mt-1 mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white font-semibold text-blue-600">3</span>
                    <div>
                      <p className="font-semibold">검색 결과 없음</p>
                      <p className="text-blue-800/80">철자를 다시 확인하거나 비슷한 장르/아티스트로 검색 후 주문제작을 이용해보세요.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">구매 방식 비교</h3>
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-900">일반 구매</h4>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">추천</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-gray-600">
                      <li>· 즉시 결제 후 바로 PDF 다운로드</li>
                      <li>· 이벤트/무료 악보로 비용 절약 가능</li>
                      <li>· 다양한 장르·난이도 선택 가능</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-indigo-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-900">주문제작</h4>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600">맞춤형</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-gray-600">
                      <li>· 원하는 곡과 편곡 스타일을 그대로 제작</li>
                      <li>· 제작 기간 1~7일, 난이도에 따라 달라짐</li>
                      <li>· 견적 확인 후 결제 진행</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-10 sm:p-14 shadow-lg">
              <h2 className="text-3xl font-bold mb-4">도움이 더 필요하신가요?</h2>
              <p className="text-lg text-blue-100 mb-8 leading-relaxed">
                고객센터에서 자주 묻는 질문을 확인하거나, 문의하기를 통해 직접 상담을 요청하실 수 있습니다.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/categories"
                  className="inline-flex items-center px-6 py-3 rounded-full bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  지금 바로 악보 찾기
                  <i className="ri-arrow-right-up-line text-lg ml-2"></i>
                </a>
                <a
                  href="/event-sale"
                  className="inline-flex items-center px-6 py-3 rounded-full bg-white/20 text-white font-semibold hover:bg-white/25 transition-colors cursor-pointer"
                >
                  진행 중인 할인 악보 보기
                  <i className="ri-flashlight-line text-lg ml-2"></i>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="terms" className="bg-white py-16 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">이용약관 안내</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 space-y-4 text-gray-700 leading-relaxed">
              <p>
                COPYDRUM 서비스를 이용하는 모든 고객은 저작권을 존중하며 개인 연습 목적 범위에서 악보를 활용해야
                합니다. 구매한 악보의 무단 배포·복제·공유는 법적 제재 대상이며, 상업적 이용을 원하시는 경우 별도
                라이선스가 필요합니다.
              </p>
              <p>
                결제 후 즉시 다운로드가 제공되므로 디지털 콘텐츠 특성상 다운로드 완료 후에는 환불이 제한될 수
                있습니다. 결제, 주문제작, 이벤트 혜택 등 서비스 이용과 관련된 세부 정책은 고객센터 공지를 통해
                상시 업데이트됩니다.
              </p>
            </div>
          </div>
        </section>

        <section id="privacy" className="bg-gray-900 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-gray-100">
            <h2 className="text-3xl font-bold mb-6">개인정보처리방침 요약</h2>
            <div className="bg-white/10 border border-white/10 rounded-3xl p-8 space-y-4 leading-relaxed">
              <p>
                회원가입과 주문 처리, 고객 상담을 위해 이메일·이름·결제 정보 등 최소한의 개인정보를 수집하며,
                Supabase 기반 보안 환경에서 안전하게 보관합니다. 서비스 제공 목적 외에는 개인정보를 사용하지 않으며,
                제3자 제공 시에는 사전 동의 절차를 철저히 준수합니다.
              </p>
              <p>
                고객은 마이페이지 또는 고객센터를 통해 개인정보 열람·수정·삭제를 요청할 수 있으며, 요청 시 지체
                없이 처리됩니다. 개인정보 보호와 관련한 문의는 고객센터 1:1 문의 혹은 이메일을 통해 접수하실 수
                있습니다.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
 