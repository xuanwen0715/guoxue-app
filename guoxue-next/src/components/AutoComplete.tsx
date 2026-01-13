'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';

export interface Suggestion {
  text: string;
  type: 'char' | 'idiom' | 'word';
  pinyin?: string;
  explanation?: string;
}

interface AutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  type?: 'all' | 'char' | 'idiom' | 'word';
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  minChars?: number;
  maxSuggestions?: number;
  disabled?: boolean;
}

export default function AutoComplete({
  value,
  onChange,
  onSelect,
  type = 'all',
  placeholder = '',
  className = '',
  debounceMs = 300,
  minChars = 1,
  maxSuggestions = 10,
  disabled = false
}: AutoCompleteProps) {
  const t = useTranslations();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        type,
        limit: maxSuggestions.toString()
      });

      const response = await fetch(`/api/dictionary/suggestions?${params}`);
      const data = await response.json();

      if (response.ok && data.suggestions) {
        setSuggestions(data.suggestions);
        setShowSuggestions(data.suggestions.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('[AutoComplete] Failed to fetch suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, [type, maxSuggestions, minChars]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(value.trim());
      }, debounceMs);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, fetchSuggestions, debounceMs]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (onSelect) {
      onSelect(suggestion);
    }
    inputRef.current?.focus();
  };

  // Get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'char':
        return <span className="type-badge char-badge">字</span>;
      case 'idiom':
        return <span className="type-badge idiom-badge">成</span>;
      case 'word':
        return <span className="type-badge word-badge">词</span>;
      default:
        return null;
    }
  };

  return (
    <div className="autocomplete-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={`autocomplete-input ${className}`}
        disabled={disabled}
        autoComplete="off"
      />

      {isLoading && (
        <div className="autocomplete-loading">
          <span className="spinner-small"></span>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions-dropdown">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.text}-${index}`}
              className={`suggestion-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="suggestion-main">
                {getTypeBadge(suggestion.type)}
                <span className="suggestion-text">{suggestion.text}</span>
                {suggestion.pinyin && (
                  <span className="suggestion-pinyin">{suggestion.pinyin}</span>
                )}
              </div>
              {suggestion.explanation && (
                <div className="suggestion-explanation">
                  {suggestion.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .autocomplete-wrapper {
          position: relative;
          width: 100%;
        }

        .autocomplete-input {
          width: 100%;
          padding-right: 40px;
        }

        .autocomplete-loading {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .spinner-small {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(122, 104, 166, 0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .suggestions-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(122, 104, 166, 0.15);
          z-index: 1000;
          padding: 4px;
        }

        .suggestion-item {
          padding: 10px 12px;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background: linear-gradient(135deg,
            rgba(122, 104, 166, 0.08) 0%,
            rgba(90, 128, 176, 0.05) 100%
          );
        }

        .suggestion-main {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .char-badge {
          background: linear-gradient(135deg, #7a68a6, #9a88c0);
          color: white;
        }

        .idiom-badge {
          background: linear-gradient(135deg, #5a80b0, #7aa0d0);
          color: white;
        }

        .word-badge {
          background: linear-gradient(135deg, #8a9a5b, #aaba7b);
          color: white;
        }

        .suggestion-text {
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 600;
          color: var(--ink);
        }

        .suggestion-pinyin {
          font-size: 13px;
          color: var(--muted);
          flex: 1;
        }

        .suggestion-explanation {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.5;
          padding-left: 28px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Scrollbar styling */
        .suggestions-dropdown::-webkit-scrollbar {
          width: 6px;
        }

        .suggestions-dropdown::-webkit-scrollbar-track {
          background: transparent;
        }

        .suggestions-dropdown::-webkit-scrollbar-thumb {
          background: rgba(122, 104, 166, 0.3);
          border-radius: 3px;
        }

        .suggestions-dropdown::-webkit-scrollbar-thumb:hover {
          background: rgba(122, 104, 166, 0.5);
        }

        @media (max-width: 640px) {
          .suggestions-dropdown {
            max-height: 250px;
          }

          .suggestion-item {
            padding: 8px 10px;
          }

          .suggestion-text {
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
