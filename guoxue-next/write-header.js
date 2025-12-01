const fs = require('fs');

const content = `'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import Image from 'next/image';
import HelpPanel from './HelpPanel';

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="header">
      <div className="auth-bar">
        <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-3">
          <button
            onClick={() => switchLocale('zh')}
            className={\`px-2 py-1 text-xs rounded transition-all \${
              locale === 'zh'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-purple-100'
            }\`}
          >
            中文
          </button>
          <button
            onClick={() => switchLocale('en')}
            className={\`px-2 py-1 text-xs rounded transition-all \${
              locale === 'en'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-purple-100'
            }\`}
          >
            EN
          </button>
        </div>

        <div className="auth-section">
          <a href={\`/\${locale}/login\`} className="btn-auth btn-login">
            {t('nav.login')}
          </a>
          <a href={\`/\${locale}/login?mode=register\`} className="btn-auth btn-register">
            {t('nav.register')}
          </a>
        </div>
      </div>

      <Image
        className="phoenix-header"
        src="/assets/phoenix-colorful.png"
        alt=""
        width={280}
        height={280}
        aria-hidden="true"
      />

      <div className="title-wrapper">
        <h1 className="title-calligraphy">{t('site.title')}</h1>
        <Image
          className="seal-decor"
          src="/assets/seal.svg"
          alt=""
          width={50}
          height={50}
          aria-hidden="true"
        />
      </div>
      <p className="subtitle">{t('site.subtitle')}</p>

      <div className="title-divider" aria-hidden="true">
        <span className="divider-line"></span>
        <span className="divider-dot"></span>
        <span className="divider-line"></span>
      </div>

      <button
        className="help-toggle-btn"
        type="button"
        onClick={() => setIsHelpOpen(true)}
        aria-expanded={isHelpOpen}
        aria-controls="help-panel"
      >
        <span className="help-icon">?</span>
        <span className="help-text">{t('nav.guide')}</span>
      </button>

      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </header>
  );
}
`;

fs.writeFileSync('./src/components/Header.tsx', content);
console.log('Header.tsx written successfully');
