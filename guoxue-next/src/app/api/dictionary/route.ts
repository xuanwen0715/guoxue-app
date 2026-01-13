import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client (public access for dictionary data)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Radical alias mapping (simplified -> canonical)
const RADICAL_ALIAS_MAP: Record<string, string> = {
  '\u8ba0': '\u8a00', // 讠 -> 言
  '\u6c35': '\u6c34', // 氵 -> 水
  '\u624c': '\u624b', // 扌 -> 手
  '\u5fc4': '\u5fc3', // 忄 -> 心
  '\u793b': '\u793a', // 礻 -> 示
  '\u7e9f': '\u7cf8', // 纟 -> 糸
  '\u9485': '\u91d1', // 钅 -> 金
  '\u9963': '\u98df', // 饣 -> 食
  '\u72ad': '\u72ac', // 犭 -> 犬
  '\u5202': '\u5200', // 刂 -> 刀
  '\u95e8': '\u9580', // 门 -> 門
  '\u8f66': '\u8eca', // 车 -> 車
  '\u9a6c': '\u99ac', // 马 -> 馬
  '\u9e1f': '\u9ce5', // 鸟 -> 鳥
  '\u9c7c': '\u9b5a', // 鱼 -> 魚
  '\u9875': '\u9801', // 页 -> 頁
  '\u98ce': '\u98a8', // 风 -> 風
  '\u8279': '\u8278', // 艹 -> 艸
  '\u4eb7': '\u4eba', // 亻 -> 人
  '\u961d': '\u961c', // 阝 -> 阜
  '\u706c': '\u706b', // 灬 -> 火
  '\u725c': '\u725b', // 牜 -> 牛
  '\u8864': '\u8863', // 衤 -> 衣
  '\u722b': '\u722a', // 爫 -> 爪
  '\u8fb6': '\u8fb5', // 辶 -> 辵
  '\u91d2': '\u91d1', // 釒 -> 金
  '\u7cf9': '\u7cf8', // 糹 -> 糸
  '\u98e0': '\u98df', // 飠 -> 食
  '\u6c3a': '\u6c34', // 氺 -> 水
  '\u6535': '\u6534'  // 攵 -> 攴
};

// Generate OpenCC variants for a character
function generateVariants(char: string): string[] {
  // This is a simplified version - in production, use full OpenCC library
  const variants = [char];
  // Add the character itself to always include it
  return variants;
}

// GET /api/dictionary - Search dictionary
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'char'; // char | idiom | word
    const by = searchParams.get('by') || 'text'; // text | pinyin | radical | strokes
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = getSupabaseClient();

    // Character search
    if (type === 'char') {
      let qb = supabase
        .from('dictionary')
        .select('char, traditional, pinyin, radical, total_strokes, explanation');

      if (by === 'text') {
        // Match by char or traditional
        const variants = generateVariants(query);
        qb = qb.or(`char.in.(${variants.join(',')}),traditional.in.(${variants.join(',')})`);
      } else if (by === 'pinyin') {
        // Support pinyin search (with or without tones)
        qb = qb.ilike('pinyin', `%${query}%`);
      } else if (by === 'radical') {
        // Map aliases to canonical radicals
        const canonical = RADICAL_ALIAS_MAP[query] || query;
        qb = qb.eq('radical', canonical);
      } else if (by === 'strokes') {
        const strokes = parseInt(query);
        if (!isNaN(strokes)) {
          qb = qb.eq('total_strokes', strokes);
        }
      }

      const { data: chars, error } = await qb.limit(limit);

      if (error) {
        console.error('[Dictionary API] Char search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ chars: chars || [] });
    }

    // Idiom search
    if (type === 'idiom') {
      let qb = supabase
        .from('idioms')
        .select('word, pinyin, explanation, derivation, example');

      if (by === 'text') {
        qb = qb.ilike('word', `%${query}%`);
      } else if (by === 'pinyin') {
        qb = qb.ilike('pinyin', `%${query}%`);
      }

      const { data: idioms, error } = await qb.limit(limit);

      if (error) {
        console.error('[Dictionary API] Idiom search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ idioms: idioms || [] });
    }

    // Word search
    if (type === 'word') {
      let qb = supabase
        .from('words')
        .select('word, explanation');

      qb = qb.ilike('word', `%${query}%`);

      const { data: words, error } = await qb.limit(limit);

      if (error) {
        console.error('[Dictionary API] Word search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ words: words || [] });
    }

    return NextResponse.json({ error: 'Invalid search type' }, { status: 400 });
  } catch (err) {
    console.error('[Dictionary API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/dictionary - Batch lookup or special actions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, chars } = body;

    if (action === 'batch_lookup') {
      if (!Array.isArray(chars) || chars.length === 0) {
        return NextResponse.json({ error: 'Invalid chars array' }, { status: 400 });
      }

      const supabase = getSupabaseClient();

      // Generate all variants for all input chars
      const allVariants = chars.flatMap(c => generateVariants(c));
      const uniqueVariants = Array.from(new Set(allVariants));

      const { data, error } = await supabase
        .from('dictionary')
        .select('char, traditional, pinyin, radical, total_strokes, explanation')
        .in('char', uniqueVariants);

      if (error) {
        console.error('[Dictionary API] Batch lookup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Build a map for quick lookup
      const charMap = new Map();
      (data || []).forEach((entry: any) => {
        charMap.set(entry.char, entry);
        if (entry.traditional) {
          charMap.set(entry.traditional, entry);
        }
      });

      // Return results in the same order as input
      const results = chars.map(c => {
        // Try direct lookup first
        if (charMap.has(c)) {
          return charMap.get(c);
        }
        // Try variants
        const variants = generateVariants(c);
        for (const v of variants) {
          if (charMap.has(v)) {
            return charMap.get(v);
          }
        }
        // No match found
        return {
          char: c,
          traditional: null,
          pinyin: null,
          radical: null,
          total_strokes: 0,
          explanation: null
        };
      });

      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Dictionary API] POST error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
