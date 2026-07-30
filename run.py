#!/usr/bin/env python3
"""街霸6赛程管理后台 - 启动入口"""
import webbrowser
import threading
import time
from app import app

def open_browser():
    """延迟打开浏览器"""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

if __name__ == '__main__':
    print("=" * 50)
    print("  街霸6赛程管理后台")
    print("  访问地址: http://127.0.0.1:5000")
    print("=" * 50)
    # 在新线程中打开浏览器
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=False, host='127.0.0.1', port=5000)
