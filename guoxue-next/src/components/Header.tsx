'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import Image from 'next/image';
import Link from 'next/link';
import HelpPanel from './HelpPanel';
import PricingModal from './PricingModal';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const { isLoggedIn, logout, isLoading, getDisplayName, isPremium } = useAuth();

  const isZh = locale === 'zh';

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleLogout = () => {
    logout();
  };

  const handleUpgradeClick = () => {
    if (!isLoggedIn) {
      // 未登录时跳转到登录页
      router.push('/login');
    } else {
      // 已登录时打开定价弹窗
      setIsPricingOpen(true);
    }
  };

  return (
    <header className="header">
      <div className="auth-bar">
        <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-3">
          <button
            onClick={() => switchLocale('zh')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              locale === 'zh'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-purple-100'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => switchLocale('en')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              locale === 'en'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-purple-100'
            }`}
          >
            EN
          </button>
        </div>

        {isLoading ? (
          <div className="auth-section">
            <span className="text-gray-400 text-sm">...</span>
          </div>
        ) : isLoggedIn ? (
          <div className="user-section">
            {isPremium ? (
              <div className="premium-wrapper">
                <button
                  className="premium-badge"
                  onClick={() => setIsManageOpen(!isManageOpen)}
                >
                  {isZh ? '会员' : 'Premium'}
                </button>
                {isManageOpen && (
                  <div className="manage-dropdown">
                    <button
                      className="manage-item"
                      onClick={() => {
                        setIsManageOpen(false);
                        setIsPricingOpen(true);
                      }}
                    >
                      {isZh ? '升级年度计划' : 'Upgrade to Yearly'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleUpgradeClick} className="btn-upgrade">
                {isZh ? '升级会员' : 'Upgrade'}
              </button>
            )}
            <span className="user-name">{getDisplayName()}</span>
            <button onClick={handleLogout} className="btn-auth btn-logout">
              {t('nav.logout')}
            </button>
          </div>
        ) : (
          <div className="auth-section">
            <Link href={`/${locale}/login`} className="btn-auth btn-login">
              {t('nav.login')}
            </Link>
            <Link href={`/${locale}/login?mode=register`} className="btn-auth btn-register">
              {t('nav.register')}
            </Link>
          </div>
        )}
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
        <h1 className="title-calligraphy" data-locale={locale}>{t('site.title')}</h1>
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

      <div className="nav-buttons">
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
      </div>

      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {isPricingOpen && (
        <PricingModal onClose={() => setIsPricingOpen(false)} />
      )}

      <style jsx>{`
        .user-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-name {
          font-size: 13px;
          color: var(--accent);
          font-weight: 500;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-logout {
          padding: 4px 12px;
          font-size: 12px;
          color: var(--muted);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          color: var(--vermilion);
          border-color: var(--vermilion);
        }

        .btn-upgrade {
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #7a68a6 0%, #5a80b0 100%);
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(122, 104, 166, 0.3);
        }

        .btn-upgrade:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(122, 104, 166, 0.4);
        }

        .premium-wrapper {
          position: relative;
        }

        .premium-badge {
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #b8860b;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #f59e0b;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .premium-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
        }

        .manage-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          min-width: 140px;
          z-index: 100;
          overflow: hidden;
        }

        .manage-item {
          display: block;
          width: 100%;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--text);
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s;
        }

        .manage-item:hover {
          background: #f5f3ff;
          color: var(--accent);
        }

        .nav-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 16px;
        }
      `}</style>
    </header>
  );
}
