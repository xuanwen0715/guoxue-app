"""
健康检查接口
"""
import os
import sys
from datetime import datetime


def handler(request):
    """健康检查端点"""
    # 检查环境变量
    missing_envs = []
    if not os.environ.get("DASHSCOPE_API_KEY"):
        missing_envs.append("DASHSCOPE_API_KEY")
    
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "guoxue-app-api",
        "python_version": sys.version.split()[0],
        "environment": "production" if os.environ.get("VERCEL") else "development",
        "env_status": "configured" if not missing_envs else f"missing: {', '.join(missing_envs)}"
    }
