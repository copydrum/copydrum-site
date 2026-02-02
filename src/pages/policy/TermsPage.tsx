import React from 'react';
import { useTranslation } from 'react-i18next';
import MainHeader from '../../components/common/MainHeader';
import { useAuthStore } from '../../stores/authStore';

const TermsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t('terms.title')}</h1>
          <p className="text-sm text-gray-500">{t('terms.lastUpdated')}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('terms.sections.introduction.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.introduction.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('terms.sections.digitalProducts.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.digitalProducts.description1')}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.digitalProducts.description2')}
            <strong> {t('terms.sections.digitalProducts.emphasis')}</strong>
            {t('terms.sections.digitalProducts.description3')}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.digitalProducts.restrictionsTitle')}
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed md:text-base space-y-1">
            <li>{t('terms.sections.digitalProducts.restrictions.item1')}</li>
            <li>{t('terms.sections.digitalProducts.restrictions.item2')}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('terms.sections.payments.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.payments.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('terms.sections.liability.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.liability.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('terms.sections.contact.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('terms.sections.contact.description')}
            <strong> {t('terms.sections.contact.email')}</strong>
          </p>
        </section>
      </main>
    </div>
  );
};

export default TermsPage;
