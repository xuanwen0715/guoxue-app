"""
请求日志中间件
记录每个 API 请求的详细信息
"""
import time
import json
from datetime import datetime


class RequestLogger:
    """请求日志记录器"""
    
    def __init__(self):
        self.logger = None
        try:
            import logging
            self.logger = logging.getLogger("guoxue-api")
            if not self.logger.handlers:
                self.logger.setLevel(logging.INFO)
                handler = logging.StreamHandler()
                handler.setFormatter(logging.Formatter(
                    '%(asctime)s - %(levelname)s - %(message)s'
                ))
                self.logger.addHandler(handler)
        except Exception:
            pass
    
    def log_request(self, method: str, path: str, params: dict = None, 
                    body: dict = None, status: int = None, 
                    duration_ms: float = None, error: str = None):
        """记录请求信息"""
        log_data = {
            "time": datetime.now().isoformat(),
            "method": method,
            "path": path,
            "status": status,
            "duration_ms": duration_ms,
        }
        
        if params:
            log_data["params"] = params
        if body and not error:  # 不记录敏感body
            # 脱敏处理
            safe_body = {k: "***" if "key" in k.lower() else v 
                        for k, v in body.items() if v}
            log_data["body"] = safe_body
        if error:
            log_data["error"] = str(error)[:200]
        
        log_msg = json.dumps(log_data, ensure_ascii=False)
        
        if self.logger:
            if status and status >= 500:
                self.logger.error(log_msg)
            elif status and status >= 400:
                self.logger.warning(log_msg)
            else:
                self.logger.info(log_msg)
        else:
            print(log_msg)


# 全局实例
request_logger = RequestLogger()


def log_api_call(func):
    """装饰器：自动记录 API 调用"""
    def wrapper(request, *args, **kwargs):
        start_time = time.time()
        status = None
        error = None
        
        try:
            result = func(request, *args, **kwargs)
            
            # 尝试获取状态码
            if isinstance(result, tuple) and len(result) >= 2:
                status = result[1] if isinstance(result[1], int) else 200
            else:
                status = 200
            
            return result
            
        except Exception as e:
            status = 500
            error = e
            raise
        
        finally:
            duration_ms = (time.time() - start_time) * 1000
            path = getattr(request, 'path', '/api/unknown')
            method = getattr(request, 'command', 'POST')
            
            request_logger.log_request(
                method=method,
                path=path,
                status=status,
                duration_ms=duration_ms,
                error=error
            )
    
    return wrapper
