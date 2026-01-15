'use client';

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';

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

export interface StrokeOrderAnimationRef {
  playAnimation: () => void;
  stopAnimation: () => void;
  resetAnimation: () => void;
  showCharacter: () => void;
  hideCharacter: () => void;
}

const StrokeOrderAnimation = forwardRef<StrokeOrderAnimationRef, StrokeOrderAnimationProps>(
  function StrokeOrderAnimation(
    {
      character,
      size = 200,
      strokeColor = '#555',
      highlightColor = '#dd6b20',
      delayBetweenStrokes = 300,
      strokeAnimationSpeed = 1,
      className = '',
      onAnimationComplete,
      onAnimationStart,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const writerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [HanziWriter, setHanziWriter] = useState<any>(null);

    // Load HanziWriter dynamically
    useEffect(() => {
      let mounted = true;

      const loadHanziWriter = async () => {
        try {
          const module = await import('hanzi-writer');
          if (mounted) {
            setHanziWriter(() => module.default);
          }
        } catch (err) {
          console.error('Failed to load HanziWriter:', err);
          if (mounted) {
            setError('无法加载笔画动画库');
            setIsLoading(false);
          }
        }
      };

      loadHanziWriter();

      return () => {
        mounted = false;
      };
    }, []);

    // Initialize writer when HanziWriter is loaded and character changes
    useEffect(() => {
      if (!HanziWriter || !containerRef.current || !character) return;

      let mounted = true;

      const initWriter = async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Cleanup previous writer
          if (writerRef.current) {
            try {
              writerRef.current.cancelCurrentAnimation();
            } catch (e) {
              // Ignore
            }
            writerRef.current = null;
          }

          // Clear container
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }

          // Create writer with a target div instead of SVG
          const writer = HanziWriter.create(containerRef.current, character, {
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
            charDataLoader: (char: string, onComplete: (data: any) => void) => {
              fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`)
                .then(res => {
                  if (!res.ok) throw new Error('Character not found');
                  return res.json();
                })
                .then(data => onComplete(data))
                .catch(err => {
                  console.error('Failed to load character data:', err);
                  if (mounted) {
                    setError(`无法加载字符 "${char}" 的笔画数据`);
                    setIsLoading(false);
                  }
                });
            },
            onLoadCharDataSuccess: () => {
              if (mounted) {
                setIsLoading(false);
              }
            },
            onLoadCharDataError: () => {
              if (mounted) {
                setError(`无法加载字符 "${character}" 的笔画数据`);
                setIsLoading(false);
              }
            },
          });

          writerRef.current = writer;
        } catch (err) {
          console.error('Failed to initialize writer:', err);
          if (mounted) {
            setError(`初始化失败`);
            setIsLoading(false);
          }
        }
      };

      initWriter();

      return () => {
        mounted = false;
        if (writerRef.current) {
          try {
            writerRef.current.cancelCurrentAnimation();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      };
    }, [HanziWriter, character, size, strokeColor, highlightColor, delayBetweenStrokes, strokeAnimationSpeed]);

    // Control methods
    const playAnimation = useCallback(() => {
      if (!writerRef.current || isAnimating) return;

      setIsAnimating(true);
      onAnimationStart?.();

      writerRef.current.animateCharacter({
        onComplete: () => {
          setIsAnimating(false);
          onAnimationComplete?.();
        },
      });
    }, [isAnimating, onAnimationStart, onAnimationComplete]);

    const stopAnimation = useCallback(() => {
      if (writerRef.current) {
        try {
          writerRef.current.cancelCurrentAnimation();
        } catch (e) {
          // Ignore
        }
        setIsAnimating(false);
      }
    }, []);

    const resetAnimation = useCallback(() => {
      stopAnimation();
      if (writerRef.current) {
        try {
          writerRef.current.hideCharacter();
        } catch (e) {
          // Ignore
        }
      }
    }, [stopAnimation]);

    const showCharacter = useCallback(() => {
      if (writerRef.current) {
        try {
          writerRef.current.showCharacter();
        } catch (e) {
          // Ignore
        }
      }
    }, []);

    const hideCharacter = useCallback(() => {
      if (writerRef.current) {
        try {
          writerRef.current.hideCharacter();
        } catch (e) {
          // Ignore
        }
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        playAnimation,
        stopAnimation,
        resetAnimation,
        showCharacter,
        hideCharacter,
      }),
      [playAnimation, stopAnimation, resetAnimation, showCharacter, hideCharacter]
    );

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
            className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10"
            style={{ width: size, height: size }}
          >
            <div className="text-gray-500 text-sm text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mb-2 mx-auto"></div>
              <div>加载中...</div>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className={`border rounded-lg shadow-sm ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          style={{
            width: size,
            height: size,
            background: 'linear-gradient(135deg, #fefefe 0%, #f8f9fa 100%)',
          }}
        />

        {isAnimating && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            播放中
          </div>
        )}
      </div>
    );
  }
);

export default StrokeOrderAnimation;
