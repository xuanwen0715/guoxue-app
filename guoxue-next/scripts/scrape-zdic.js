/**
 * 汉典 (zdic.net) 爬虫 - Playwright 版本
 * 用于爬取 CJK 扩展 B 及以上字符的释义
 *
 * 使用方法:
 *   node scripts/scrape-zdic.js status   # 查看状态
 *   node scripts/scrape-zdic.js day1     # 执行第1天任务
 *   node scripts/scrape-zdic.js day2     # 执行第2天任务
 */

require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Supabase 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 爬取配置
const BATCH_SIZE = 300;  // 每批处理数量
const DELAY_MS = 1000;   // 请求间隔（毫秒）

let browser = null;
let page = null;

/**
 * 初始化浏览器
 */
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
    page = await browser.newPage();
    // 设置较长的超时
    page.setDefaultTimeout(30000);
  }
  return page;
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

/**
 * 从汉典获取字符信息
 */
async function fetchCharFromZdic(char, retries = 2) {
  const url = `https://www.zdic.net/hans/${encodeURIComponent(char)}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = await initBrowser();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // 等待内容加载
      await p.waitForSelector('.nr-box-shiyi', { timeout: 10000 }).catch(() => null);

      // 提取基本解释
      let explanation = '';
      const jbjsContent = await p.$('.nr-box-shiyi.jbjs .content.definitions.jnr');
      if (jbjsContent) {
        // 获取所有释义
        const explanations = await p.$$eval('.nr-box-shiyi.jbjs .content.definitions.jnr ol li', (lis) => {
          return lis.map((li, i) => `${i + 1}. ${li.textContent.trim()}`);
        }).catch(() => []);

        // 如果没有 ol li，尝试获取 p 标签中的内容
        if (explanations.length === 0) {
          const pTexts = await p.$$eval('.nr-box-shiyi.jbjs .content.definitions.jnr p', (ps) => {
            return ps.map(p => p.textContent.trim()).filter(t => t && !t.match(/^●/) && !t.match(/ㄅ|ㄆ|ㄇ|ㄈ/));
          }).catch(() => []);
          explanation = pTexts.join(' ');
        } else {
          explanation = explanations.join(' ');
        }
      }

      // 提取拼音
      let pinyin = '';
      const pinyinEl = await p.$('.dicpy');
      if (pinyinEl) {
        const pinyinText = await pinyinEl.textContent();
        pinyin = pinyinText.trim().split(/\s+/)[0];
      }

      // 提取部首和笔画
      let radical = '';
      let strokes = null;

      const bsText = await p.$eval('.z_bs2', el => el.textContent).catch(() => '');
      if (bsText) {
        const radicalMatch = bsText.match(/部首\s*([^\s]+)/);
        const strokesMatch = bsText.match(/总笔画\s*(\d+)/);
        if (radicalMatch) radical = radicalMatch[1].trim();
        if (strokesMatch) strokes = parseInt(strokesMatch[1]);
      }

      // 如果没有找到释义，返回 null
      if (!explanation || explanation.length < 2) {
        return null;
      }

      return {
        char,
        pinyin: pinyin || null,
        radical: radical || null,
        strokes: strokes,
        explanation: explanation.substring(0, 1000), // 限制长度
      };

    } catch (error) {
      if (error.message && error.message.includes('404')) {
        return null;
      }

      // 检测浏览器崩溃
      const isCrash = error.message && (
        error.message.includes('crash') ||
        error.message.includes('closed') ||
        error.message.includes('Target closed')
      );

      if (isCrash && attempt < retries) {
        // 浏览器崩溃，重启并重试
        await closeBrowser();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        continue;
      }

      throw error;
    }
  }
}

/**
 * 更新数据库
 */
async function updateDatabase(charData) {
  const response = await axios.patch(
    `${SUPABASE_URL}/rest/v1/dictionary?char=eq.${encodeURIComponent(charData.char)}`,
    {
      explanation: charData.explanation,
    },
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    }
  );
  return response.status === 204;
}

/**
 * 获取待爬取的字符列表（扩展B及以上，无释义）
 */
async function getCharsToScrape(limit = 1000, offset = 0) {
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/dictionary`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      params: {
        select: 'char,pinyin',
        or: '(explanation.is.null,explanation.eq.)',
        limit,
        offset,
        order: 'char.asc',
      },
    }
  );

  return response.data || [];
}

