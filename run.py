#!/usr/bin/env python3
"""
Launcher script – loads .env then starts the local API/static server.
Prefers api_server.py; if it fails to import, falls back to server.py.
"""

import os
from pathlib import Path


def load_dotenv(env_file: str = '.env') -> bool:
    path = Path(env_file)
    if not path.exists():
        return False
    for line in path.read_text(encoding='utf-8').splitlines():
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if '=' in s:
            k, v = s.split('=', 1)
            k = k.strip()
            v = v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            os.environ[k] = v
    return True


if __name__ == '__main__':
    import sys
    import codecs

    # Windows console: force UTF-8 output to avoid mojibake
    if sys.platform == 'win32':
        try:
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
        except Exception:
            pass

    if load_dotenv():
        print('已加载 .env 文件中的配置')
    else:
        print('未找到 .env 文件，使用系统环境变量')

    print('启动本地服务中...', flush=True)
    try:
        from api_server import main as _main
    except Exception as e:
        print(f'api_server.py 加载失败，回退到 server.py: {e}', flush=True)
        from server import main as _main
    _main()

