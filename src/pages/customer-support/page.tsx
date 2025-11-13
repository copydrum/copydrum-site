
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainHeader from '../../components/common/MainHeader';
import Footer from '../../components/common/Footer';
import UserSidebar from '../../components/feature/UserSidebar';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function CustomerSupport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'faq' | 'contact'>(() =>
    searchParams.get('tab') === 'contact' ? 'contact' : 'faq',
  );
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
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

  useEffect(() => {
    const tabParam = searchParams.get('tab');

    if (tabParam === 'contact' && activeTab !== 'contact') {
      setActiveTab('contact');
      return;
    }

    if (!tabParam && activeTab !== 'faq') {
      setActiveTab('faq');
    }
  }, [activeTab, searchParams]);

  const handleTabChange = useCallback(
    (tab: 'faq' | 'contact') => {
      setActiveTab(tab);

      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);

        if (tab === 'faq') {
          params.delete('tab');
        } else {
          params.set('tab', tab);
        }

        return params;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || (user.user_metadata?.name as string) || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  const faqs = [
    {
      category: '주문/결제',
      items: [
        {
          question: '악보를 구매한 후 언제 다운로드할 수 있나요?',
          answer: '결제 완료 즉시 마이페이지에서 다운로드가 가능합니다. 구매한 악보는 언제든지 재다운로드할 수 있습니다.'
        },
        {
          question: '결제 방법은 어떤 것들이 있나요?',
          answer: '신용카드, 체크카드, 계좌이체, 간편결제(카카오페이) 등을 지원합니다.'
        },
        {
          question: '환불은 어떻게 받을 수 있나요?',
          answer: '디지털 상품 특성상 다운로드 전에만 환불이 가능합니다. 다운로드 후에는 환불이 어려우니 신중히 구매해 주세요.'
        }
      ]
    },
    {
      category: '악보/다운로드',
      items: [
        {
          question: '악보 파일 형식은 무엇인가요?',
          answer: '모든 악보는 고화질 PDF 형식으로 제공됩니다. 인쇄와 디지털 기기에서 모두 최적화되어 있습니다.'
        },
        {
          question: '다운로드한 악보를 인쇄할 수 있나요?',
          answer: '네, 개인 연습용으로 인쇄하실 수 있습니다. 단, 상업적 이용이나 재배포는 금지되어 있습니다.'
        },
        {
          question: '악보 난이도는 어떻게 구분되나요?',
          answer: '초급(기본 패턴), 중급(변형 패턴 포함), 고급(복잡한 테크닉 포함)으로 구분됩니다.'
        }
      ]
    },
    {
      category: '주문제작',
      items: [
        {
          question: '주문제작은 어떤 서비스인가요?',
          answer: '원하시는 곡의 드럼 악보를 전문가가 직접 제작해드리는 맞춤 서비스입니다.'
        },
        {
          question: '제작 기간은 얼마나 걸리나요?',
          answer: '곡의 복잡도에 따라 1-7일 정도 소요됩니다. 정확한 일정은 신청 후 개별 안내드립니다.'
        },
        {
          question: '제작 비용은 어떻게 결정되나요?',
          answer: '곡의 길이, 복잡도, 난이도 등을 종합적으로 고려하여 견적을 제공합니다.'
        }
      ]
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.category || !formData.subject || !formData.message) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const trimmedName = formData.name.trim();
      const trimmedEmail = formData.email.trim();
      const trimmedSubject = formData.subject.trim();
      const trimmedMessage = formData.message.trim();

      const { error: insertError } = await supabase.from('customer_inquiries').insert({
        user_id: user?.id ?? null,
        name: trimmedName,
        email: trimmedEmail,
        category: formData.category,
        subject: trimmedSubject,
        message: trimmedMessage,
        status: 'pending',
      });

      if (insertError) {
        throw insertError;
      }

      alert('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.');
      setFormData({
        name: user
          ? ((user.user_metadata?.name as string) ?? trimmedName)
          : '',
        email: user ? user.email ?? trimmedEmail : '',
        category: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('고객 문의 저장 실패:', error);
      alert('문의 전송 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <UserSidebar user={user} />
      <div className={user ? 'mr-64' : ''}>
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">고객센터</h1>
          <p className="text-xl text-blue-100">
            궁금한 점이 있으시면 언제든지 문의해주세요. 빠르고 정확한 답변을 드리겠습니다.
          </p>
        </div>
        </section>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => handleTabChange('faq')}
              className={`px-6 py-3 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'faq'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              자주 묻는 질문
            </button>
            <button
              onClick={() => handleTabChange('contact')}
              className={`px-6 py-3 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'contact'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              문의하기
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        {activeTab === 'faq' && (
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {faqs.map((category, categoryIndex) => (
                <div key={categoryIndex} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">{category.category}</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {category.items.map((faq, faqIndex) => (
                      <div key={faqIndex} className="p-6">
                        <h4 className="text-md font-medium text-gray-900 mb-3 flex items-start">
                          <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full mr-3 mt-0.5 flex-shrink-0">
                            Q
                          </span>
                          {faq.question}
                        </h4>
                        <div className="ml-8">
                          <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Form Section */}
        {activeTab === 'contact' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">문의하기</h2>
                <p className="text-gray-600">
                  궁금한 점이나 문제가 있으시면 아래 양식을 작성해 주세요. 빠른 시일 내에 답변드리겠습니다.
                </p>
              </div>

              <form id="customer-inquiry" data-readdy-form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      이름 *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      이메일 *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="이메일을 입력하세요"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    문의 유형 *
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
                  >
                    <option value="">문의 유형을 선택하세요</option>
                    <option value="주문/결제">주문/결제 문의</option>
                    <option value="악보/다운로드">악보/다운로드 문의</option>
                    <option value="주문제작">주문제작 문의</option>
                    <option value="기술지원">기술지원</option>
                    <option value="기타">기타 문의</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    제목 *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="문의 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    문의 내용 *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    maxLength={500}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="문의 내용을 자세히 작성해 주세요 (최대 500자)"
                  />
                  <div className="text-right text-sm text-gray-500 mt-1">
                    {formData.message.length}/500자
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-medium transition-colors whitespace-nowrap cursor-pointer disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {submitting ? '전송 중...' : '문의 보내기'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">연락처 정보</h2>
            <p className="text-lg text-gray-600">다양한 방법으로 문의하실 수 있습니다</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-mail-line text-blue-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">이메일 문의</h3>
              <p className="text-gray-600 mb-2">copydrum@hanmail.net</p>
              <p className="text-sm text-gray-500">24시간 접수, 1일 내 답변</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-time-line text-blue-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">운영시간</h3>
              <p className="text-gray-600 mb-2">평일 09:00 - 17:00</p>
              <p className="text-sm text-gray-500">주말 및 공휴일 휴무</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-chat-3-line text-blue-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">실시간 채팅</h3>
              <p className="text-gray-600 mb-2">웹사이트 우하단 채팅버튼</p>
              <p className="text-sm text-gray-500">운영시간 내 실시간 상담</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      </div>
    </div>
  );
}
