import os
import json
import traceback
from http.server import BaseHTTPRequestHandler
import requests


DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_VL_URL = os.environ.get(
    "DASHSCOPE_VL_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)


def _json(self: BaseHTTPRequestHandler, status: int, payload: dict):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(body)


def _extract_text_from_vl(resp_json: dict) -> str:
    try:
        # Expected: data['output']['choices'][0]['message']['content'] could be list or string
        content = resp_json["output"]["choices"][0]["message"]["content"]
        if isinstance(content, list):
            texts = []
            for part in content:
                if isinstance(part, dict) and "text" in part and isinstance(part["text"], str):
                    texts.append(part["text"]) 
            return "".join(texts).strip()
        if isinstance(content, str):
            return content.strip()
    except Exception:
        pass
    return ""


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Minimal CORS/preflight (same-origin by default on Vercel, but harmless)
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
            image_base64 = body.get("image")
            if not image_base64:
                return _json(self, 400, {"error": "Missing field: image"})

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            }
            payload = {
                "model": os.environ.get("DASHSCOPE_VL_MODEL", "qwen-vl-max"),
                "input": {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"image": image_base64},
                                {"text": "请识别这张图片中的所有汉字，只返回汉字，不要任何多余的标点或解释。"},
                            ],
                        }
                    ]
                },
            }

            resp = requests.post(DASHSCOPE_VL_URL, headers=headers, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            extracted = _extract_text_from_vl(data)
            if not extracted:
                return _json(self, 502, {"error": "Empty OCR result", "raw": data})

            return _json(self, 200, {"text": extracted})

        except requests.HTTPError as http_err:
            return _json(self, 502, {"error": str(http_err), "detail": getattr(http_err, "response", None).text if getattr(http_err, "response", None) else ""})
        except Exception as e:
            # Log traceback to ease debugging on Vercel
            return _json(self, 500, {"error": str(e), "trace": traceback.format_exc()})

