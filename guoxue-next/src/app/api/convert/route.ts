import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - opencc-js has no type declarations
import * as OpenCC from 'opencc-js';

export const runtime = 'nodejs';

const MAX_TEXT_LENGTH = 20000;

let s2tConverter: ((text: string) => string) | null = null;
let t2sConverter: ((text: string) => string) | null = null;

function getConverter(direction: string) {
  try {
    if (direction === 's2t') {
      if (!s2tConverter) {
        s2tConverter = OpenCC.Converter({ from: 'cn', to: 't' });
      }
      return s2tConverter;
    }
    if (direction === 't2s') {
      if (!t2sConverter) {
        t2sConverter = OpenCC.Converter({ from: 't', to: 'cn' });
      }
      return t2sConverter;
    }
  } catch (error) {
    console.error('[Convert API] Failed to init converter:', error);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    const direction = typeof body?.direction === 'string' ? body.direction : 's2t';

    if (!text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Text too long' }, { status: 413 });
    }

    const converter = getConverter(direction);
    if (!converter) {
      if (direction !== 's2t' && direction !== 't2s') {
        return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Converter unavailable' }, { status: 500 });
    }

    const result = converter(text);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[Convert API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
