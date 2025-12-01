'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Header from '@/components/Header';
import ContextInput from '@/components/ContextInput';
import WordInput from '@/components/WordInput';
import ActionButtons from '@/components/ActionButtons';
import ResultBox from '@/components/ResultBox';
import History from '@/components/History';
import Feedback from '@/components/Feedback';
import Footer from '@/components/Footer';

export default function HomePage() {
  const t = useTranslations();

  return (
    <>
      {/* 古典纸纹背景层 */}
      <div className="paper-texture" aria-hidden="true" />

      {/* Phoenix decor - 绚丽凤凰装饰 */}
      <div className="phoenix-decor" aria-hidden="true">
        <Image
          className="phoenix phoenix-left"
          src="/assets/phoenix-colorful.png"
          alt=""
          width={350}
          height={350}
        />
        <Image
          className="phoenix phoenix-right"
          src="/assets/phoenix-colorful.png"
          alt=""
          width={320}
          height={320}
        />
      </div>

      <div className="container">
        <Header />

        <main>
          <ContextInput />

          <div className="inline-fields">
            <WordInput />
          </div>

          {/* 古典分隔装饰 */}
          <div className="section-divider" aria-hidden="true">
            <span className="divider-wing left"></span>
            <span className="divider-center">❖</span>
            <span className="divider-wing right"></span>
          </div>

          <ActionButtons />
          <ResultBox />
        </main>
      </div>

      {/* 古典分隔线 */}
      <div className="history-divider" aria-hidden="true">
        <span className="divider-ornament">◆</span>
      </div>

      <History />
      <Feedback />
      <Footer />
    </>
  );
}
