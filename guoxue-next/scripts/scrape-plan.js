/**
 * chl.cn 爬取计划管理工具
 *
 * 用法:
 *   node scripts/scrape-plan.js status    - 查看当前进度
 *   node scripts/scrape-plan.js day1      - 执行第1天的爬取任务
 *   node scripts/scrape-plan.js day2      - 执行第2天的爬取任务
 *   ...
 *   node scripts/scrape-plan.js dayN      - 执行第N天的爬取任务
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: 缺少 Supabase 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 配置
const BATCH_SIZE = 200;  // 每天爬取的数量
const DELAY_MS = 600;    // 请求间隔（毫秒）

// 判断是否是可爬取的汉字（基本区 + 扩展A）
function isScrapableChar(char) {
  const code = char.codePointAt(0);
  // 基本区: 4E00-9FFF, 扩展A: 3400-4DBF
  return (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF);
}

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 从 chl.cn 获取汉字信息
async function fetchCharFromChl(char) {
  const url = 'https://chl.cn/zidian/';

  try {
    const response = await axios.post(url, `str=${encodeURIComponent(char)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://chl.cn/zidian/',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    if (!html.includes('基本字义') && !html.includes('的拼音')) {
      return null;
    }

    return parseCharHtml(html, char);
  } catch (err) {
    return null;
  }
}

// 解析 HTML
function parseCharHtml(html, char) {
  const result = { char, pinyin: null, strokes: null, radical: null, explanation: null };

  try {
    const pinyinMatch = html.match(/拼音：<a[^>]*>([^<]+)<\/a>/);
    if (pinyinMatch) result.pinyin = pinyinMatch[1].trim();

    const strokesMatch = html.match(/笔画数：(\d+)画/);
    if (strokesMatch) result.strokes = parseInt(strokesMatch[1]);

    const radicalMatch = html.match(/部首：<a[^>]*>([^<]+)<\/a>/);
    if (radicalMatch) result.radical = radicalMatch[1].trim();

    // 提取释义
    const meanings = [];
    const meaningMatches = html.matchAll(/<p[^>]*>•\s*([^<]+)<\/p>/g);
    for (const match of meaningMatches) {
      const meaning = match[1].trim();
      if (meaning && meaning.length > 1 && meaning !== char) {
        meanings.push(meaning);
      }
    }
    if (meanings.length > 0) {
      result.explanation = meanings.map((m, i) => `${i + 1}. ${m}`).join(' ');
    }
  } catch (err) {
    // 忽略解析错误
  }

  return result;
}

// 更新数据库
async function updateDatabase(charData) {
  if (!charData.explanation) return false;

  const updateData = { explanation: charData.explanation };
  if (charData.pinyin) updateData.pinyin = charData.pinyin;
  if (charData.strokes) updateData.total_strokes = charData.strokes;
  if (charData.radical) updateData.radical = charData.radical;

  const { error } = await supabase
    .from('dictionary')
    .update(updateData)
    .eq('char', charData.char);

  return !error;
}

// 获取可爬取的缺少释义的汉字
async function getScrapableChars(offset = 0, limit = BATCH_SIZE) {
  // 获取更多数据，然后过滤出可爬取的
  const { data, error } = await supabase
    .from('dictionary')
    .select('char')
    .or('explanation.is.null,explanation.eq.')
    .range(offset, offset + limit * 10);  // 多取一些，因为要过滤

  if (error) {
    console.error('查询失败:', error.message);
    return [];
  }

  // 过滤出可爬取的汉字
  const scrapable = data.filter(d => isScrapableChar(d.char)).slice(0, limit);
  return scrapable.map(d => d.char);
}

// 查看状态
async function showStatus() {
  console.log('========================================');
  console.log('chl.cn 爬取计划状态');
  console.log('========================================\n');

  // 总缺少释义数
  const { count: totalMissing } = await supabase
    .from('dictionary')
    .select('char', { count: 'exact', head: true })
    .or('explanation.is.null,explanation.eq.');

  // 获取样本统计可爬取数量
  const { data: sample } = await supabase
    .from('dictionary')
    .select('char')
    .or('explanation.is.null,explanation.eq.')
    .limit(5000);

  const scrapableCount = sample.filter(d => isScrapableChar(d.char)).length;
  const estimatedTotal = Math.round(totalMissing * scrapableCount / sample.length);

  console.log(`缺少释义总数: ${totalMissing}`);
  console.log(`预估可爬取数: ${estimatedTotal} (基本区+扩展A)`);
  console.log(`预估不可爬取: ${totalMissing - estimatedTotal} (扩展B+罕见字)`);
  console.log(`\n每批爬取数量: ${BATCH_SIZE}`);
  console.log(`预计需要天数: ${Math.ceil(estimatedTotal / BATCH_SIZE)} 天`);

  console.log('\n----------------------------------------');
  console.log('使用方法:');
  console.log('  node scripts/scrape-plan.js day1   # 执行第1天任务');
  console.log('  node scripts/scrape-plan.js day2   # 执行第2天任务');
  console.log('  ...');
  console.log('----------------------------------------');
}

// 执行某一天的爬取任务
async function runDay(dayNum) {
  const offset = (dayNum - 1) * BATCH_SIZE * 10;  // 考虑到过滤，offset 要大一些

  console.log('========================================');
  console.log(`chl.cn 爬取 - 第 ${dayNum} 天`);
  console.log('========================================');
  console.log(`每批数量: ${BATCH_SIZE}`);
  console.log(`请求间隔: ${DELAY_MS}ms`);
  console.log('========================================\n');

  // 获取这一批要爬取的汉字
  const chars = await getScrapableChars(offset, BATCH_SIZE);

  if (chars.length === 0) {
    console.log('没有更多可爬取的汉字了！可能已经全部完成。');
    return;
  }

  console.log(`本批次待处理: ${chars.length} 个汉字\n`);

  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    process.stdout.write(`[${i + 1}/${chars.length}] "${char}" ... `);

    const data = await fetchCharFromChl(char);

    if (data && data.explanation) {
      const updated = await updateDatabase(data);
      if (updated) {
        console.log(`✓ ${data.explanation.substring(0, 40)}...`);
        successCount++;
        results.push(data);
      } else {
        console.log('✗ 更新失败');
        failCount++;
      }
    } else {
      console.log('✗ 未找到');
      failCount++;
    }

    if (i < chars.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log('\n========================================');
  console.log(`第 ${dayNum} 天爬取完成`);
  console.log(`成功: ${successCount}, 失败: ${failCount}`);
  console.log('========================================');

  // 保存结果
  if (results.length > 0) {
    const outputDir = path.join(__dirname, 'data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `chl-day${dayNum}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`结果已保存: ${outputPath}`);
  }

  console.log(`\n下一步: node scripts/scrape-plan.js day${dayNum + 1}`);
}

// 主函数
async function main() {
  const command = process.argv[2];

  if (!command || command === 'status') {
    await showStatus();
  } else if (command.startsWith('day')) {
    const dayNum = parseInt(command.replace('day', ''));
    if (isNaN(dayNum) || dayNum < 1) {
      console.error('无效的天数，请使用 day1, day2, day3 等');
      process.exit(1);
    }
    await runDay(dayNum);
  } else {
    console.log('用法:');
    console.log('  node scripts/scrape-plan.js status  - 查看状态');
    console.log('  node scripts/scrape-plan.js day1    - 执行第1天任务');
    console.log('  node scripts/scrape-plan.js day2    - 执行第2天任务');
  }
}

main().catch(console.error);
