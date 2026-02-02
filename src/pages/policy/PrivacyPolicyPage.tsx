import React from 'react';
import { useTranslation } from 'react-i18next';
import MainHeader from '../../components/common/MainHeader';
import { useAuthStore } from '../../stores/authStore';

const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t('privacy.title')}</h1>
          <p className="text-sm text-gray-500">{t('privacy.lastUpdated')}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('privacy.sections.collect.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('privacy.sections.collect.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('privacy.sections.use.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('privacy.sections.use.description')}
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed md:text-base space-y-1">
            <li>{t('privacy.sections.use.items.item1')}</li>
            <li>{t('privacy.sections.use.items.item2')}</li>
            <li>{t('privacy.sections.use.items.item3')}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('privacy.sections.payment.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('privacy.sections.payment.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('privacy.sections.cookies.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('privacy.sections.cookies.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('privacy.sections.contact.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('privacy.sections.contact.description')}
            <strong> {t('privacy.sections.contact.email')}</strong>
          </p>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
