'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const isZh = locale === 'zh';

  return (
    <footer className="footer">
      <div className="footer-divider"></div>
      <p className="footer-text">{t('footer.text')}</p>

      <div className="footer-links">
        <Link href="/terms" className="footer-link">
          {isZh ? '服务条款' : 'Terms'}
        </Link>
        <span className="footer-separator">·</span>
        <Link href="/privacy" className="footer-link">
          {isZh ? '隐私政策' : 'Privacy'}
        </Link>
      </div>
    </footer>
  );
}
