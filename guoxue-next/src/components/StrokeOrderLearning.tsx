'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import StrokeOrderAnimation, { type StrokeOrderAnimationRef } from './StrokeOrderAnimation';
import StrokeOrderControls, { sliderStyles } from './StrokeOrderControls';
import { BookOpen, X } from 'lucide-react';

interface StrokeOrderLearningProps {
  character: string;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export default function StrokeOrderLearning({
  character,
  isOpen = false,
  onClose,
  className = '',
}: StrokeOrderLearningProps) {
  const animationRef = useRef<SVGSVGElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCharacterVisible, setIsCharacterVisible] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [strokeDelay, setStrokeDelay] = useState(300);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation control methods
  const playAnimation = useCallback(async () => {
    if (animationRef.current && (animationRef.current as any).playAnimation) {
      setIsAnimating(true);
      try {
        await (animationRef.current as any).playAnimation();
        setIsAnimating(false);
      } catch (error) {
        console.error('Animation failed:', error);
        setIsAnimating(false);
      }
    }
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationRef.current && (animationRef.current as any).stopAnimation) {
      (animationRef.current as any).stopAnimation();
      setIsAnimating(false);
    }
  }, []);

  const resetAnimation = useCallback(() => {
    if (animationRef.current && (animationRef.current as any).resetAnimation) {
      (animationRef.current as any).resetAnimation();
      setIsCharacterVisible(false);
      setIsAnimating(false);
    }
  }, []);

  const showCharacter = useCallback(() => {
    if (animationRef.current && (animationRef.current as any).showCharacter) {
      (animationRef.current as any).showCharacter();
      setIsCharacterVisible(true);
    }
  }, []);

  const hideCharacter = useCallback(() => {
    if (animationRef.current && (animationRef.current as any).hideCharacter) {
      (animationRef.current as any).hideCharacter();
      setIsCharacterVisible(false);
    }
  }, []);

  // Handle speed and delay changes
  const handleSpeedChange = useCallback((speed: number) => {
    setAnimationSpeed(speed);
    // Force re-render of animation component with new settings
    setAnimationKey(prev => prev + 1);
  }, []);

  const handleDelayChange = useCallback((delay: number) => {
    setStrokeDelay(delay);
    // Force re-render of animation component with new settings
    setAnimationKey(prev => prev + 1);
  }, []);

  // Handle animation events
  const handleAnimationStart = useCallback(() => {
    setIsAnimating(true);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
    setIsCharacterVisible(true);
  }, []);

  // Reset state when character changes
  useEffect(() => {
    setIsAnimating(false);
    setIsCharacterVisible(false);
    setAnimationKey(prev => prev + 1);
  }, [character]);

  if (!isOpen) return null;

  return (
    <>
      {/* Custom CSS for sliders */}
      <style jsx global>{sliderStyles}</style>

      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Content */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-vermilion/10 rounded-lg">
                <BookOpen className="w-5 h-5 text-vermilion" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">笔画顺序学习</h2>
                <p className="text-sm text-gray-500">学习 "{character}" 的正确书写方式</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Character Display */}
            <div className="flex justify-center mb-6">
              <StrokeOrderAnimation
                key={animationKey}
                ref={animationRef}
                character={character}
                size={280}
                strokeColor="#4b5563"
                highlightColor="#dc2626"
                delayBetweenStrokes={strokeDelay}
                strokeAnimationSpeed={animationSpeed}
                onAnimationStart={handleAnimationStart}
                onAnimationComplete={handleAnimationComplete}
                className="border-2 border-gray-200"
              />
            </div>

            {/* Controls */}
            <StrokeOrderControls
              onPlay={playAnimation}
              onStop={stopAnimation}
              onReset={resetAnimation}
              onShowCharacter={showCharacter}
              onHideCharacter={hideCharacter}
              onSpeedChange={handleSpeedChange}
              onDelayChange={handleDelayChange}
              isAnimating={isAnimating}
              isCharacterVisible={isCharacterVisible}
              speed={animationSpeed}
              delay={strokeDelay}
            />

            {/* Learning Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">学习建议</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 观察每一笔的起点和方向</li>
                <li>• 注意笔画之间的先后顺序</li>
                <li>• 可以调节动画速度和间隔时间</li>
                <li>• 多次练习直到熟练掌握</li>
              </ul>
            </div>

            {/* Character Info */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">字符信息</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <div>字符: <span className="font-mono text-lg">{character}</span></div>
                <div>Unicode: <span className="font-mono">U+{character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}</span></div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={playAnimation}
                disabled={isAnimating}
                className="flex-1 bg-vermilion text-white py-2 px-4 rounded-lg hover:bg-vermilion/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isAnimating ? '播放中...' : '重新播放'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}