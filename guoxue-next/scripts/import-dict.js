// 文件路径: scripts/import-dict.js
// 用途: 从本地文件导入汉字字典、成语、词语数据到 Supabase

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 检查环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n错误: 环境变量缺失！');
  console.error('请检查根目录下的 .env.local 文件。');
  console.error('确保里面有: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 本地数据文件路径
const DATA_DIR = path.join(__dirname, 'data');

// 数据源配置
const DATA_SOURCES = {
  word: {
    file: path.join(DATA_DIR, 'word.json'),
    table: 'dictionary',
    name: '汉字字典',
    transform: (item) => ({
      char: item.word,
      traditional: item.oldword || null,
      radical: item.radicals || null,
      total_strokes: parseInt(item.strokes) || 0,
      pinyin: item.pinyin || null,
      explanation: item.explanation || null
    }),
    conflictColumn: 'char'
  },
  idiom: {
    file: path.join(DATA_DIR, 'idiom.json'),
    table: 'idioms',
    name: '成语词典',
    transform: (item) => ({
      word: item.word,
      pinyin: item.pinyin || null,
      explanation: item.explanation || null,
      derivation: item.derivation || null,
      example: item.example || null,
      abbreviation: item.abbreviation || null
    }),
    conflictColumn: 'word'
  },
  ci: {
    file: path.join(DATA_DIR, 'ci.json'),
    table: 'words',
    name: '词语词典',
    transform: (item) => ({
      word: item.ci,
      explanation: item.explanation || null
    }),
    conflictColumn: 'word'
  }
};

// 通用导入函数
async function importData(sourceKey) {
  const source = DATA_SOURCES[sourceKey];
  if (!source) {
    console.error(`未知的数据源: ${sourceKey}`);
    return false;
  }

  console.log(`\n========================================`);
  console.log(`开始导入: ${source.name}`);
  console.log(`目标表: ${source.table}`);
  console.log(`========================================`);

  try {
    // 检查本地文件是否存在
    if (!fs.existsSync(source.file)) {
      throw new Error(`文件不存在: ${source.file}\n请确保已下载数据文件到 scripts/data/ 目录`);
    }

    console.log(`读取本地文件: ${path.basename(source.file)}`);
    const fileContent = fs.readFileSync(source.file, 'utf-8');
    const rawData = JSON.parse(fileContent);

    console.log(`原始数据: ${rawData.length} 条`);

    // 转换数据并去重 (同一批次内不能有重复的 key)
    const transformedData = rawData.map(source.transform);
    const uniqueMap = new Map();
    for (const item of transformedData) {
      const key = item[source.conflictColumn];
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const uniqueData = Array.from(uniqueMap.values());
    console.log(`去重后: ${uniqueData.length} 条 (移除 ${rawData.length - uniqueData.length} 条重复)`);
    console.log('正在写入数据库...\n');

    const BATCH_SIZE = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < uniqueData.length; i += BATCH_SIZE) {
      const chunk = uniqueData.slice(i, i + BATCH_SIZE);

      // 使用 upsert 防止重复导入
      const { error } = await supabase
        .from(source.table)
        .upsert(chunk, {
          onConflict: source.conflictColumn,
          ignoreDuplicates: true
        });

      if (error) {
        console.error(`\n第 ${i} 条附近出错:`, error.message);
        errorCount += chunk.length;
      } else {
        successCount += chunk.length;
        process.stdout.write(`\r进度: ${successCount} / ${uniqueData.length} (${(successCount/uniqueData.length*100).toFixed(1)}%)`);
      }
    }

    console.log('\n');
    console.log(`${source.name} 导入完成！成功: ${successCount}, 失败: ${errorCount}`);
    return true;

  } catch (err) {
    console.error(`\n${source.name} 导入失败:`, err.message);
    return false;
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`
国学词典数据导入工具
====================

用法: npm run import:dict [选项]

选项:
  all     导入全部数据 (汉字 + 成语 + 词语)
  word    仅导入汉字字典 (约 16,000 条)
  idiom   仅导入成语词典 (约 31,000 条)
  ci      仅导入词语词典 (约 264,000 条)

示例:
  npm run import:dict all     # 导入全部
  npm run import:dict word    # 仅导入汉字
  npm run import:dict idiom   # 仅导入成语
  npm run import:dict ci      # 仅导入词语

注意:
  - 脚本使用 upsert，可安全重复运行
  - 词语数据量较大，导入时间较长
`);
}

// 主函数
async function main() {
  const arg = process.argv[2];

  if (!arg || arg === 'help' || arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  }

  console.log('\n国学词典数据导入工具');
  console.log('====================');

  const startTime = Date.now();

  if (arg === 'all') {
    // 按顺序导入全部
    await importData('word');
    await importData('idiom');
    await importData('ci');
  } else if (DATA_SOURCES[arg]) {
    await importData(arg);
  } else {
    console.error(`\n错误: 未知参数 "${arg}"`);
    showHelp();
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`全部完成！总耗时: ${elapsed} 秒`);
  console.log(`========================================\n`);
}

main();
