"""
公共工具函数
包含：重试机制、日志记录、输入验证
"""
import os
import time
import json
import logging
import functools
from typing import Any, Callable, Optional

# 配置日志
def setup_logger(name: str = "guoxue-app") -> logging.Logger:
    """获取日志记录器"""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        logger.addHandler(handler)
    return logger

logger = setup_logger()


# ====== 重试机制 ======
def retry_on_failure(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """
    重试装饰器
    max_retries: 最大重试次数
    delay: 初始延迟（秒）
    backoff: 延迟倍增
    exceptions: 需要重试的异常类型
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"{func.__name__} 失败 (尝试 {attempt + 1}/{max_retries + 1}): {e}，"
                            f"{current_delay:.1f}秒后重试..."
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(f"{func.__name__} 重试 {max_retries} 次后仍失败: {e}")
            
            raise last_exception
        
        return wrapper
    return decorator


# ====== 输入验证 ======
def validate_required(params: dict, required_fields: list) -> Optional[str]:
    """
    验证必填参数
    返回错误消息或 None（通过验证）
    """
    missing = [field for field in required_fields if not params.get(field)]
    if missing:
        return f"缺少必填参数: {', '.join(missing)}"
    return None


def validate_string_length(value: str, min_len: int = 0, max_len: int = 1000) -> Optional[str]:
    """验证字符串长度"""
    if not isinstance(value, str):
        return "参数必须是字符串"
    if len(value) < min_len:
        return f"字符串长度不能少于 {min_len} 个字符"
    if len(value) > max_len:
        return f"字符串长度不能超过 {max_len} 个字符"
    return None


def validate_image_data(data: str) -> Optional[str]:
    """验证图片数据格式"""
    if not data:
        return "图片数据不能为空"
    # 支持 base64 和 URL
    if data.startswith("data:image"):
        return None
    if data.startswith("http://") or data.startswith("https://"):
        return None
    return "图片数据必须是 base64 编码或 URL"


# ====== 通用响应 ======
def success_response(data: Any = None, message: str = "成功") -> dict:
    """成功响应"""
    result = {"success": True, "message": message}
    if data is not None:
        result["data"] = data
    return result


def error_response(message: str, code: int = 400, detail: str = None) -> dict:
    """错误响应"""
    result = {"success": False, "error": message, "code": code}
    if detail:
        result["detail"] = detail
    return result


# ====== 环境变量检查 ======
def check_required_env_vars(required: list) -> list:
    """检查必要的环境变量，返回缺失的列表"""
    missing = [var for var in required if not os.environ.get(var)]
    return missing
