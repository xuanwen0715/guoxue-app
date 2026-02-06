'use client';

import { useTranslations } from 'next-intl';

interface OcrProgressProps {
  isProcessing: boolean;
  stage?: string;
  progress?: number;
}

const STAGE_NAMES: Record<string, string> = {
  auth: '验证身份',
  quota: '检查额度',
  cache: '查询缓存',
  analysis: '分析图像',
  classical: '古籍优化',
  ocr: '文字识别',
  enhance: '结果增强',
  ai_review: 'AI审校',
  cache_save: '保存结果',
  complete: '完成',
};

export default function OcrProgress({ 
  isProcessing, 
  stage = 'ocr',
  progress = 0 
}: OcrProgressProps) {
  const t = useTranslations();

  if (!isProcessing) return null;

  const stageName = STAGE_NAMES[stage] || '处理中';
  const displayProgress = progress > 0 ? progress : estimateProgress(stage);

  return (
    <div className="ocr-progress">
      <div className="ocr-progress-backdrop" />
      <div className="ocr-progress-content">
        <div className="ocr-progress-spinner">
          <div className="spinner-ring" />
          <div className="spinner-ring" />
          <div className="spinner-ring" />
        </div>
        <div className="ocr-progress-text">
          <span className="stage-name">{stageName}</span>
          <span className="stage-dots">...</span>
        </div>
        <div className="ocr-progress-bar">
          <div 
            className="ocr-progress-fill" 
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <div className="ocr-progress-percent">{Math.round(displayProgress)}%</div>
      </div>

      <style jsx>{`
        .ocr-progress {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ocr-progress-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(4px);
        }

        .ocr-progress-content {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 40px 48px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          min-width: 280px;
        }

        .ocr-progress-spinner {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .spinner-ring {
          position: absolute;
          inset: 0;
          border: 3px solid transparent;
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner-ring:nth-child(1) {
          animation-duration: 1s;
        }

        .spinner-ring:nth-child(2) {
          inset: 8px;
          border-top-color: var(--secondary);
          animation-duration: 1.5s;
          animation-direction: reverse;
        }

        .spinner-ring:nth-child(3) {
          inset: 16px;
          border-top-color: var(--accent);
          opacity: 0.5;
          animation-duration: 2s;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .ocr-progress-text {
          font-family: var(--font-serif);
          font-size: 18px;
          color: var(--ink);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .stage-dots {
          animation: dots 1.5s steps(4, end) infinite;
        }

        @keyframes dots {
          0%, 20% {
            content: '';
          }
          40% {
            content: '.';
          }
          60% {
            content: '..';
          }
          80%, 100% {
            content: '...';
          }
        }

        .ocr-progress-bar {
          width: 100%;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .ocr-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--secondary));
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .ocr-progress-percent {
          font-size: 14px;
          color: var(--muted);
          font-family: var(--font-serif);
        }
      `}</style>
    </div>
  );
}

// 根据阶段估算进度
function estimateProgress(stage: string): number {
  const progressMap: Record<string, number> = {
    auth: 5,
    quota: 10,
    cache: 15,
    analysis: 25,
    classical: 35,
    ocr: 50,
    enhance: 70,
    ai_review: 85,
    cache_save: 95,
    complete: 100,
  };
  return progressMap[stage] || 50;
}
