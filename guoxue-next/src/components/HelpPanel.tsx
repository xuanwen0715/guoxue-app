'use client';

import { useTranslations } from 'next-intl';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const t = useTranslations('guide');

  if (!isOpen) return null;

  return (
    <div className="help-panel" role="dialog" aria-modal="true">
      <div className="help-panel-header">
        <h3 className="help-panel-title">
          <span className="help-panel-icon">📖</span>
          {t('title')}
        </h3>
        <button
          className="help-close-btn"
          type="button"
          aria-label="关闭"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="help-panel-content">
        <div className="help-grid">
        <div className="help-section">
          <h4><span className="help-num">壹</span> {t('section1.title')}</h4>
          <ul className="help-list">
            <li><strong>{t('section1.item1.title')}</strong>{t('section1.item1.desc')}</li>
            <li><strong>{t('section1.item2.title')}</strong>{t('section1.item2.desc')}</li>
            <li><strong>{t('section1.item3.title')}</strong>{t('section1.item3.desc')}</li>
            <li><strong>{t('section1.item4.title')}</strong>{t('section1.item4.desc')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4><span className="help-num">贰</span> {t('section2.title')}</h4>
          <ul className="help-list">
            <li><strong>{t('section2.item1.title')}</strong>{t('section2.item1.desc')}</li>
            <li><strong>{t('section2.item2.title')}</strong>{t('section2.item2.desc')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4><span className="help-num">叁</span> {t('section3.title')}</h4>
          <ul className="help-list">
            <li>{t('section3.item1')}</li>
            <li>{t('section3.item2')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4><span className="help-num">肆</span> {t('section4.title')}</h4>
          <ul className="help-list">
            <li>{t('section4.item1')}</li>
            <li>{t('section4.item2')}</li>
          </ul>
        </div>
        </div>
      </div>
      <div className="help-panel-footer">
        <p className="help-tip">{t('tip')}</p>
      </div>
      <style jsx>{`
        .help-panel-content {
          padding: 12px 16px;
        }
        .help-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          counter-reset: helpstep;
        }
        @media (min-width: 768px) {
          .help-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .help-section {
          counter-increment: helpstep;
          background: linear-gradient(145deg, rgba(248, 245, 252, 0.9), rgba(252, 250, 255, 0.85));
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
        }
        .help-section h4 {
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--ink);
        }
        .help-num {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: #fff;
          font-weight: 700;
          font-size: 12px;
        }
        .help-num::before { content: counter(helpstep); }
        .help-list {
          margin: 0;
          padding-left: 18px;
          color: var(--text);
          line-height: 1.6;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
