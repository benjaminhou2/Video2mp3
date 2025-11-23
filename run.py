#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video2Voice 服务启动脚本
直接运行此文件即可启动服务
"""
import sys
import os
import io

# 设置标准输出编码为UTF-8（解决Windows控制台编码问题）
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 切换到脚本所在目录
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 导入并运行 Flask 应用
if __name__ == '__main__':
    try:
        from app import app
        print("=" * 60)
        print("Video2Voice 服务启动中...")
        print("=" * 60)
        print(f"下载目录: {os.path.abspath('downloads')}")
        print(f"请在浏览器中访问: http://localhost:5001")
        print("=" * 60)
        print("\n按 Ctrl+C 停止服务\n")
        
        # 启动服务
        app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=False)
    except KeyboardInterrupt:
        print("\n\n服务已停止")
    except Exception as e:
        print(f"\n启动失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

