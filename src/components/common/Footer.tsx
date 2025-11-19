import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isEnglishHost } from '../../i18n/languages';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export default function Footer() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const isEnglishSite = typeof window !== 'undefined' && isEnglishHost(window.location.host);

  // 카테고리 링크 (영어 사이트일 때 영어로 표시)
  const categoryLinks: FooterLink[] = isEnglishSite
    ? [
        { label: t('category.kpop'), href: '/categories?search=가요' },
        { label: t('category.pop'), href: '/categories?search=팝' },
        { label: t('category.rock'), href: '/categories?search=락' },
        { label: t('category.jazz'), href: '/categories?search=재즈' },
        { label: t('category.jpop'), href: '/categories?search=J-POP' },
        { label: t('category.ost'), href: '/categories?search=OST' },
      ]
    : [
        { label: '가요', href: '/categories?search=가요' },
        { label: '팝', href: '/categories?search=팝' },
        { label: '락', href: '/categories?search=락' },
        { label: '재즈', href: '/categories?search=재즈' },
        { label: 'J-POP', href: '/categories?search=J-POP' },
        { label: 'OST', href: '/categories?search=OST' },
      ];

  const supportLinks: FooterLink[] = [
    { label: t('footer.guide'), href: '/guide' },
    { label: t('footer.faq'), href: '/customer-support' },
    { label: t('footer.contact'), href: '/customer-support?tab=contact' },
    { label: isEnglishSite ? 'Refund & Delivery Policy' : '환불정책', href: '/policy/refund' },
  ];

  const companyLinks: FooterLink[] = [
    { label: t('footer.about'), href: '/company/about' },
    { label: t('footer.businessInfo'), href: '/company/business-info' },
    { label: t('footer.terms'), href: '/guide#terms' },
    { label: t('footer.privacy'), href: '/guide#privacy' },
    { label: t('footer.partnership'), href: '/company/partnership' },
  ];

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
            {!isEnglishSite && (
              <div
                className="text-2xl font-bold mb-4 cursor-pointer"
                style={{ fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}
                onClick={handleInternalNavigation('/')}
              >
                {t('site.name')}
              </div>
            )}
            <p className="text-gray-400 mb-6 leading-relaxed">
              {t('footer.description')}
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
            <h5 className="font-semibold mb-4">{t('footer.categories')}</h5>
            <ul className="space-y-2">
              {categoryLinks.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-semibold mb-4">{t('footer.support')}</h5>
            <ul className="space-y-2">
              {supportLinks.map((link) => (
                <li key={link.label}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-semibold mb-4">{t('footer.company')}</h5>
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
              <p>{t('footer.companyInfo')}</p>
              <p>{t('footer.telecomLicense')}</p>
              <p>{t('footer.address')}</p>
              <p>{t('footer.contactInfo')}</p>
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

