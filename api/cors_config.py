"""
CORS 配置
支持多源访问配置
"""
import os


# 允许的源列表（可配置多个）
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", 
    "*"  # 默认允许所有
).split(",")


def get_cors_headers(origin: str = None) -> dict:
    """获取 CORS 响应头"""
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",  # 24小时
    }
    
    # 如果配置了具体源，则严格匹配
    if "*" not in ALLOWED_ORIGINS:
        if origin and origin in ALLOWED_ORIGINS:
            headers["Access-Control-Allow-Origin"] = origin
    else:
        # 允许所有
        headers["Access-Control-Allow-Origin"] = "*"
    
    return headers


def cors_handler(handler_class):
    """装饰器：为 Handler 添加 CORS 支持"""
    original_do_OPTIONS = handler_class.do_OPTIONS
    
    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        cors_headers = get_cors_headers(origin)
        self.send_response(204)
        for key, value in cors_headers.items():
            self.send_header(key, value)
        self.end_headers()
    
    handler_class.do_OPTIONS = do_OPTIONS
    return handler_class
