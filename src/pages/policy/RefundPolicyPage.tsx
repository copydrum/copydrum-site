import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import MainHeader from '../../components/common/MainHeader';

const RefundPolicyPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} />
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t('refundPolicy.title')}</h1>
          <p className="text-sm text-gray-500">{t('refundPolicy.lastUpdated')}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('refundPolicy.sections.digitalProducts.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('refundPolicy.sections.digitalProducts.description1')}
            <strong> {t('refundPolicy.sections.digitalProducts.emphasis')}</strong>
            {t('refundPolicy.sections.digitalProducts.description2')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('refundPolicy.sections.exceptions.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('refundPolicy.sections.exceptions.description')}
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed md:text-base space-y-1">
            <li>{t('refundPolicy.sections.exceptions.items.item1')}</li>
            <li>{t('refundPolicy.sections.exceptions.items.item2')}</li>
            <li>{t('refundPolicy.sections.exceptions.items.item3')}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('refundPolicy.sections.request.title')}</h2>
          <p className="text-sm text-gray-700 leading-relaxed md:text-base">
            {t('refundPolicy.sections.request.description')}
            <strong> {t('refundPolicy.sections.request.email')}</strong>
          </p>
        </section>
      </main>
    </div>
  );
};

export default RefundPolicyPage;