/**
 * 获取统计信息
 */
async function getStats() {
  // 获取无释义总数
  const countResp = await axios.get(
    `${SUPABASE_URL}/rest/v1/dictionary`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
      },
      params: {
        select: 'char',
        or: '(explanation.is.null,explanation.eq.)',
        limit: 1,
      },
    }
  );

  const totalMissing = parseInt(countResp.headers['content-range']?.split('/')[1] || '0');

  return {
    totalMissing,
    batchSize: BATCH_SIZE,
    estimatedDays: Math.ceil(totalMissing / BATCH_SIZE),
  };
}

/**
 * 显示状态
 */
async function showStatus() {
  console.log('========================================');
  console.log('汉典 (zdic.net) 爬取计划状态');
  console.log('========================================\n');

  const stats = await getStats();

  console.log(`缺少释义总数: ${stats.totalMissing}`);
  console.log(`每批爬取数量: ${stats.batchSize}`);
  console.log(`预计需要天数: ${stats.estimatedDays} 天`);
  console.log(`请求间隔: ${DELAY_MS}ms`);

  console.log('\n----------------------------------------');
  console.log('使用方法:');
  console.log('  node scripts/scrape-zdic.js day1   # 执行第1天任务');
  console.log('  node scripts/scrape-zdic.js day2   # 执行第2天任务');
  console.log('  ...');
  console.log('----------------------------------------');
}

/**
 * 执行某一天的爬取任务
 */
async function runDay(dayNum) {
  console.log('========================================');
  console.log(`汉典爬取 (Playwright) - 第 ${dayNum} 天`);
  console.log('========================================');
  console.log(`每批数量: ${BATCH_SIZE}`);
  console.log(`请求间隔: ${DELAY_MS}ms`);
  console.log('========================================\n');

  const offset = (dayNum - 1) * BATCH_SIZE;
  const chars = await getCharsToScrape(BATCH_SIZE, 0); // 总是从头获取未处理的

  if (chars.length === 0) {
    console.log('没有更多可爬取的汉字了！可能已经全部完成。');
    return;
  }

  console.log(`本批次待处理: ${chars.length} 个汉字\n`);

  const results = [];
  let success = 0;
  let failed = 0;

  try {
    // 初始化浏览器
    await initBrowser();
    console.log('浏览器已启动\n');

    for (let i = 0; i < chars.length; i++) {
      const item = chars[i];
      const char = item.char;
      const code = char.codePointAt(0);

      // 每50个字符重启浏览器，防止内存泄漏
      if (i > 0 && i % 50 === 0) {
        console.log('\n[重启浏览器以释放内存...]\n');
        await closeBrowser();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await initBrowser();
      }

      process.stdout.write(`[${i + 1}/${chars.length}] "${char}" (U+${code.toString(16).toUpperCase()}) ... `);

      try {
        const data = await fetchCharFromZdic(char);

        if (data && data.explanation) {
          await updateDatabase(data);
          results.push(data);
          success++;
          console.log(`✓ ${data.explanation.substring(0, 50)}...`);
        } else {
          failed++;
          console.log('✗ 未找到释义');
        }
      } catch (error) {
        failed++;
        console.log(`✗ 错误: ${error.message}`);
      }

      // 请求间隔
      if (i < chars.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
  } finally {
    // 关闭浏览器
    await closeBrowser();
    console.log('\n浏览器已关闭');
  }

  console.log('\n========================================');
  console.log(`第 ${dayNum} 天爬取完成`);
  console.log(`成功: ${success}, 失败: ${failed}`);
  console.log('========================================');

  // 保存结果到文件
  if (results.length > 0) {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const outputFile = path.join(dataDir, `zdic-day${dayNum}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`结果已保存: ${outputFile}`);
  }

  console.log(`\n下一步: node scripts/scrape-zdic.js day${dayNum + 1}`);
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'status') {
    await showStatus();
  } else if (command.startsWith('day')) {
    const dayNum = parseInt(command.replace('day', ''));
    if (isNaN(dayNum) || dayNum < 1) {
      console.error('无效的天数，请使用 day1, day2, ...');
      process.exit(1);
    }
    await runDay(dayNum);
  } else {
    console.error('未知命令。使用 status 或 day1, day2, ...');
    process.exit(1);
  }
}

main().catch(console.error);
