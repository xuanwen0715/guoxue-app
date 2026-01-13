/**
 * 从 chl.cn 爬取汉字释义数据，补充到本地数据库
 *
 * 用法: node scripts/scrape-chl.js [选项]
 *
 * 选项:
 *   --test          测试模式，只爬取几个字
 *   --missing       只爬取数据库中缺少释义的字
 *   --start=N       从第N个字开始
 *   --limit=N       最多爬取N个字
 *   --update-db     直接更新数据库（默认只输出JSON）
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: 缺少 Supabase 配置，请检查 .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 解析命令行参数
const args = process.argv.slice(2);
const isTest = args.includes('--test');
const onlyMissing = args.includes('--missing');
const updateDb = args.includes('--update-db');
const startArg = args.find(a => a.startsWith('--start='));
const limitArg = args.find(a => a.startsWith('--limit='));
const startIndex = startArg ? parseInt(startArg.split('=')[1]) : 0;
const maxLimit = limitArg ? parseInt(limitArg.split('=')[1]) : (isTest ? 5 : 1000);

// 延迟函数（避免请求过快）
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 从 chl.cn 获取汉字信息
async function fetchCharFromChl(char) {
  // chl.cn 使用内部 ID 系统，需要通过搜索表单提交查询
  // 表单 action 是 /zidian/，字段名是 str
  const url = 'https://chl.cn/zidian/';

  try {
    // 使用 POST 表单提交方式搜索
    const response = await axios.post(url, `str=${encodeURIComponent(char)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://chl.cn/zidian/',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;

    // 检查是否找到该字
    if (html.includes('404') || html.includes('找不到文件') || !html.includes('基本字义')) {
      console.log(`未找到`);
      return null;
    }

    // 解析 HTML 提取信息
    const result = parseCharHtml(html, char);
    return result;

  } catch (err) {
    if (err.response) {
      console.log(`HTTP ${err.response.status}`);
    } else {
      console.log(`请求失败: ${err.message}`);
    }
    return null;
  }
}

// 解析 HTML 提取汉字信息
function parseCharHtml(html, char) {
  const result = {
    char: char,
    pinyin: null,
    strokes: null,
    radical: null,
    explanation: null,
  };

  try {
    // 提取拼音 - 格式: "桍拼音：<a>kū</a>"
    const pinyinMatch = html.match(/拼音：<a[^>]*>([^<]+)<\/a>/);
    if (pinyinMatch) {
      result.pinyin = pinyinMatch[1].trim();
    }

    // 提取笔画 - 格式: "笔画数：10画"
    const strokesMatch = html.match(/笔画数：(\d+)画/);
    if (strokesMatch) {
      result.strokes = parseInt(strokesMatch[1]);
    }

    // 提取部首 - 格式: "部首：<a>木</a>"
    const radicalMatch = html.match(/部首：<a[^>]*>([^<]+)<\/a>/);
    if (radicalMatch) {
      result.radical = radicalMatch[1].trim();
    }

    // 提取释义 - 在 "■ 基本字义" 之后的内容
    // 格式通常是多个 <p>• 释义内容</p>
    const meaningSection = html.match(/基本字义[\s\S]*?(<p[^>]*>•[\s\S]*?)(?:<hr|<div class="ad"|$)/i);
    if (meaningSection) {
      // 提取所有以 • 开头的释义
      const meanings = [];
      const meaningMatches = meaningSection[1].matchAll(/<p[^>]*>•\s*([^<]+)<\/p>/g);
      for (const match of meaningMatches) {
        const meaning = match[1].trim();
        if (meaning && meaning !== char) {
          meanings.push(meaning);
        }
      }
      if (meanings.length > 0) {
        result.explanation = meanings.map((m, i) => `${i + 1}. ${m}`).join(' ');
      }
    }

    // 如果没有找到结构化释义，尝试其他方式
    if (!result.explanation) {
      // 查找任何带 • 的内容
      const bulletMatches = html.matchAll(/<p[^>]*>•\s*([^<]{5,})<\/p>/g);
      const bullets = [];
      for (const match of bulletMatches) {
        const text = match[1].trim();
        if (text && !text.match(/^[a-z]+\s*ㄅㄆㄇ/) && text !== char) {
          bullets.push(text);
        }
      }
      if (bullets.length > 0) {
        result.explanation = bullets.map((m, i) => `${i + 1}. ${m}`).join(' ');
      }
    }

  } catch (err) {
    console.log(`  [${char}] 解析失败: ${err.message}`);
  }

  return result;
}

// 获取数据库中缺少释义的汉字
async function getMissingChars() {
  console.log('正在查询数据库中缺少释义的汉字...');

  const { data, error } = await supabase
    .from('dictionary')
    .select('char')
    .or('explanation.is.null,explanation.eq.')
    .limit(maxLimit)
    .range(startIndex, startIndex + maxLimit - 1);

  if (error) {
    console.error('查询失败:', error.message);
    return [];
  }

  return data.map(d => d.char);
}

// 获取数据库中所有汉字
async function getAllChars() {
  console.log('正在查询数据库中的汉字...');

  const { data, error } = await supabase
    .from('dictionary')
    .select('char')
    .limit(maxLimit)
    .range(startIndex, startIndex + maxLimit - 1);

  if (error) {
    console.error('查询失败:', error.message);
    return [];
  }

  return data.map(d => d.char);
}

// 更新数据库
async function updateDatabase(charData) {
  if (!charData.explanation) {
    return false;
  }

  const updateData = {};
  if (charData.explanation) updateData.explanation = charData.explanation;
  if (charData.pinyin) updateData.pinyin = charData.pinyin;
  if (charData.strokes) updateData.total_strokes = charData.strokes;
  if (charData.radical) updateData.radical = charData.radical;

  const { error } = await supabase
    .from('dictionary')
    .update(updateData)
    .eq('char', charData.char);

  if (error) {
    console.log(`  [${charData.char}] 更新失败: ${error.message}`);
    return false;
  }

  return true;
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('chl.cn 汉字释义爬虫');
  console.log('========================================');
  console.log(`模式: ${isTest ? '测试' : '正式'}`);
  console.log(`范围: ${onlyMissing ? '仅缺少释义的字' : '所有字'}`);
  console.log(`起始: ${startIndex}, 限制: ${maxLimit}`);
  console.log(`更新数据库: ${updateDb ? '是' : '否（仅输出JSON）'}`);
  console.log('========================================\n');

  // 获取要爬取的汉字列表
  let chars;
  if (isTest) {
    // 测试模式：使用几个示例字
    chars = ['桍', '枯', '木', '林', '森'];
  } else if (onlyMissing) {
    chars = await getMissingChars();
  } else {
    chars = await getAllChars();
  }

  console.log(`共有 ${chars.length} 个汉字待处理\n`);

  if (chars.length === 0) {
    console.log('没有需要处理的汉字');
    return;
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    process.stdout.write(`[${i + 1}/${chars.length}] 处理 "${char}"... `);

    const data = await fetchCharFromChl(char);

    if (data && data.explanation) {
      console.log(`成功 - ${data.explanation.substring(0, 50)}...`);
      results.push(data);

      if (updateDb) {
        const updated = await updateDatabase(data);
        if (updated) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        successCount++;
      }
    } else if (data) {
      console.log('无释义');
      skipCount++;
    } else {
      console.log('失败');
      failCount++;
    }

    // 添加延迟避免请求过快（每个请求间隔 500ms）
    if (i < chars.length - 1) {
      await delay(500);
    }
  }

  console.log('\n========================================');
  console.log('爬取完成');
  console.log(`成功: ${successCount}, 失败: ${failCount}, 跳过: ${skipCount}`);
  console.log('========================================\n');

  // 保存结果到 JSON 文件
  if (results.length > 0) {
    const outputPath = path.join(__dirname, 'data', 'chl-scraped.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`结果已保存到: ${outputPath}`);
  }
}

main().catch(console.error);
