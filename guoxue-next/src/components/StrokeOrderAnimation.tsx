'use client';

import { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import HanziWriter to avoid SSR issues
let HanziWriter: any = null;
if (typeof window !== 'undefined') {
  import('hanzi-writer').then(module => {
    HanziWriter = module.default;
  });
}

interface StrokeOrderAnimationProps {
  character: string;
  size?: number;
  strokeColor?: string;
  highlightColor?: string;
  delayBetweenStrokes?: number;
  strokeAnimationSpeed?: number;
  className?: string;
  onAnimationComplete?: () => void;
  onAnimationStart?: () => void;
}

export default forwardRef<SVGSVGElement, StrokeOrderAnimationProps>(function StrokeOrderAnimation({
  character,
  size = 200,
  strokeColor = '#555',
  highlightColor = '#dd6b20',
  delayBetweenStrokes = 300,
  strokeAnimationSpeed = 1,
  className = '',
  onAnimationComplete,
  onAnimationStart,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const writerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Merge refs (internal and forwarded)
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(svgRef.current);
      } else {
        ref.current = svgRef.current;
      }
    }
  }, [ref]);

  // Initialize HanziWriter
  const initializeWriter = useCallback(async () => {
    if (!svgRef.current || !character || !HanziWriter) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear previous writer
      if (writerRef.current) {
        try {
          writerRef.current.cancelCurrentAnimation();
        } catch (e) {
          // Ignore cleanup errors
        }
        writerRef.current = null;
      }

      // Clear SVG content
      svgRef.current.innerHTML = '';

      // Create new HanziWriter instance
      const writer = HanziWriter.create(svgRef.current as unknown as HTMLElement, character, {
        width: size,
        height: size,
        padding: 20,
        strokeColor: strokeColor,
        strokeAnimationSpeed: strokeAnimationSpeed,
        delayBetweenStrokes: delayBetweenStrokes,
        strokeHighlightSpeed: 2,
        highlightColor: highlightColor,
        drawingColor: '#3b82f6',
        showOutline: true,
        showCharacter: false,
      });

      writerRef.current = writer;

      // Just set loading to false after writer is created
      // Don't await any animation methods
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load character:', character, err);
      setError(`无法加载字符 "${character}" 的笔画数据`);
      setIsLoading(false);
    }
  }, [character, size, strokeColor, highlightColor, delayBetweenStrokes, strokeAnimationSpeed]);

  // Wait for HanziWriter to load and then initialize
  useEffect(() => {
    const checkHanziWriter = () => {
      if (HanziWriter) {
        initializeWriter();
      } else {
        // Retry after a short delay
        setTimeout(checkHanziWriter, 100);
      }
    };

    if (typeof window !== 'undefined') {
      checkHanziWriter();
    }
  }, [initializeWriter]);

  // Animation control methods
  const playAnimation = useCallback(async () => {
    if (!writerRef.current || isAnimating) return;

    try {
      setIsAnimating(true);
      onAnimationStart?.();

      await writerRef.current.animateCharacter();

      setIsAnimating(false);
      onAnimationComplete?.();
    } catch (err) {
      console.error('Animation error:', err);
      setIsAnimating(false);
    }
  }, [isAnimating, onAnimationStart, onAnimationComplete]);

  const stopAnimation = useCallback(() => {
    if (writerRef.current) {
      writerRef.current.cancelCurrentAnimation();
      setIsAnimating(false);
    }
  }, []);

  const resetAnimation = useCallback(() => {
    if (writerRef.current) {
      stopAnimation();
      writerRef.current.hideCharacter();
    }
  }, [stopAnimation]);

  const showCharacter = useCallback(() => {
    if (writerRef.current) {
      writerRef.current.showCharacter();
    }
  }, []);

  const hideCharacter = useCallback(() => {
    if (writerRef.current) {
      writerRef.current.hideCharacter();
    }
  }, []);

  // Initialize writer when character changes
  useEffect(() => {
    initializeWriter();
  }, [initializeWriter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (writerRef.current) {
        writerRef.current.cancelCurrentAnimation();
      }
    };
  }, []);

  // Expose control methods via ref
  useEffect(() => {
    if (svgRef.current) {
      (svgRef.current as any).playAnimation = playAnimation;
      (svgRef.current as any).stopAnimation = stopAnimation;
      (svgRef.current as any).resetAnimation = resetAnimation;
      (svgRef.current as any).showCharacter = showCharacter;
      (svgRef.current as any).hideCharacter = hideCharacter;
    }
  }, [playAnimation, stopAnimation, resetAnimation, showCharacter, hideCharacter]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="text-center text-gray-500 text-sm px-4">
          <div className="mb-2">⚠️</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg"
          style={{ width: size, height: size }}
        >
          <div className="text-gray-500 text-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-vermilion mb-2 mx-auto"></div>
            <div>加载中...</div>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        width={size}
        height={size}
        className={`border rounded-lg shadow-sm ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={{
          background: 'linear-gradient(135deg, #fefefe 0%, #f8f9fa 100%)',
          minWidth: size,
          minHeight: size,
        }}
      />

      {isAnimating && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          播放中
        </div>
      )}
    </div>
  );
});

// Export control methods for external use
export type StrokeOrderAnimationRef = {
  playAnimation: () => Promise<void>;
  stopAnimation: () => void;
  resetAnimation: () => void;
  showCharacter: () => void;
  hideCharacter: () => void;
};