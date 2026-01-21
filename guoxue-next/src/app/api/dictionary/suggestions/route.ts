import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

interface Suggestion {
  text: string;
  type: 'char' | 'idiom' | 'word';
  pinyin?: string;
  explanation?: string;
}

const PINYIN_TONE_REGEX = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
const PINYIN_ALLOWED_REGEX = /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/i;
const PINYIN_TONE_MAP: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü']
};

function getPinyinVariants(pinyin: string): string[] {
  const normalized = pinyin.toLowerCase().replace(/v/g, 'ü').trim();
  if (!normalized) {
    return [];
  }

  if (PINYIN_TONE_REGEX.test(normalized)) {
    return [normalized];
  }

  if (!PINYIN_ALLOWED_REGEX.test(normalized)) {
    return [normalized];
  }

  let mainVowelIndex = -1;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === 'a' || ch === 'e') {
      mainVowelIndex = i;
      break;
    }
    if (ch === 'o' && i + 1 < normalized.length && normalized[i + 1] === 'u') {
      mainVowelIndex = i;
      break;
    }
  }

  if (mainVowelIndex === -1) {
    for (let i = normalized.length - 1; i >= 0; i -= 1) {
      if ('iouü'.includes(normalized[i])) {
        mainVowelIndex = i;
        break;
      }
    }
  }

  if (mainVowelIndex === -1) {
    return [normalized];
  }

  const mainVowel = normalized[mainVowelIndex];
  const tones = PINYIN_TONE_MAP[mainVowel];
  if (!tones) {
    return [normalized];
  }

  const variants = tones.map(
    (tone) =>
      normalized.slice(0, mainVowelIndex) + tone + normalized.slice(mainVowelIndex + 1)
  );

  return Array.from(new Set(variants));
}

// GET /api/dictionary/suggestions - Get search suggestions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q') || '';
    const query = rawQuery.trim();
    const type = searchParams.get('type') || 'all'; // all | char | idiom | word
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = getSupabaseClient();
    const suggestions: Suggestion[] = [];
    const normalizedQuery = query.toLowerCase();

    // Search characters (by char, traditional, or pinyin)
    if (type === 'all' || type === 'char') {
      const charLimit = type === 'char' ? limit : Math.ceil(limit / 3);

      // Try exact match first
      const { data: exactChars } = await supabase
        .from('dictionary')
        .select('char, traditional, pinyin, explanation')
        .or(`char.eq.${query},traditional.eq.${query}`)
        .limit(5);

      if (exactChars && exactChars.length > 0) {
        suggestions.push(
          ...exactChars.map((c: any) => ({
            text: c.traditional && c.traditional === query ? c.traditional : c.char,
            type: 'char' as const,
            pinyin: c.pinyin,
            explanation: c.explanation?.substring(0, 50)
          }))
        );
      }

      // Then try pinyin match
      if (suggestions.length < charLimit) {
        const pinyinQuery = normalizedQuery.replace(/v/g, 'ü');
        const pinyinVariants = getPinyinVariants(pinyinQuery);
        const pinyinLimit = charLimit - suggestions.length;
        let pinyinChars: any[] | null = null;

        if (PINYIN_ALLOWED_REGEX.test(pinyinQuery)) {
          if (pinyinVariants.length > 1) {
            const orConditions = pinyinVariants
              .map((variant) => `pinyin.ilike.${variant}%`)
              .join(',');
            const { data } = await supabase
              .from('dictionary')
              .select('char, traditional, pinyin, explanation')
              .or(orConditions)
              .limit(pinyinLimit);
            pinyinChars = data;
          } else {
            const { data } = await supabase
              .from('dictionary')
              .select('char, traditional, pinyin, explanation')
              .ilike('pinyin', `${pinyinQuery}%`)
              .limit(pinyinLimit);
            pinyinChars = data;
          }
        }

        if (pinyinChars && pinyinChars.length > 0) {
          suggestions.push(
            ...pinyinChars.map((c: any) => ({
              text: c.char,
              type: 'char' as const,
              pinyin: c.pinyin,
              explanation: c.explanation?.substring(0, 50)
            }))
          );
        }
      }
    }

    // Search idioms (by word, pinyin, or abbreviation)
    if (type === 'all' || type === 'idiom') {
      const idiomLimit = type === 'idiom' ? limit : Math.ceil(limit / 3);

      // Try word match (prefix)
      const { data: idiomsByWord } = await supabase
        .from('idioms')
        .select('word, pinyin, explanation')
        .ilike('word', `${query}%`)
        .limit(idiomLimit);

      if (idiomsByWord && idiomsByWord.length > 0) {
        suggestions.push(
          ...idiomsByWord.map((i: any) => ({
            text: i.word,
            type: 'idiom' as const,
            pinyin: i.pinyin,
            explanation: i.explanation?.substring(0, 50)
          }))
        );
      }

      // Try pinyin abbreviation match (e.g., "yms" for "一鸣惊人")
      if (suggestions.length < idiomLimit + (type === 'all' ? Math.ceil(limit / 3) : 0)) {
        const { data: idiomsByAbbrev } = await supabase
          .from('idioms')
          .select('word, pinyin, abbreviation, explanation')
          .ilike('abbreviation', `${query}%`)
          .limit(5);

        if (idiomsByAbbrev && idiomsByAbbrev.length > 0) {
          suggestions.push(
            ...idiomsByAbbrev
              .filter((i: any) => !suggestions.some(s => s.text === i.word))
              .map((i: any) => ({
                text: i.word,
                type: 'idiom' as const,
                pinyin: i.pinyin,
                explanation: i.explanation?.substring(0, 50)
              }))
          );
        }
      }
    }

    // Search words
    if (type === 'all' || type === 'word') {
      const wordLimit = type === 'word' ? limit : Math.ceil(limit / 3);
      const currentCount = suggestions.length;

      if (currentCount < limit) {
        const { data: words } = await supabase
          .from('words')
          .select('word, explanation')
          .ilike('word', `${query}%`)
          .limit(Math.min(wordLimit, limit - currentCount));

        if (words && words.length > 0) {
          suggestions.push(
            ...words.map((w: any) => ({
              text: w.word,
              type: 'word' as const,
              explanation: w.explanation?.substring(0, 50)
            }))
          );
        }
      }
    }

    // Remove duplicates and limit
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map(s => [s.text, s])).values()
    ).slice(0, limit);

    return NextResponse.json({ suggestions: uniqueSuggestions });
  } catch (err) {
    console.error('[Dictionary Suggestions API] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', suggestions: [] },
      { status: 500 }
    );
  }
}
