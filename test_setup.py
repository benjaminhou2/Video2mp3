#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速测试脚本 - 检查服务是否能正常启动
"""
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("正在导入模块...")
    from flask import Flask
    from flask_cors import CORS
    import yt_dlp
    print("✅ 所有模块导入成功")
    
    print("\n正在检查 Flask 应用...")
    from app import app
    print("✅ Flask 应用创建成功")
    
    print("\n正在检查模板文件...")
    template_path = os.path.join(os.path.dirname(__file__), 'templates', 'index.html')
    if os.path.exists(template_path):
        print("✅ 模板文件存在")
    else:
        print(f"❌ 模板文件不存在: {template_path}")
    
    print("\n正在检查静态文件...")
    css_path = os.path.join(os.path.dirname(__file__), 'static', 'css', 'style.css')
    js_path = os.path.join(os.path.dirname(__file__), 'static', 'js', 'main.js')
    if os.path.exists(css_path) and os.path.exists(js_path):
        print("✅ 静态文件存在")
    else:
        print(f"❌ 静态文件缺失")
    
    print("\n" + "="*60)
    print("🎵 所有检查通过！服务可以正常启动")
    print("="*60)
    print("\n请在另一个终端运行以下命令启动服务：")
    print("  python3 app.py")
    print("\n然后访问: http://localhost:5000")
    print("="*60)
    
except ImportError as e:
    print(f"❌ 导入错误: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

