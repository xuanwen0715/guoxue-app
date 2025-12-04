// 文件路径: scripts/import-unihan.js
// 用途: 从 Unihan JSON 数据导入完整的汉字字典到 Supabase
// 数据来源: https://github.com/dahlia/unihan-json

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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data', 'unihan');

// 康熙部首表 (214个部首，索引对应部首编号)
const KANGXI_RADICALS = [
  '', // 0 占位
  '一', '丨', '丶', '丿', '乙', '亅', '二', '亠', '人', '儿', // 1-10
  '入', '八', '冂', '冖', '冫', '几', '凵', '刀', '力', '勹', // 11-20
  '匕', '匚', '匸', '十', '卜', '卩', '厂', '厶', '又', '口', // 21-30
  '囗', '土', '士', '夂', '夊', '夕', '大', '女', '子', '宀', // 31-40
  '寸', '小', '尢', '尸', '屮', '山', '巛', '工', '己', '巾', // 41-50
  '干', '幺', '广', '廴', '廾', '弋', '弓', '彐', '彡', '彳', // 51-60
  '心', '戈', '戶', '手', '支', '攴', '文', '斗', '斤', '方', // 61-70
  '无', '日', '曰', '月', '木', '欠', '止', '歹', '殳', '毋', // 71-80
  '比', '毛', '氏', '气', '水', '火', '爪', '父', '爻', '爿', // 81-90
  '片', '牙', '牛', '犬', '玄', '玉', '瓜', '瓦', '甘', '生', // 91-100
  '用', '田', '疋', '疒', '癶', '白', '皮', '皿', '目', '矛', // 101-110
  '矢', '石', '示', '禸', '禾', '穴', '立', '竹', '米', '糸', // 111-120
  '缶', '网', '羊', '羽', '老', '而', '耒', '耳', '聿', '肉', // 121-130
  '臣', '自', '至', '臼', '舌', '舛', '舟', '艮', '色', '艸', // 131-140
  '虍', '虫', '血', '行', '衣', '襾', '見', '角', '言', '谷', // 141-150
  '豆', '豕', '豸', '貝', '赤', '走', '足', '身', '車', '辛', // 151-160
  '辰', '辵', '邑', '酉', '釆', '里', '金', '長', '門', '阜', // 161-170
  '隶', '隹', '雨', '靑', '非', '面', '革', '韋', '韭', '音', // 171-180
  '頁', '風', '飛', '食', '首', '香', '馬', '骨', '高', '髟', // 181-190
  '鬥', '鬯', '鬲', '鬼', '魚', '鳥', '鹵', '鹿', '麥', '麻', // 191-200
  '黃', '黍', '黑', '黹', '黽', '鼎', '鼓', '鼠', '鼻', '齊', // 201-210
  '齒', '龍', '龜', '龠'  // 211-214
];

// 加载 JSON 文件
function loadJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`警告: 文件不存在 ${filename}`);
    return {};
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

