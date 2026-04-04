"""
安全增强模块
生产环境安全配置
"""
import os
import sys
import traceback


# ====== 生产环境配置 ======
def is_production() -> bool:
    """判断是否为生产环境"""
    env = os.environ.get("VERCEL", "").lower()
    return env == "true" or env == "1"


def get_error_detail_level() -> str:
    """获取错误详情级别: full, simple, none"""
    if is_production():
        return "simple"  # 生产环境只显示简单错误
    return "full"  # 开发环境显示完整堆栈


def safe_error_response(error: Exception, show_trace: bool = None) -> dict:
    """
    安全错误响应
    生产环境不泄露敏感信息
    """
    if show_trace is None:
        show_trace = not is_production()
    
    error_info = {
        "error": str(error)[:200],  # 限制长度
    }
    
    if show_trace:
        error_info["trace"] = traceback.format_exc()[:500]
    
    return error_info


# ====== 请求超时配置 ======
DEFAULT_TIMEOUT = {
    "connect": 5,    # 连接超时
    "read": 30,      # 读取超时 (OCR)
    "write": 30,     # 写入超时
}

OCR_TIMEOUT = 30
TRANSLATE_TIMEOUT = 45
