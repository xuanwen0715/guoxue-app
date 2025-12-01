'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@/context/QueryContext';

export default function ResultBox() {
  const t = useTranslations();
  const { resultText, isLoading } = useQuery();

  return (
    <section
      id="result-container"
      className="result-box scroll-style"
      aria-live="polite"
      aria-busy={isLoading}
    >
      <div id="result-structured" className="result-structured" hidden></div>
      <p id="result-text" style={{ whiteSpace: 'pre-wrap' }}>
        {resultText || t('result.placeholder')}
      </p>
      <div className="scroll-corner top-left" aria-hidden="true"></div>
      <div className="scroll-corner top-right" aria-hidden="true"></div>
      <div className="scroll-corner bottom-left" aria-hidden="true"></div>
      <div className="scroll-corner bottom-right" aria-hidden="true"></div>
    </section>
  );
}
