import os
import json
import traceback
import requests
from http.server import BaseHTTPRequestHandler


DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_TXT_URL = os.environ.get(
    "DASHSCOPE_TXT_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
)
DEFAULT_TEXT_MODEL = os.environ.get("DASHSCOPE_TEXT_MODEL", "qwen-max")


def _extract_text_from_msg(resp_json: dict) -> str:
    try:
        content = resp_json["output"]["choices"][0]["message"]["content"]
        if isinstance(content, list):
            texts = []
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    texts.append(part["text"])
            return "".join(texts)
        return content or ""
    except (KeyError, IndexError, TypeError):
        return ""


def _build_prompt(context: str, term: str, use_ocr: bool = False) -> str:
    instructions = (
        "根据上下文，对查询字/词进行国学角度解析，输出 JSON 格式：\n"
        "{\n"
        '  "term": "查询字/词",\n'
        '  "pinyin": "拼音",\n'
        '  "traditional": "繁体（如有）",\n'
        '  "radical": "部首",\n'
        '  "strokes": 笔画数,\n'
        '  "explanation_zh": "国学释义（中文，关键词 [b]加粗[/b]）",\n'
        '  "explanation_en": "Brief explanation in English",\n'
        '  "sources_zh": ["出处1", "出处2"],\n'
        '  "sources_en": ["Source1", "Source2"],\n'
        '  "examples_zh": ["例句1（关键词 [b]加粗[/b]）", "例句2"],\n'
        '  "examples_en": ["Example1 (bold keywords)", "Example2"],\n'
        '  "variants": ["异体字/同义词1", "异体字/同义词2"],\n'
        '  "evolution_zh": "字形演变简述（关键处 [b]加粗[/b]）",\n'
        '  "evolution_en": "Evolution in English"\n'
        "}\n"
        "要求：\n"
        "- explanation_zh: 结合上下文的国学释义，突出文化内涵\n"
        "- sources_zh: 2-4 个经典出处（如《诗经》《论语》等）\n"
        "- examples_zh: 2-4 个典型例句（必要处 [b]加粗[/b]关键词）\n"
        "- examples_en: 2-4 条英文例句或英译（必要处 [b]加粗[/b]关键词）\n"
        "- evolution_zh: 字形演变（中文简述，可含甲骨/金文/篆/隶等关键词，关键处 [b]加粗[/b]）\n"
        "- evolution_en: Evolution in English (brief)\n"
        "若上下文不足以判断，请给出常见释义并在 sources_zh 中注明"通释"。\n"
        "注意：只输出 JSON，不要任何多余说明或标点。"
    )
    ctx_note = "（OCR识别：是）" if use_ocr else ""
    return (
        f"{instructions}\n\n"
        f"查询字/词: {term}\n"
        f"上下文{ctx_note}:\n{context.strip()[:2000]}\n"
    )


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler using BaseHTTPRequestHandler"""

    def do_GET(self):
        """Handle GET requests for debugging"""
        self._send_json(200, {
            "status": "ok",
            "message": "Translate API is working. Use POST to query.",
            "has_api_key": bool(DASHSCOPE_API_KEY)
        })

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

            if not DASHSCOPE_API_KEY:
                self._send_json(503, {"error": "API key not configured"})
                return

            context = body.get("context", "").strip()
            term = body.get("word", "").strip()
            use_ocr = body.get("use_ocr", False)

            if not term:
                self._send_json(400, {"error": "Missing field: word"})
                return

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            }
            user_prompt = _build_prompt(context, term, use_ocr)
            payload = {
                "model": DEFAULT_TEXT_MODEL,
                "input": {
                    "messages": [
                        {"role": "system", "content": [{"text": "你是严谨的国学学者。"}]},
                        {"role": "user", "content": [{"text": user_prompt}]},
                    ]
                },
            }

            resp = requests.post(DASHSCOPE_TXT_URL, headers=headers, json=payload, timeout=45)
            resp.raise_for_status()
            data = resp.json()
            text = _extract_text_from_msg(data)

            # Try parse as JSON structure per instruction; otherwise fallback
            structured = None
            try:
                structured = json.loads(text)
            except Exception:
                pass

            # Normalize keys for frontend rendering
            if isinstance(structured, dict):
                # ensure arrays
                for k in ["sources_zh", "sources_en", "examples_zh", "examples_en", "variants"]:
                    if k in structured and not isinstance(structured[k], list):
                        structured[k] = [structured[k]] if structured[k] else []
                # Backward compat fields if model didn't follow exactly
                if "explanation" in structured and "explanation_zh" not in structured:
                    structured["explanation_zh"] = structured.pop("explanation")
                # Normalize simple fields to string types
                for k in ["pinyin", "traditional", "radical", "evolution_zh", "evolution_en"]:
                    if k in structured and structured[k] is None:
                        structured[k] = ""
                # Coerce strokes to int if numeric
                if "strokes" in structured:
                    try:
                        structured["strokes"] = int(structured["strokes"])
                    except Exception:
                        pass
                self._send_json(200, structured)
            else:
                self._send_json(200, {"text": text or ""})

        except requests.HTTPError as http_err:
            detail = ""
            if hasattr(http_err, 'response') and http_err.response:
                try:
                    detail = http_err.response.text
                except Exception:
                    pass
            self._send_json(502, {"error": str(http_err), "detail": detail})
        except Exception as e:
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _send_json(self, status: int, payload: dict):
        """Send JSON response with proper headers"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        response_body = json.dumps(payload, ensure_ascii=False)
        self.wfile.write(response_body.encode("utf-8"))
