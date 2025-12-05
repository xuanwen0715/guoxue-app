This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Dictionary Health Check (cURL)

After deploying, use these quick checks to verify the dictionary API (replace the domain as needed, e.g. `http://localhost:3000`):

```bash
# 1) Char lookup (Traditional) – should return the same entry as Simplified
curl -sS 'https://dict.gsw277.today/api/dictionary?q=國&type=char&by=text'

# 2) Char lookup (Simplified)
curl -sS 'https://dict.gsw277.today/api/dictionary?q=国&type=char&by=text'

# 3) Batch lookup for the homepage quick card (includes OpenCC variants)
curl -sS -X POST 'https://dict.gsw277.today/api/dictionary' \
  -H 'Content-Type: application/json' \
  -d '{"action":"batch_lookup","chars":["國","複","臺"]}'

# Optional pretty print if jq is available
curl -sS 'https://dict.gsw277.today/api/dictionary?q=國&type=char&by=text' | jq .
curl -sS -X POST 'https://dict.gsw277.today/api/dictionary' -H 'Content-Type: application/json' \
  -d '{"action":"batch_lookup","chars":["國","複","臺"]}' | jq '.results'
```

Notes:
- Char-level lookup now matches both Simplified (`char`) and Traditional (`traditional`) and includes OpenCC-generated variants.
- Ensure the following env vars are configured on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

## Dictionary Overview

- Char-level S/T matching: input Simplified or Traditional and get the same entry.
- Multi-search: by Text, by Pinyin (tones optional), by Radical, by Strokes.
- Radical aliases: supports common side-form/simplified shapes in the picker.
- Quick Card on homepage: shows per-character info for up to 5 chars.

## Radical Alias List (UI)

The radical picker accepts these common aliases and maps them to their Kangxi canonical radicals when searching:

- 讠 = 言, 氵 = 水, 扌 = 手, 忄 = 心, 礻 = 示
- 纟 = 糸, 钅 = 金, 饣 = 食, 犭 = 犬, 刂 = 刀
- 门 = 門, 车 = 車, 马 = 馬, 鸟 = 鳥, 鱼 = 魚
- 页 = 頁, 风 = 風, 艹 = 艸, 亻 = 人, 阝 ≈ 阜（右侧多作 邑 U+9091）
- 灬 = 火, 牜 = 牛, 衤 = 衣, 爫 = 爪, 辶 = 辵
- 釒 = 金, 糹 = 糸, 飠 = 食, 氺 = 水, 攵 = 攴

Note: The canonical set follows Kangxi radicals; aliases are UI conveniences only.
