"""
简单的速率限制中间件
基于内存实现，生产环境建议用 Redis
"""
import time
from collections import defaultdict
from functools import wraps


# 简单内存存储（每个请求重置后丢失，适合开发/小规模）
_rate_limits = defaultdict(lambda: {"count": 0, "reset_time": 0})

# 配置
RATE_LIMIT_REQUESTS = 30  # 每分钟最大请求数
RATE_LIMIT_WINDOW = 60   # 时间窗口（秒）


def check_rate_limit(identifier, limit=RATE_LIMIT_REQUESTS, window=RATE_LIMIT_WINDOW):
    """检查速率限制
    identifier: 客户端标识（IP或用户ID）
    返回: (allowed, remaining, reset_time)
    """
    now = time.time()
    key = str(identifier)
    
    # 检查是否需要重置窗口
    if now > _rate_limits[key]["reset_time"]:
        _rate_limits[key] = {"count": 0, "reset_time": now + window}
    
    current = _rate_limits[key]["count"]
    reset_time = _rate_limits[key]["reset_time"]
    
    if current >= limit:
        return False, 0, reset_time
    
    _rate_limits[key]["count"] = current + 1
    return True, limit - current - 1, reset_time


def rate_limit(limit=RATE_LIMIT_REQUESTS, window=RATE_LIMIT_WINDOW, key_func=None):
    """装饰器：为 API 添加速率限制
    key_func: 获取客户端标识的函数，默认从 request 获取 IP
    """
    def decorator(func):
        @wraps(func)
        def handler(request):
            # 获取客户端标识
            if key_func:
                identifier = key_func(request)
            else:
                # 默认取 IP
                identifier = request.headers.get('X-Forwarded-For', 
                             request.headers.get('X-Real-IP',
                             request.client.host if request.client else 'unknown'))
            
            allowed, remaining, reset_time = check_rate_limit(identifier, limit, window)
            
            if not allowed:
                return {
                    "error": "请求过于频繁，请稍后再试",
                    "retry_after": int(reset_time - time.time())
                }, 429
            
            # 调用原函数
            result = func(request)
            
            # 添加速率限制头
            if hasattr(result, '__setitem__'):
                result["X-RateLimit-Limit"] = str(limit)
                result["X-RateLimit-Remaining"] = str(remaining)
                result["X-RateLimit-Reset"] = str(int(reset_time))
            
            return result
        
        return handler
    return decorator
