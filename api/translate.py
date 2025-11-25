import os
import json
import sys
from http.server import BaseHTTPRequestHandler

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")

class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler"""

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
            "python_version": sys.version
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
            # 导入 requests（延迟导入以便调试）
            import requests

            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            # 尝试多种编码解码
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

            if not term:
                self._send_json(400, {"error": "Missing field: word"})
                return

            # 调用阿里云 DashScope API
            DASHSCOPE_TXT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
            DEFAULT_TEXT_MODEL = os.environ.get("DASHSCOPE_TEXT_MODEL", "qwen-max")

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            }

            user_prompt = self._build_prompt(context, term, use_ocr)
            payload = {
                "model": DEFAULT_TEXT_MODEL,
                "input": {
                    "messages": [
                        {"role": "system", "content": [{"text": "你是严谨的国学学者。"}]},
                        {"role": "user", "content": [{"text": user_prompt}]},
                    ]
                },
            }

            resp = requests.post(DASHSCOPE_TXT_URL, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            text = self._extract_text_from_msg(data)

            # 尝试解析 JSON
            structured = None
            try:
                structured = json.loads(text)
            except:
                pass

            if isinstance(structured, dict):
                self._normalize_response(structured)
                self._send_json(200, structured)
            else:
                self._send_json(200, {"text": text or ""})

        except Exception as e:
            import traceback
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _build_prompt(self, context, term, use_ocr):
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
            '  "evolution_zh": "字形演变",\n'
            '  "evolution_en": "Evolution"\n'
            "}\n"
            "只输出 JSON，不要其他内容。"
        )
        ctx_note = "（OCR识别）" if use_ocr else ""
        return f"{instructions}\n\n查询: {term}\n上下文{ctx_note}: {context[:1500]}"

    def _extract_text_from_msg(self, resp_json):
        try:
            content = resp_json["output"]["choices"][0]["message"]["content"]
            if isinstance(content, list):
                return "".join(p.get("text", "") for p in content if isinstance(p, dict))
            return content or ""
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
