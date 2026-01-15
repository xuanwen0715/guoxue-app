'use client';

import { useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Eye, EyeOff, Settings } from 'lucide-react';

interface StrokeOrderControlsProps {
  onPlay?: () => void;
  onStop?: () => void;
  onReset?: () => void;
  onShowCharacter?: () => void;
  onHideCharacter?: () => void;
  onSpeedChange?: (speed: number) => void;
  onDelayChange?: (delay: number) => void;
  isAnimating?: boolean;
  isCharacterVisible?: boolean;
  speed?: number;
  delay?: number;
  className?: string;
}

export default function StrokeOrderControls({
  onPlay,
  onStop,
  onReset,
  onShowCharacter,
  onHideCharacter,
  onSpeedChange,
  onDelayChange,
  isAnimating = false,
  isCharacterVisible = false,
  speed = 1,
  delay = 300,
  className = '',
}: StrokeOrderControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handlePlayPause = useCallback(() => {
    if (isAnimating) {
      onStop?.();
    } else {
      onPlay?.();
    }
  }, [isAnimating, onPlay, onStop]);

  const handleShowHide = useCallback(() => {
    if (isCharacterVisible) {
      onHideCharacter?.();
    } else {
      onShowCharacter?.();
    }
  }, [isCharacterVisible, onShowCharacter, onHideCharacter]);

  const handleSpeedChange = useCallback((value: string) => {
    const newSpeed = parseFloat(value);
    onSpeedChange?.(newSpeed);
  }, [onSpeedChange]);

  const handleDelayChange = useCallback((value: string) => {
    const newDelay = parseInt(value);
    onDelayChange?.(newDelay);
  }, [onDelayChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Control Buttons */}
      <div className="flex items-center justify-center gap-2">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isAnimating}
          className={`
            flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200
            ${isAnimating
              ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
              : 'bg-vermilion border-vermilion text-white hover:bg-vermilion/90 shadow-lg hover:shadow-xl'
            }
          `}
          title={isAnimating ? '播放中...' : '播放动画'}
        >
          {isAnimating ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          title="重置动画"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Show/Hide Character */}
        <button
          onClick={handleShowHide}
          className={`
            flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200
            ${isCharacterVisible
              ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400'
            }
          `}
          title={isCharacterVisible ? '隐藏字符' : '显示字符'}
        >
          {isCharacterVisible ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`
            flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200
            ${showSettings
              ? 'bg-purple-500 border-purple-500 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400'
            }
          `}
          title="动画设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">动画设置</h4>

          <div className="space-y-4">
            {/* Animation Speed */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                动画速度: {speed}x
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => handleSpeedChange(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>慢 (0.1x)</span>
                <span>快 (3x)</span>
              </div>
            </div>

            {/* Delay Between Strokes */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                笔画间隔: {delay}ms
              </label>
              <input
                type="range"
                min="50"
                max="1000"
                step="50"
                value={delay}
                onChange={(e) => handleDelayChange(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>快 (50ms)</span>
                <span>慢 (1000ms)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              调节设置后点击重置以应用新的配置
            </p>
          </div>
        </div>
      )}

      {/* Animation Status */}
      {isAnimating && (
        <div className="text-center">
          <div className="inline-flex items-center text-sm text-vermilion">
            <div className="animate-pulse w-2 h-2 bg-vermilion rounded-full mr-2"></div>
            正在播放笔画动画...
          </div>
        </div>
      )}
    </div>
  );
}

// Add custom CSS for better slider styling
export const sliderStyles = `
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #dc2626;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider::-webkit-slider-thumb:hover {
  background: #b91c1c;
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #dc2626;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-thumb:hover {
  background: #b91c1c;
  transform: scale(1.1);
}
`;