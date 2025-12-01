'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@/context/QueryContext';

export default function ActionButtons() {
  const t = useTranslations();
  const { isLoading, handleQuery, handleCopy, handleClear } = useQuery();

  return (
    <div className="actions">
      <button
        id="submit-button"
        className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
        type="button"
        disabled={isLoading}
        onClick={handleQuery}
      >
        {isLoading ? t('actions.querying') : t('actions.query')}
      </button>
      <div className="secondary-group">
        <button
          id="copy-button"
          className="btn btn-secondary"
          type="button"
          onClick={handleCopy}
        >
          {t('actions.copy')}
        </button>
        <button
          id="clear-button"
          className="btn btn-secondary"
          type="button"
          onClick={handleClear}
        >
          {t('actions.clear')}
        </button>
      </div>
    </div>
  );
}
