#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试服务是否正常运行"""
import urllib.request
import sys

try:
    print("正在测试服务连接...")
    response = urllib.request.urlopen('http://localhost:5000', timeout=5)
    print(f"✅ 服务正常运行！")
    print(f"   状态码: {response.getcode()}")
    print(f"   内容长度: {len(response.read())} 字节")
    print(f"\n🌐 请在浏览器中访问: http://localhost:5000")
    sys.exit(0)
except urllib.error.HTTPError as e:
    print(f"⚠️  HTTP 错误: {e.code} - {e.reason}")
    if e.code == 403:
        print("   这可能意味着服务在运行但被阻止")
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"❌ 无法连接到服务: {e.reason}")
    print("   请确保服务已启动: python3 app.py")
    sys.exit(1)
except Exception as e:
    print(f"❌ 错误: {e}")
    sys.exit(1)

