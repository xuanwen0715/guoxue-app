import os
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Supabase 配置
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")


# OpenCC 简繁转换（用于字级变体扩展，最小侵入式集成）
try:
    from opencc import OpenCC  # type: ignore
    _CC_S2T = OpenCC('s2t')
    _CC_T2S = OpenCC('t2s')
except Exception:
    _CC_S2T = None
    _CC_T2S = None


def _parse_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _expand_char_variants(ch: str) -> set:
    """返回输入单字的简体/繁体变体集合（仅单字符）。

    - 优先包含原字符
    - 若 OpenCC 可用，则加入 s2t/t2s 形态
    - 仅保留长度为 1 的结果，避免多字符替换
    """
    forms = {ch}
    try:
        if _CC_T2S is not None:
            forms.add(_CC_T2S.convert(ch))
        if _CC_S2T is not None:
            forms.add(_CC_S2T.convert(ch))
    except Exception:
        # 若转换失败则忽略，保持降级
        pass
    return {f for f in forms if isinstance(f, str) and len(f) == 1}


class handler(BaseHTTPRequestHandler):
    """字典查询 API - 支持汉字、成语、词语检索"""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        """处理 GET 请求 - 字典查询"""
        try:
            import requests

            # 解析查询参数
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            query = params.get("q", [""])[0].strip()
            search_type = params.get("type", ["auto"])[0]  # auto, char, idiom, word
            search_by = params.get("by", ["text"])[0]  # text, pinyin, radical, strokes
            raw_limit = _parse_int(params.get("limit", ["50"])[0], 50)
            limit = min(max(raw_limit, 1), 100)
            raw_offset = _parse_int(params.get("offset", ["0"])[0], 0)
            offset = max(raw_offset, 0)

            if not query and search_by not in ["radical", "strokes"]:
                self._send_json(400, {"error": "Missing query parameter: q"})
                return

            if not SUPABASE_URL or not SUPABASE_ANON_KEY:
                self._send_json(503, {"error": "Database not configured"})
                return

            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }

            results = {"chars": [], "idioms": [], "words": []}

            # 根据搜索类型查询不同的表
            if search_type in ["auto", "char"]:
                chars = self._search_chars(headers, query, search_by, limit, offset)
                results["chars"] = chars

            if search_type in ["auto", "idiom"]:
                # 成语至少2个字
                if len(query) >= 2 or search_by == "pinyin":
                    idioms = self._search_idioms(headers, query, search_by, limit, offset)
                    results["idioms"] = idioms

            if search_type in ["auto", "word"]:
                # 词语至少2个字
                if len(query) >= 2:
                    words = self._search_words(headers, query, limit, offset)
                    results["words"] = words

            self._send_json(200, results)

        except Exception as e:
            import traceback
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _search_chars(self, headers, query, search_by, limit, offset):
        """搜索汉字"""
        import requests

        base_url = f"{SUPABASE_URL}/rest/v1/dictionary"
        params = {
            "select": "char,traditional,pinyin,radical,total_strokes,explanation",
            "limit": limit,
            "offset": offset
        }

        if search_by == "text":
            # 支持简体或繁体查询，同时扩展简繁变体
            variants = _expand_char_variants(query) if len(query) == 1 else {query}
            conditions = []
            for v in variants:
                conditions.append(f"char.eq.{v}")
                conditions.append(f"traditional.eq.{v}")
            params["or"] = f"({','.join(conditions)})"
        elif search_by == "pinyin":
            # 拼音精确匹配 - 生成所有声调变体的 OR 条件
            variants = self._get_pinyin_variants(query.lower())
            # 构建 OR 条件：pinyin.eq.qū,pinyin.eq.qú,pinyin.eq.qǔ,pinyin.eq.qù
            or_conditions = ",".join([f"pinyin.eq.{v}" for v in variants])
            params["or"] = f"({or_conditions})"
            # 按笔画数排序，让常用简单字优先显示
            params["order"] = "total_strokes.asc"
        elif search_by == "radical":
            # 部首精确匹配
            params["radical"] = f"eq.{query}"
        elif search_by == "strokes":
            # 笔画数匹配
            try:
                stroke_count = int(query)
                params["total_strokes"] = f"eq.{stroke_count}"
            except ValueError:
                return []

        resp = requests.get(base_url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            return resp.json()
        return []

    def _search_idioms(self, headers, query, search_by, limit, offset):
        """搜索成语 - 精确匹配优先，然后模糊匹配"""
        import requests

        base_url = f"{SUPABASE_URL}/rest/v1/idioms"
        results = []

        if search_by == "text":
            # 第一步：精确匹配（优先）
            params_exact = {
                "select": "word,pinyin,explanation,derivation,example",
                "word": f"eq.{query}",
                "limit": 1
            }
            resp = requests.get(base_url, headers=headers, params=params_exact, timeout=10)
            exact_results = []
            exact_words = set()
            if resp.status_code == 200:
                exact_results = resp.json()
                exact_words = {r['word'] for r in exact_results if r.get('word')}
                if offset <= 0:
                    results.extend(exact_results)

            # 第二步：模糊匹配（排除精确匹配的结果）
            remaining_limit = limit - len(results)
            if remaining_limit > 0:
                adjusted_offset = offset
                if offset > 0 and exact_results:
                    adjusted_offset = max(offset - len(exact_results), 0)
                params_fuzzy = {
                    "select": "word,pinyin,explanation,derivation,example",
                    "word": f"ilike.*{query}*",
                    "limit": remaining_limit + len(exact_words),  # 多取一些，去重后保证数量
                    "offset": adjusted_offset
                }
                resp = requests.get(base_url, headers=headers, params=params_fuzzy, timeout=10)
                if resp.status_code == 200:
                    fuzzy_results = resp.json()
                    # 去重：排除已精确匹配的
                    existing_words = exact_words if offset > 0 else {r['word'] for r in results}
                    for item in fuzzy_results:
                        if item['word'] not in existing_words and len(results) < limit:
                            results.append(item)
                            existing_words.add(item['word'])

        elif search_by == "pinyin":
            # 拼音匹配（支持首字母缩写）
            params = {
                "select": "word,pinyin,explanation,derivation,example",
                "limit": limit,
                "offset": offset
            }
            if len(query) <= 4 and query.isalpha():
                params["abbreviation"] = f"ilike.{query}*"
            else:
                params["pinyin"] = f"ilike.*{query}*"

            resp = requests.get(base_url, headers=headers, params=params, timeout=10)
            if resp.status_code == 200:
                results = resp.json()

        return results

    def _search_words(self, headers, query, limit, offset):
        """搜索词语 - 精确匹配优先，然后模糊匹配"""
        import requests

        base_url = f"{SUPABASE_URL}/rest/v1/words"
        results = []

        # 第一步：精确匹配（优先）
        params_exact = {
            "select": "word,explanation",
            "word": f"eq.{query}",
            "limit": 1
        }
        resp = requests.get(base_url, headers=headers, params=params_exact, timeout=10)
        exact_results = []
        exact_words = set()
        if resp.status_code == 200:
            exact_results = resp.json()
            exact_words = {r['word'] for r in exact_results if r.get('word')}
            if offset <= 0:
                results.extend(exact_results)

        # 第二步：模糊匹配（排除精确匹配的结果）
        remaining_limit = limit - len(results)
        if remaining_limit > 0:
            adjusted_offset = offset
            if offset > 0 and exact_results:
                adjusted_offset = max(offset - len(exact_results), 0)
            params_fuzzy = {
                "select": "word,explanation",
                "word": f"ilike.*{query}*",
                "limit": remaining_limit + len(exact_words),
                "offset": adjusted_offset
            }
            resp = requests.get(base_url, headers=headers, params=params_fuzzy, timeout=10)
            if resp.status_code == 200:
                fuzzy_results = resp.json()
                existing_words = exact_words if offset > 0 else {r['word'] for r in results}
                for item in fuzzy_results:
                    if item['word'] not in existing_words and len(results) < limit:
                        results.append(item)
                        existing_words.add(item['word'])

        return results

    def do_POST(self):
        """处理 POST 请求 - 批量查询或高级搜索"""
        try:
            import requests

            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

            action = body.get("action", "search")

            if action == "get_radicals":
                # 获取所有部首列表
                radicals = self._get_radicals()
                self._send_json(200, {"radicals": radicals})
                return

            if action == "get_char_detail":
                # 获取单个汉字详情
                char = body.get("char", "")
                if not char:
                    self._send_json(400, {"error": "Missing char parameter"})
                    return
                detail = self._get_char_detail(char)
                self._send_json(200, detail)
                return

            if action == "batch_lookup":
                # 批量查询汉字（用于主页结果展示）
                chars = body.get("chars", [])
                if not chars:
                    self._send_json(400, {"error": "Missing chars parameter"})
                    return
                results = self._batch_lookup_chars(chars[:10])  # 限制10个
                self._send_json(200, {"results": results})
                return

            self._send_json(400, {"error": f"Unknown action: {action}"})

        except Exception as e:
            import traceback
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _get_radicals(self):
        """获取所有部首及其汉字数量"""
        import requests

        # 这里简化处理，返回常用部首列表
        # 实际可以从数据库聚合查询
        common_radicals = [
            "一", "丨", "丿", "丶", "乙", "亅", "二", "亠", "人", "儿",
            "入", "八", "冂", "冖", "冫", "几", "凵", "刀", "力", "勹",
            "匕", "匚", "匸", "十", "卜", "卩", "厂", "厶", "又", "口",
            "囗", "土", "士", "夂", "夊", "夕", "大", "女", "子", "宀",
            "寸", "小", "尢", "尸", "屮", "山", "巛", "工", "己", "巾",
            "干", "幺", "广", "廴", "廾", "弋", "弓", "彐", "彡", "彳",
            "心", "戈", "戶", "手", "支", "攴", "文", "斗", "斤", "方",
            "无", "日", "曰", "月", "木", "欠", "止", "歹", "殳", "毋",
            "比", "毛", "氏", "气", "水", "火", "爪", "父", "爻", "爿",
            "片", "牙", "牛", "犬", "玄", "玉", "瓜", "瓦", "甘", "生",
            "用", "田", "疋", "疒", "癶", "白", "皮", "皿", "目", "矛",
            "矢", "石", "示", "禸", "禾", "穴", "立", "竹", "米", "糸",
            "缶", "网", "羊", "羽", "老", "而", "耒", "耳", "聿", "肉",
            "臣", "自", "至", "臼", "舌", "舛", "舟", "艮", "色", "艸",
            "虍", "虫", "血", "行", "衣", "襾", "見", "角", "言", "谷",
            "豆", "豕", "豸", "貝", "赤", "走", "足", "身", "車", "辛",
            "辰", "辵", "邑", "酉", "釆", "里", "金", "長", "門", "阜",
            "隶", "隹", "雨", "青", "非", "面", "革", "韋", "韭", "音",
            "頁", "風", "飛", "食", "首", "香", "馬", "骨", "高", "髟",
            "鬥", "鬯", "鬲", "鬼", "魚", "鳥", "鹵", "鹿", "麥", "麻",
            "黃", "黍", "黑", "黹", "黽", "鼎", "鼓", "鼠", "鼻", "齊",
            "齒", "龍", "龜", "龠"
        ]
        return common_radicals

    def _get_char_detail(self, char):
        """获取单个汉字的详细信息"""
        import requests

        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        }

        base_url = f"{SUPABASE_URL}/rest/v1/dictionary"
        params = {
            "select": "*",
            "or": f"(char.eq.{char},traditional.eq.{char})",
            "limit": 1
        }

        resp = requests.get(base_url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return {"found": True, "data": data[0]}
        return {"found": False, "data": None}

    def _batch_lookup_chars(self, chars):
        """批量查询多个汉字

        改进策略：
        1. 首先精确匹配原始输入字符
        2. 如果精确匹配失败，再尝试简繁变体
        3. 保持结果顺序与输入一致（关键改进）
        """
        import requests

        if not chars:
            return []

        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        }

        base_url = f"{SUPABASE_URL}/rest/v1/dictionary"

        # 用字典存储结果，键为原始输入字符
        char_result_map = {}  # input_char -> result_item
        found_input_chars = set()  # 已找到结果的输入字符

        # 第一步：精确匹配原始输入（优先级最高）
        original_chars = [c for c in chars if isinstance(c, str) and len(c) == 1]
        # 去重但保持顺序
        seen = set()
        unique_chars = []
        for c in original_chars:
            if c not in seen:
                seen.add(c)
                unique_chars.append(c)
        original_chars = unique_chars

        print(f"[Dictionary] Batch lookup for chars: {original_chars}")

        if original_chars:
            conditions = []
            for c in original_chars:
                conditions.append(f"char.eq.{c}")
                conditions.append(f"traditional.eq.{c}")
            or_conditions = ",".join(conditions)

            params = {
                "select": "char,traditional,pinyin,radical,total_strokes,explanation",
                "or": f"({or_conditions})",
                "limit": len(original_chars) * 2
            }

            resp = requests.get(base_url, headers=headers, params=params, timeout=10)
            print(f"[Dictionary] Exact match response status: {resp.status_code}")

            if resp.status_code == 200:
                db_results = resp.json()
                print(f"[Dictionary] Found {len(db_results)} results from DB")

                for item in db_results:
                    char_val = item.get('char', '')
                    trad_val = item.get('traditional', '')
                    print(f"[Dictionary] DB item: char={char_val}, trad={trad_val}, pinyin={item.get('pinyin')}")

                    # 找到这个结果对应的原始输入字符
                    for input_char in original_chars:
                        if input_char in found_input_chars:
                            continue
                        # 精确匹配：输入字符等于 char 或 traditional
                        if char_val == input_char or trad_val == input_char:
                            char_result_map[input_char] = item
                            found_input_chars.add(input_char)
                            print(f"[Dictionary] Added exact match: {input_char} -> {char_val}")
                            break

        # 第二步：对于未找到的字符，尝试简繁变体扩展
        missing_chars = [c for c in original_chars if c not in found_input_chars]
        print(f"[Dictionary] Missing chars after exact match: {missing_chars}")

        if missing_chars:
            # 建立变体到原始输入的映射
            variant_to_inputs = {}  # variant -> list of input chars
            expanded = set()

            for c in missing_chars:
                variants = _expand_char_variants(c)
                print(f"[Dictionary] Variants for '{c}': {variants}")
                for v in variants:
                    if v != c:  # 排除原字符（已经查过）
                        expanded.add(v)
                        variant_to_inputs.setdefault(v, []).append(c)

            if expanded:
                conditions = []
                for v in sorted(expanded):
                    conditions.append(f"char.eq.{v}")
                    conditions.append(f"traditional.eq.{v}")
                or_conditions = ",".join(conditions)

                params = {
                    "select": "char,traditional,pinyin,radical,total_strokes,explanation",
                    "or": f"({or_conditions})",
                    "limit": len(expanded) * 2
                }

                resp = requests.get(base_url, headers=headers, params=params, timeout=10)
                if resp.status_code == 200:
                    for item in resp.json():
                        char_val = item.get('char', '')
                        trad_val = item.get('traditional', '')

                        # 找到这个结果对应的原始输入字符
                        input_chars = None
                        if char_val in variant_to_inputs:
                            input_chars = variant_to_inputs[char_val]
                        elif trad_val in variant_to_inputs:
                            input_chars = variant_to_inputs[trad_val]

                        if input_chars:
                            for input_char in input_chars:
                                if input_char in found_input_chars:
                                    continue
                                char_result_map[input_char] = item
                                found_input_chars.add(input_char)
                                print(f"[Dictionary] Added variant match: {input_char} -> {char_val}")

        # 按原始输入顺序构建结果数组
        results = []
        for c in original_chars:
            if c in char_result_map:
                results.append(char_result_map[c])

        print(f"[Dictionary] Final results count: {len(results)}")
        return results

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "public, max-age=300")  # 缓存5分钟
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _pinyin_to_pattern(self, pinyin):
        """将无声调拼音转换为可匹配带声调拼音的 ILIKE 模式

        改进逻辑：精确匹配拼音长度，只替换元音为通配符
        例如: qu -> q_ (精确匹配 qū, qú, qǔ, qù)
        例如: dao -> d_o (精确匹配 dào, dǎo, dāo, dáo)
        """
        # 元音字母（可能带声调）
        vowels = set('aeiouü')

        # 构建精确匹配模式（不加前后通配符，精确匹配拼音长度）
        pattern = ''
        for char in pinyin:
            if char in vowels:
                # 用 _ 通配符匹配任意单字符（包括带声调的元音）
                pattern += '_'
            else:
                pattern += char

        return pattern

    def _get_pinyin_variants(self, pinyin):
        """将无声调拼音转换为所有可能的声调变体列表

        例如: qu -> ['qū', 'qú', 'qǔ', 'qù', 'qu']
        例如: lv -> ['lǖ', 'lǘ', 'lǚ', 'lǜ', 'lü'] (v 自动转 ü)
        例如: nv -> ['nǖ', 'nǘ', 'nǚ', 'nǜ', 'nü']
        """
        # 元音到声调变体的映射
        tone_map = {
            'a': ['ā', 'á', 'ǎ', 'à', 'a'],
            'e': ['ē', 'é', 'ě', 'è', 'e'],
            'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
            'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
            'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
            'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
        }

        pinyin = pinyin.lower()

        # 预处理：将 v 替换为 ü（常见输入习惯）
        pinyin = pinyin.replace('v', 'ü')

        # 找到拼音中需要加声调的元音位置
        # 声调规则：有 a/e 则在 a/e 上，有 ou 则在 o 上，否则在后面的元音上
        main_vowel_idx = -1
        for i, char in enumerate(pinyin):
            if char in 'ae':
                main_vowel_idx = i
                break
            elif char == 'o' and i + 1 < len(pinyin) and pinyin[i + 1] == 'u':
                main_vowel_idx = i
                break

        if main_vowel_idx == -1:
            # 找最后一个元音
            for i in range(len(pinyin) - 1, -1, -1):
                if pinyin[i] in 'iouü':
                    main_vowel_idx = i
                    break

        if main_vowel_idx == -1:
            # 没有元音，返回原样
            return [pinyin]

        # 生成所有声调变体
        main_vowel = pinyin[main_vowel_idx]
        if main_vowel not in tone_map:
            return [pinyin]

        variants = []
        for toned_vowel in tone_map[main_vowel]:
            variant = pinyin[:main_vowel_idx] + toned_vowel + pinyin[main_vowel_idx + 1:]
            variants.append(variant)

        return variants
