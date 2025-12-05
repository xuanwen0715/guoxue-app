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
          <span className="help-panel-icon">馃摉</span>
          {t('title')}
        </h3>
        <button
          className="help-close-btn"
          type="button"
          aria-label="鍏抽棴"
          onClick={onClose}
        >
          脳
        </button>
      </div>
      <div className="help-panel-content">
        <div className="help-grid">
        <div className="help-section">
          <h4>{t('section1.title')}</h4>
          <ul className="help-list">
            <li><strong>{t('section1.item1.title')}</strong>{t('section1.item1.desc')}</li>
            <li><strong>{t('section1.item2.title')}</strong>{t('section1.item2.desc')}</li>
            <li><strong>{t('section1.item3.title')}</strong>{t('section1.item3.desc')}</li>
            <li><strong>{t('section1.item4.title')}</strong>{t('section1.item4.desc')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>{t('section2.title')}</h4>
          <ul className="help-list">
            <li><strong>{t('section2.item1.title')}</strong>{t('section2.item1.desc')}</li>
            <li><strong>{t('section2.item2.title')}</strong>{t('section2.item2.desc')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>{t('section3.title')}</h4>
          <ul className="help-list">
            <li>{t('section3.item1')}</li>
            <li>{t('section3.item2')}</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>{t('section4.title')}</h4>
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
        }
        @media (min-width: 768px) {
          .help-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .help-section {
          background: linear-gradient(135deg, rgba(122,104,166,0.06), rgba(90,128,176,0.04));
          border: 1px solid rgba(122,104,166,0.18);
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 6px rgba(122,104,166,0.08);
        }
        .help-section h4 {
          margin: 0 0 8px;
          font-family: var(--font-serif);
          font-weight: 600;
          letter-spacing: 0.2px;
          font-size: 15px;
          color: var(--accent);
        }
        .help-list {
          margin: 0;
          padding-left: 18px;
          color: var(--text);
          line-height: 1.6;
          font-size: 13.5px;
        }
      `}</style>
    </div>
  );
}




