"""
健康检查接口
"""
import json
from datetime import datetime


def handler(request):
    """健康检查端点"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "guoxue-app-api"
    }
