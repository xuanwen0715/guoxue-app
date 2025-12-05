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
        <h3 className="help-panel-title">{t('title')}</h3>
        <button
          className="help-close-btn" type="button" aria-label="关闭" onClick={onClose}>×</button>
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
        .help-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px 0;
        }
        .help-panel-title {
          margin: 0;
          font-family: var(--font-calligraphy), var(--font-serif), serif;
          font-weight: 600;
          letter-spacing: 0.6px;
          font-size: 20px;
          color: var(--ink);
        }
        .help-close-btn {
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 20px;
          line-height: 1;
          border-radius: 6px;
          cursor: pointer;
        }
        .help-close-btn:hover { background: rgba(0,0,0,0.06); color: var(--text); }
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
          background: linear-gradient(135deg, rgba(246, 242, 233, 0.96), rgba(252, 248, 240, 0.94));
          border: 1px solid rgba(187, 160, 120, 0.22);
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 6px rgba(187, 160, 120, 0.10);
        }
        .help-section h4 {
          margin: 0 0 8px;
          font-family: var(--font-calligraphy), var(--font-serif), serif;
          font-weight: 600;
          letter-spacing: 0.3px;
          font-size: 16px;
          color: var(--ink);
        }
        .help-list {
          list-style: none;
          margin: 0;
          padding: 0;
          color: var(--text);
          line-height: 1.65;
          font-size: 13.5px;
        }
        .help-list li {
          position: relative;
          padding-left: 16px;
        }
        .help-list li + li { margin-top: 4px; }
        .help-list li::before {
          content: '·';
          position: absolute;
          left: 4px;
          top: 0;
          color: var(--accent);
          font-size: 18px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}




