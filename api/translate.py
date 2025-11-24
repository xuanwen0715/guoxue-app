import os
import json
import traceback
from http.server import BaseHTTPRequestHandler
import requests


DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_TXT_URL = os.environ.get(
    "DASHSCOPE_TXT_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
)
DEFAULT_TEXT_MODEL = os.environ.get("DASHSCOPE_TEXT_MODEL", "qwen-max")


def _json(self: BaseHTTPRequestHandler, status: int, payload: dict):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(body)


def _extract_text_from_msg(resp_json: dict) -> str:
    try:
        content = resp_json["output"]["choices"][0]["message"]["content"]
        if isinstance(content, list):
            texts = []
            for part in content:
                if isinstance(part, dict) and "text" in part and isinstance(part["text"], str):
                    texts.append(part["text"]) 
            return "\n".join(texts).strip()
        if isinstance(content, str):
            return content.strip()
    except Exception:
        pass
    return ""


def _build_prompt(context: str, term: str, use_ocr: bool) -> str:
    """Build a strict bilingual, structured JSON prompt with [b] emphasis tags."""
    instructions = (
        "你是一位严谨的国学学者与中英双语讲解者。\n"
        "请基于用户提供的古文上下文和查询字/词，返回一个严格的 JSON 对象（仅输出 JSON，不要额外内容）。\n"
        "请使用 [b]...[/b] 标签标注重点词语或关键短语，加粗强调，但不要使用 Markdown **。\n"
        "字段要求如下：\n"
        "- term: 字/词原文\n"
        "- pinyin: 汉语拼音\n"
        "- traditional: 繁体字（若同形，写同形）\n"
        "- radical: 部首（如：心）\n"
        "- strokes: 笔画数（阿拉伯数字）\n"
        "- variants: 异体字列表（数组，可为空）\n"
        "- explanation_zh: 简洁中文释义，可分义项用 1. 2. 3. 标序，并对关键处用 [b]加粗[/b]\n"
        "- explanation_en: 清晰英文释义，必要处用 [b]加粗[/b]\n"
        "- sources_zh: 2-4 条中文出处或参考（数组，每条可含书名·篇目·节选，可 [b]加粗[/b]关键词）\n"
        "- sources_en: 2-4 条英文描述的参考（数组，可为书名翻译或英译说明）\n"
        "- examples_zh: 2-4 条中文例句（可含简短说明，必要处 [b]加粗[/b]关键词）\n"
        "- examples_en: 2-4 条英文例句或英译（必要处 [b]加粗[/b]关键词）\n"
        "- evolution_zh: 字形演变（中文简述，可含甲骨/金文/篆/隶等关键词，关键处 [b]加粗[/b]）\n"
        "- evolution_en: Evolution in English (brief)\n"
        "若上下文不足以判断，请给出常见释义并在 sources_zh 中注明“通释”。\n"
        "注意：只输出 JSON，不要任何多余说明或标点。"
    )
    ctx_note = "（OCR识别：是）" if use_ocr else ""
    return (
        f"{instructions}\n\n"
        f"查询字/词: {term}\n"
        f"上下文{ctx_note}:\n{context.strip()[:2000]}\n"
    )


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            if not DASHSCOPE_API_KEY:
                return _json(self, 500, {"error": "DASHSCOPE_API_KEY not set"})

            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length)
            try:
                # Try UTF-8 first, then fallback to other encodings
                body = json.loads(raw.decode("utf-8")) if raw else {}
            except UnicodeDecodeError:
                try:
                    body = json.loads(raw.decode("gbk")) if raw else {}
                except UnicodeDecodeError:
                    body = json.loads(raw.decode("latin-1")) if raw else {}
            context = (body.get("context") or "").strip()
            term = (body.get("word") or "").strip()
            use_ocr = bool(body.get("useOcrResult"))

            if not term:
                return _json(self, 400, {"error": "Missing field: word"})

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
                        structured["strokes"] = int(structured["strokes"])  # may raise
                    except Exception:
                        pass
                return _json(self, 200, structured)
            else:
                return _json(self, 200, {"text": text or ""})

        except requests.HTTPError as http_err:
            return _json(self, 502, {"error": str(http_err), "detail": getattr(http_err, "response", None).text if getattr(http_err, "response", None) else ""})
        except Exception as e:
            return _json(self, 500, {"error": str(e), "trace": traceback.format_exc()})
