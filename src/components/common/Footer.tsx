import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const categoryLinks: FooterLink[] = [
  { label: '가요', href: '/categories?search=가요' },
  { label: '팝', href: '/categories?search=팝' },
  { label: '락', href: '/categories?search=락' },
  { label: '재즈', href: '/categories?search=재즈' },
  { label: 'J-POP', href: '/categories?search=J-POP' },
  { label: 'OST', href: '/categories?search=OST' },
];

const supportLinks: FooterLink[] = [
  { label: '이용 가이드', href: '/guide' },
  { label: '자주 묻는 질문', href: '/customer-support' },
  { label: '문의하기', href: '/customer-support?tab=contact' },
  { label: '환불 정책', href: '/customer-support?tab=faq' },
];

const companyLinks: FooterLink[] = [
  { label: '회사 소개', href: '/company/about' },
  { label: '이용약관', href: '/guide#terms' },
  { label: '개인정보처리방침', href: '/guide#privacy' },
  { label: '파트너십', href: '/company/partnership' },
];

export default function Footer() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const handleInternalNavigation = useCallback(
    (href: string) => () => {
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        window.location.href = href;
        return;
      }

      navigate(href);
    },
    [navigate],
  );

  const renderLink = (link: FooterLink) => {
    if (link.external || link.href.startsWith('http') || link.href.startsWith('mailto:')) {
      return (
        <a
          key={link.label}
          href={link.href}
          className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      );
    }

    return (
      <button
        key={link.label}
        type="button"
        onClick={handleInternalNavigation(link.href)}
        className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        {link.label}
      </button>
    );
  };

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div
              className="text-2xl font-bold mb-4 cursor-pointer"
              style={{ fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}
              onClick={handleInternalNavigation('/')}
            >
              카피드럼
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              전문 드러머부터 취미 드러머까지, 누구나 믿고 찾는 최고 품질의 드럼 악보를 제공합니다.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.youtube.com/@COPYDRUM"
                className="text-gray-400 hover:text-white cursor-pointer transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ri-youtube-fill text-2xl"></i>
              </a>
            </div>
          </div>

          <div>
            <h5 className="font-semibold mb-4">악보 카테고리</h5>
            <ul className="space-y-2">
              {categoryLinks.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-semibold mb-4">고객 지원</h5>
            <ul className="space-y-2">
              {supportLinks.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-semibold mb-4">회사 정보</h5>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="text-sm text-gray-400 space-y-2 flex-1">
              <p>회사명 COPYDRUM | 대표자 강만수 | 사업자등록번호 307-07-86155</p>
              <p>통신판매업 신고 : 제2020세종0099호</p>
              <p>주소 세종 남세종로 454 강남제일타워 8층</p>
              <p>
                연락처 070-7570-0028 (작업중에 연락이 어렵습니다. 1:1문의 또는 카카오톡 채팅을 이용해주세요.)
              </p>
              <p className="pt-2 text-gray-500">© {currentYear} COPYDRUM. All rights reserved.</p>
            </div>
            <div className="flex-shrink-0">
              <img src="/komca.jpg" alt="KOMCA" className="h-16 w-auto" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

