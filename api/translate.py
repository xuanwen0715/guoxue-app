import os
import json
import sys
from http.server import BaseHTTPRequestHandler

# 导入认证工具
from .auth_utils import (
    verify_token, check_user_quota, deduct_credit,
    AuthError, QuotaError
)

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def lookup_dictionary(term):
    """
    查询字典数据库获取字符/词语的基础信息
    返回字典数据或 None
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None

    try:
        import requests

        # 提取第一个汉字进行查询
        char = term[0] if term else ""
        if not char:
            return None

        # 查询 dictionary 表
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }

        # 尝试精确匹配简体或繁体
        url = f"{SUPABASE_URL}/rest/v1/dictionary?or=(char.eq.{char},traditional.eq.{char})&limit=1"
        resp = requests.get(url, headers=headers, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return data[0]

        return None
    except Exception as e:
        print(f"Dictionary lookup error: {e}")
        return None


def lookup_idiom(term):
    """
    查询成语数据库
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None

    try:
        import requests

        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }

        # 查询 idioms 表
        url = f"{SUPABASE_URL}/rest/v1/idioms?word=eq.{term}&limit=1"
        resp = requests.get(url, headers=headers, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return data[0]

        return None
    except Exception as e:
        print(f"Idiom lookup error: {e}")
        return None


def lookup_word(term):
    """
    查询词语数据库
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None

    try:
        import requests

        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }

        # 查询 words 表
        url = f"{SUPABASE_URL}/rest/v1/words?word=eq.{term}&limit=1"
        resp = requests.get(url, headers=headers, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                return data[0]

        return None
    except Exception as e:
        print(f"Word lookup error: {e}")
        return None


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler with authentication"""

    def do_GET(self):
        """Handle GET requests for debugging"""
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        response = {
            "status": "ok",
            "message": "Translate API is working. Use POST to query.",
            "has_api_key": bool(DASHSCOPE_API_KEY),
            "python_version": sys.version,
            "auth_required": True
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            import requests

            # ========== 第一步：检查"门票"（验证 Token） ==========
            auth_header = self.headers.get("Authorization", "")
            try:
                user_info = verify_token(auth_header)
                user_id = user_info["user_id"]
            except AuthError as e:
                self._send_json(e.code, {"error": e.message, "code": "AUTH_ERROR"})
                return

            # ========== 第二步：检查"余额"（用户额度） ==========
            try:
                quota_info = check_user_quota(user_id)
            except QuotaError as e:
                self._send_json(e.code, {"error": e.message, "code": "QUOTA_EXCEEDED"})
                return

            # ========== 开始处理业务逻辑 ==========
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body_str = ""
            if body_bytes:
                for encoding in ["utf-8", "latin-1", "gbk"]:
                    try:
                        body_str = body_bytes.decode(encoding)
                        break
                    except:
                        continue
            body = json.loads(body_str) if body_str else {}

            if not DASHSCOPE_API_KEY:
                self._send_json(503, {"error": "API key not configured"})
                return

            context = body.get("context", "").strip()
            term = body.get("word", "").strip()
            use_ocr = body.get("use_ocr", False)
            stream = body.get("stream", False)

            if not term:
                self._send_json(400, {"error": "Missing field: word"})
                return

            # ========== 新增：先查询字典数据库 ==========
            dict_data = None
            idiom_data = None
            word_data = None

            # 根据查询词长度决定查询策略
            if len(term) == 1:
                # 单字查询
                dict_data = lookup_dictionary(term)
            elif len(term) == 4:
                # 可能是成语
                idiom_data = lookup_idiom(term)
                if not idiom_data:
                    word_data = lookup_word(term)
                    if not word_data:
                        dict_data = lookup_dictionary(term)
            else:
                # 词语查询
                word_data = lookup_word(term)
                if not word_data:
                    dict_data = lookup_dictionary(term)

            DASHSCOPE_TXT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
            DEFAULT_TEXT_MODEL = os.environ.get("DASHSCOPE_TEXT_MODEL", "qwen-max")

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            }

            # 构建包含字典数据的提示词
            user_prompt = self._build_prompt_with_dict(context, term, use_ocr, dict_data, idiom_data, word_data)

            if stream:
                # 流式输出模式
                headers["Accept"] = "text/event-stream"
                payload = {
                    "model": DEFAULT_TEXT_MODEL,
                    "input": {
                        "messages": [
                            {"role": "system", "content": [{"text": "你是严谨的国学学者。你必须严格基于提供的字典数据进行解析，不要编造或猜测字符信息。如果字典数据中有明确的释义，必须以此为准。"}]},
                            {"role": "user", "content": [{"text": user_prompt}]},
                        ]
                    },
                    "parameters": {
                        "incremental_output": True
                    }
                }

                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_headers()

                full_text = ""
                api_success = False
                try:
                    resp = requests.post(DASHSCOPE_TXT_URL, headers=headers, json=payload, timeout=120, stream=True)
                    resp.raise_for_status()

                    for line in resp.iter_lines():
                        if line:
                            line_str = line.decode('utf-8')
                            if line_str.startswith('data:'):
                                data_str = line_str[5:].strip()
                                if data_str:
                                    try:
                                        chunk_data = json.loads(data_str)
                                        chunk_text = self._extract_text_from_msg(chunk_data)
                                        if chunk_text:
                                            full_text += chunk_text
                                            # 发送增量文本
                                            event_data = json.dumps({"chunk": chunk_text, "full": full_text}, ensure_ascii=False)
                                            self.wfile.write(f"data: {event_data}\n\n".encode('utf-8'))
                                            self.wfile.flush()
                                    except json.JSONDecodeError:
                                        pass

                    # 发送完成事件，尝试解析完整 JSON
                    structured = None
                    try:
                        structured = json.loads(full_text)
                        if isinstance(structured, dict):
                            self._normalize_response(structured)
                            # 确保使用字典数据中的准确信息
                            self._merge_dict_data(structured, dict_data, idiom_data, word_data, term)
                    except:
                        structured = {"text": full_text}

                    done_data = json.dumps({"done": True, "result": structured}, ensure_ascii=False)
                    self.wfile.write(f"data: {done_data}\n\n".encode('utf-8'))
                    self.wfile.flush()
                    api_success = True

                except Exception as e:
                    error_data = json.dumps({"error": str(e)}, ensure_ascii=False)
                    self.wfile.write(f"data: {error_data}\n\n".encode('utf-8'))
                    self.wfile.flush()

                # ========== 第三步：扣除积分（仅在 API 调用成功后） ==========
                if api_success and quota_info.get("should_deduct"):
                    deduct_credit(user_id)

            else:
                # 非流式模式（保持原有逻辑）
                payload = {
                    "model": DEFAULT_TEXT_MODEL,
                    "input": {
                        "messages": [
                            {"role": "system", "content": [{"text": "你是严谨的国学学者。你必须严格基于提供的字典数据进行解析，不要编造或猜测字符信息。如果字典数据中有明确的释义，必须以此为准。"}]},
                            {"role": "user", "content": [{"text": user_prompt}]},
                        ]
                    },
                }

                resp = requests.post(DASHSCOPE_TXT_URL, headers=headers, json=payload, timeout=60)
                resp.raise_for_status()
                data = resp.json()

                if not data:
                    self._send_json(200, {"debug": "API returned empty", "raw": str(data)})
                    return

                text = self._extract_text_from_msg(data)

                if not text:
                    self._send_json(200, {"debug": "extract failed", "raw_response": data})
                    return

                structured = None
                try:
                    structured = json.loads(text)
                except:
                    pass

                # ========== 第三步：扣除积分（仅在 API 调用成功后） ==========
                if quota_info.get("should_deduct"):
                    deduct_credit(user_id)

                if isinstance(structured, dict):
                    self._normalize_response(structured)
                    # 确保使用字典数据中的准确信息
                    self._merge_dict_data(structured, dict_data, idiom_data, word_data, term)
                    # 添加用户配额信息到响应
                    structured["_quota"] = {
                        "is_premium": quota_info.get("is_premium", False),
                        "credits_remaining": quota_info.get("credits_remaining", 0) - (1 if quota_info.get("should_deduct") else 0)
                    }
                    self._send_json(200, structured)
                else:
                    self._send_json(200, {"text": text})

        except Exception as e:
            import traceback
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _build_prompt_with_dict(self, context, term, use_ocr, dict_data, idiom_data, word_data):
        """构建包含字典数据的提示词"""

        # 基础指令
        instructions = (
            "根据上下文和提供的字典数据，对查询字/词进行国学角度解析。\n"
            "【重要】你必须严格使用提供的字典数据中的信息，不要编造或猜测。\n"
            "如果字典数据中有明确的拼音、部首、笔画、释义等信息，必须原样使用。\n\n"
            "输出 JSON 格式：\n"
            "{\n"
            '  "term": "查询字/词（必须与用户输入完全一致）",\n'
            '  "pinyin": "拼音（使用字典数据）",\n'
            '  "traditional": "繁体（使用字典数据，如果同简体则填'同简体'）",\n'
            '  "radical": "部首（使用字典数据）",\n'
            '  "strokes": 笔画数（使用字典数据）,\n'
            '  "explanation_zh": "国学释义（基于字典数据扩展）",\n'
            '  "explanation_en": "English explanation",\n'
            '  "sources_zh": ["出处1", "出处2"],\n'
            '  "sources_en": ["Source1", "Source2"],\n'
            '  "examples_zh": ["例句1", "例句2"],\n'
            '  "examples_en": ["Example1", "Example2"],\n'
            '  "variants": ["异体字1"],\n'
            '  "evolution_zh": "字形演变描述",\n'
            '  "evolution_en": "Evolution description",\n'
            '  "glyph_oracle": "甲骨文字形描述（如有）",\n'
            '  "glyph_bronze": "金文字形描述（如有）",\n'
            '  "glyph_seal": "小篆字形描述（如有）"\n'
            "}\n"
            "只输出 JSON，不要其他内容。\n\n"
        )

        # 添加字典数据作为参考
        dict_reference = ""
        if dict_data:
            dict_reference = (
                "【字典数据 - 必须使用以下信息】\n"
                f"字符: {dict_data.get('char', term)}\n"
                f"拼音: {dict_data.get('pinyin', '未知')}\n"
                f"繁体: {dict_data.get('traditional', '同简体')}\n"
                f"部首: {dict_data.get('radical', '未知')}\n"
                f"笔画: {dict_data.get('total_strokes', '未知')}\n"
                f"释义: {dict_data.get('explanation', '无')}\n"
            )
            if dict_data.get('variants'):
                dict_reference += f"异体字: {dict_data.get('variants')}\n"
            if dict_data.get('glyph_oracle'):
                dict_reference += f"甲骨文: {dict_data.get('glyph_oracle')}\n"
            if dict_data.get('glyph_bronze'):
                dict_reference += f"金文: {dict_data.get('glyph_bronze')}\n"
            if dict_data.get('glyph_seal'):
                dict_reference += f"小篆: {dict_data.get('glyph_seal')}\n"
            dict_reference += "\n"

        if idiom_data:
            dict_reference = (
                "【成语数据 - 必须使用以下信息】\n"
                f"成语: {idiom_data.get('word', term)}\n"
                f"拼音: {idiom_data.get('pinyin', '未知')}\n"
                f"释义: {idiom_data.get('explanation', '无')}\n"
                f"出处: {idiom_data.get('derivation', '无')}\n\n"
            )

        if word_data:
            dict_reference = (
                "【词语数据 - 必须使用以下信息】\n"
                f"词语: {word_data.get('word', term)}\n"
                f"释义: {word_data.get('explanation', '无')}\n\n"
            )

        if not dict_reference:
            dict_reference = "【注意】字典中未找到该字/词的数据，请谨慎解析，如不确定请明确说明。\n\n"

        ctx_note = "（OCR识别）" if use_ocr else ""
        return f"{instructions}{dict_reference}查询: {term}\n上下文{ctx_note}: {context[:1500] if context else '无'}"

    def _merge_dict_data(self, structured, dict_data, idiom_data, word_data, term):
        """将字典数据合并到AI响应中，确保准确性"""

        # 确保 term 正确
        structured["term"] = term

        if dict_data:
            # 使用字典数据覆盖AI可能错误的信息
            if dict_data.get('pinyin'):
                structured["pinyin"] = dict_data["pinyin"]
            if dict_data.get('traditional'):
                structured["traditional"] = dict_data["traditional"] if dict_data["traditional"] != dict_data.get('char') else "同简体"
            if dict_data.get('radical'):
                structured["radical"] = dict_data["radical"]
            if dict_data.get('total_strokes'):
                structured["strokes"] = dict_data["total_strokes"]
            if dict_data.get('variants'):
                variants = dict_data["variants"]
                if isinstance(variants, str):
                    try:
                        variants = json.loads(variants)
                    except:
                        variants = [variants] if variants else []
                structured["variants"] = variants
            # 字形数据
            if dict_data.get('glyph_oracle'):
                structured["glyph_oracle"] = dict_data["glyph_oracle"]
            if dict_data.get('glyph_bronze'):
                structured["glyph_bronze"] = dict_data["glyph_bronze"]
            if dict_data.get('glyph_seal'):
                structured["glyph_seal"] = dict_data["glyph_seal"]

        if idiom_data:
            structured["term"] = idiom_data.get("word", term)
            if idiom_data.get('pinyin'):
                structured["pinyin"] = idiom_data["pinyin"]

        if word_data:
            structured["term"] = word_data.get("word", term)

    def _build_prompt(self, context, term, use_ocr):
        """原有的提示词构建方法（保留兼容）"""
        instructions = (
            "根据上下文，对查询字/词进行国学角度解析，输出 JSON 格式：\n"
            "{\n"
            '  "term": "查询字/词",\n'
            '  "pinyin": "拼音",\n'
            '  "traditional": "繁体",\n'
            '  "radical": "部首",\n'
            '  "strokes": 笔画数,\n'
            '  "explanation_zh": "国学释义",\n'
            '  "explanation_en": "English explanation",\n'
            '  "sources_zh": ["出处1", "出处2"],\n'
            '  "sources_en": ["Source1", "Source2"],\n'
            '  "examples_zh": ["例句1", "例句2"],\n'
            '  "examples_en": ["Example1", "Example2"],\n'
            '  "variants": ["异体字1"],\n'
            '  "evolution_zh": "字形演变描述（从甲骨文到楷书的演变过程）",\n'
            '  "evolution_en": "Evolution description",\n'
            '  "glyph_oracle": "甲骨文字形描述（如有）",\n'
            '  "glyph_bronze": "金文字形描述（如有）",\n'
            '  "glyph_seal": "小篆字形描述（如有）"\n'
            "}\n"
            "只输出 JSON，不要其他内容。"
        )
        ctx_note = "（OCR识别）" if use_ocr else ""
        return f"{instructions}\n\n查询: {term}\n上下文{ctx_note}: {context[:1500]}"

    def _extract_text_from_msg(self, resp_json):
        try:
            output = resp_json.get("output", {})
            if "text" in output:
                return output["text"] or ""
            if "choices" in output:
                content = output["choices"][0]["message"]["content"]
                if isinstance(content, list):
                    return "".join(p.get("text", "") for p in content if isinstance(p, dict))
                return content or ""
            return ""
        except:
            return ""

    def _normalize_response(self, structured):
        for k in ["sources_zh", "sources_en", "examples_zh", "examples_en", "variants"]:
            if k in structured and not isinstance(structured[k], list):
                structured[k] = [structured[k]] if structured[k] else []
        for k in ["pinyin", "traditional", "radical", "evolution_zh", "evolution_en"]:
            if k in structured and structured[k] is None:
                structured[k] = ""
        if "strokes" in structured:
            try:
                structured["strokes"] = int(structured["strokes"])
            except:
                pass

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
