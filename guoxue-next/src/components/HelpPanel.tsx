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
      <div className="help-panel-footer">
        <p className="help-tip">{t('tip')}</p>
      </div>
    </div>
  );
}