// 解析部首信息 (格式如 "85.8" 表示第85部首，额外8画)
function parseRadical(rsValue) {
  if (!rsValue) return { radical: null, extraStrokes: 0 };

  // 可能有多个值，取第一个
  const value = Array.isArray(rsValue) ? rsValue[0] : rsValue;
  const match = value.match(/^(\d+)'?\.(\d+)$/);

  if (match) {
    const radicalNum = parseInt(match[1]);
    const extraStrokes = parseInt(match[2]);
    const radical = KANGXI_RADICALS[radicalNum] || null;
    return { radical, extraStrokes };
  }

  return { radical: null, extraStrokes: 0 };
}

// 构建繁简映射
function buildVariantMaps(tradData, simpData) {
  const simpToTrad = {}; // 简体 -> 繁体
  const tradToSimp = {}; // 繁体 -> 简体

  // 从 kTraditionalVariant: 简体字 -> [繁体字...]
  for (const [simp, tradArray] of Object.entries(tradData)) {
    if (Array.isArray(tradArray) && tradArray.length > 0) {
      simpToTrad[simp] = tradArray[0]; // 取第一个繁体
    }
  }

  // 从 kSimplifiedVariant: 繁体字 -> [简体字...]
  for (const [trad, simpArray] of Object.entries(simpData)) {
    if (Array.isArray(simpArray) && simpArray.length > 0) {
      tradToSimp[trad] = simpArray[0]; // 取第一个简体
    }
  }

  return { simpToTrad, tradToSimp };
}

async function main() {
  console.log('\n========================================');
  console.log('Unihan 汉字数据导入工具');
  console.log('========================================\n');

  // 1. 加载所有数据文件
  console.log('正在加载 Unihan 数据文件...');

  const definitions = loadJson('kDefinition.json');
  const mandarin = loadJson('kMandarin.json');
  const strokes = loadJson('kTotalStrokes.json');
  const radicals = loadJson('kRSUnicode.json');
  const tradVariants = loadJson('kTraditionalVariant.json');
  const simpVariants = loadJson('kSimplifiedVariant.json');

  console.log(`  - 释义数据: ${Object.keys(definitions).length} 条`);
  console.log(`  - 拼音数据: ${Object.keys(mandarin).length} 条`);
  console.log(`  - 笔画数据: ${Object.keys(strokes).length} 条`);
  console.log(`  - 部首数据: ${Object.keys(radicals).length} 条`);
  console.log(`  - 繁体映射: ${Object.keys(tradVariants).length} 条`);
  console.log(`  - 简体映射: ${Object.keys(simpVariants).length} 条`);

  // 2. 构建繁简映射
  console.log('\n正在构建繁简对照表...');
  const { simpToTrad, tradToSimp } = buildVariantMaps(tradVariants, simpVariants);
  console.log(`  - 简转繁: ${Object.keys(simpToTrad).length} 组`);
  console.log(`  - 繁转简: ${Object.keys(tradToSimp).length} 组`);

  // 3. 收集所有汉字 (从所有数据源)
  const allChars = new Set();
  [definitions, mandarin, strokes, radicals].forEach(data => {
    Object.keys(data).forEach(char => allChars.add(char));
  });

  // 也添加繁体字
  Object.values(simpToTrad).forEach(trad => allChars.add(trad));
  Object.keys(tradToSimp).forEach(trad => allChars.add(trad));

  console.log(`\n总计 ${allChars.size} 个不同的汉字`);

  // 4. 构建完整的字典数据
  console.log('\n正在构建字典数据...');

  const dictData = [];

  for (const char of allChars) {
    // 判断是简体还是繁体
    let traditional = null;
    let simplified = char;

    if (simpToTrad[char]) {
      // char 是简体，有对应繁体
      traditional = simpToTrad[char];
    } else if (tradToSimp[char]) {
      // char 是繁体，找到对应简体
      simplified = tradToSimp[char];
      traditional = char;
    }

    // 获取笔画 (可能是数组)
    let strokeCount = 0;
    if (strokes[char]) {
      strokeCount = Array.isArray(strokes[char]) ? strokes[char][0] : strokes[char];
    }

    // 解析部首
    const { radical } = parseRadical(radicals[char]);

    // 获取拼音
    const pinyin = mandarin[char] || null;

    // 获取释义 (优先使用简体的释义)
    let explanation = definitions[simplified] || definitions[char] || null;

    // 只保留有实质内容的条目 (至少有拼音或释义)
    if (!pinyin && !explanation) {
      continue;
    }

    dictData.push({
      char: simplified,
      traditional: traditional,
      pinyin: pinyin,
      radical: radical,
      total_strokes: strokeCount,
      explanation: explanation
    });
  }

  // 去重 (以简体字为主键)
  const uniqueMap = new Map();
  for (const item of dictData) {
    const existing = uniqueMap.get(item.char);
    if (!existing) {
      uniqueMap.set(item.char, item);
    } else {
      // 合并数据，保留更完整的
      if (!existing.traditional && item.traditional) {
        existing.traditional = item.traditional;
      }
      if (!existing.pinyin && item.pinyin) {
        existing.pinyin = item.pinyin;
      }
      if (!existing.explanation && item.explanation) {
        existing.explanation = item.explanation;
      }
    }
  }

  const finalData = Array.from(uniqueMap.values());
  console.log(`去重后: ${finalData.length} 个汉字条目`);

  // 5. 写入数据库
  console.log('\n正在写入数据库...');
  console.log('使用 upsert 模式，会更新已存在的条目\n');

  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < finalData.length; i += BATCH_SIZE) {
    const chunk = finalData.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('dictionary')
      .upsert(chunk, {
        onConflict: 'char',
        ignoreDuplicates: false  // 更新已存在的
      });

    if (error) {
      console.error(`\n第 ${i} 条附近出错:`, error.message);
      errorCount += chunk.length;
    } else {
      successCount += chunk.length;
      process.stdout.write(`\r进度: ${successCount} / ${finalData.length} (${(successCount/finalData.length*100).toFixed(1)}%)`);
    }
  }

  console.log('\n');
  console.log('========================================');
  console.log(`导入完成！成功: ${successCount}, 失败: ${errorCount}`);
  console.log('========================================\n');

  // 6. 显示一些示例
  console.log('示例数据:');
  const samples = ['学', '龙', '国', '马', '车'];
  for (const s of samples) {
    const item = uniqueMap.get(s);
    if (item) {
      console.log(`  ${item.char} -> ${item.traditional || '(无繁体)'} [${item.pinyin}]`);
    }
  }
}

main().catch(console.error);
