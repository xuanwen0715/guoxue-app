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


def _json_response(status: int, payload: dict):
    """Create JSON response for Vercel"""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "no-store"
        },
        "body": json.dumps(payload, ensure_ascii=False)
    }


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


def handler(request):
    """Main Vercel handler function"""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return _json_response(204, {})

    if request.method != 'POST':
        return _json_response(405, {"error": "Method not allowed"})

    try:
        # Get request body
        if hasattr(request, 'get_json'):
            body = request.get_json()
        else:
            import json
            body_str = request.body.decode('utf-8') if hasattr(request, 'body') else ''
            body = json.loads(body_str)

        if not DASHSCOPE_API_KEY:
            return _json_response(503, {"error": "API key not configured"})

        image_url = body.get("image_url", "").strip()
        if not image_url:
            return _json_response(400, {"error": "Missing image_url field"})

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        }

        payload = {
            "model": "qwen-vl-max",
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"image": image_url},
                            {"text": "请识别图像中的中文文字，准确提取所有汉字、标点符号和数字。要求：1）保持原有的换行和段落格式；2）不要添加任何解释或说明；3）只输出识别到的文字内容。"}
                        ]
                    }
                ]
            }
        }

        resp = requests.post(DASHSCOPE_VL_URL, headers=headers, json=payload, timeout=45)
        resp.raise_for_status()
        data = resp.json()
        text = _extract_text_from_msg(data)

        return _json_response(200, {"text": text.strip()})

    except requests.HTTPError as http_err:
        detail = ""
        if hasattr(http_err, 'response') and http_err.response:
            try:
                detail = http_err.response.text
            except Exception:
                pass
        return _json_response(502, {"error": str(http_err), "detail": detail})
    except Exception as e:
        return _json_response(500, {"error": str(e), "trace": traceback.format_exc()})


# Keep backward compatibility with local development
class OCRHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8"))

            # Create mock request object
            mock_request = type('MockRequest', (), {
                'method': 'POST',
                'get_json': lambda: body,
                'body': body_bytes
            })()

            # Call Vercel handler
            response = handler(mock_request)

            # Send response
            self.send_response(response['statusCode'])
            for key, value in response['headers'].items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(response['body'].encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            error_response = json.dumps({"error": str(e)})
            self.wfile.write(error_response.encode('utf-8'))