'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function Feedback() {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    // 模拟提交
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setMessage('');
      setEmail('');

      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
      }, 2000);
    }, 1000);
  };

  return (
    <div className="feedback-widget">
      {/* 切换按钮 */}
      <button
        className="feedback-toggle"
        id="feedback-toggle"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('feedback.title')}
        title={t('feedback.title')}
      >
        <span className="feedback-icon">📝</span>
      </button>

      {/* 反馈面板 */}
      {isOpen && (
        <div className="feedback-panel" id="feedback-panel">
          <div className="feedback-header">
            <h4>{t('feedback.title')}</h4>
            <button
              className="feedback-close"
              id="feedback-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {isSuccess ? (
            <div className="feedback-success" id="feedback-success">
              <span className="success-icon">✓</span>
              <span>{t('feedback.success')}</span>
            </div>
          ) : (
            <form id="feedback-form" className="feedback-form" onSubmit={handleSubmit}>
              <textarea
                id="feedback-message"
                className="feedback-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('feedback.placeholder')}
                rows={4}
                required
              />
              <div className="feedback-footer">
                <input
                  type="email"
                  id="feedback-email"
                  className="feedback-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('feedback.emailPlaceholder')}
                />
                <button type="submit" className="feedback-submit" disabled={isSubmitting}>
                  {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
