'use client';

import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations();

  return (
    <footer className="footer" aria-hidden="true">
      <div className="footer-divider"></div>
      <p className="footer-text">{t('footer.text')}</p>
    </footer>
  );
}
