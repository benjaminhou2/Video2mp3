#!/bin/bash
# Video2Voice 启动脚本

echo "=========================================="
echo "🎵 Video2Voice 启动脚本"
echo "=========================================="
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3，请先安装 Python"
    exit 1
fi

# 检查是否已安装依赖
if ! python3 -c "import flask" &> /dev/null; then
    echo "📦 正在安装依赖包..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败，请检查网络连接或手动运行: pip3 install -r requirements.txt"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo ""
fi

# 检查 ffmpeg 是否安装
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  警告: 未找到 ffmpeg"
    echo "   请先安装 ffmpeg:"
    echo "   macOS: brew install ffmpeg"
    echo "   Linux: sudo apt-get install ffmpeg"
    echo "   Windows: 请从 https://ffmpeg.org/download.html 下载"
    echo ""
    read -p "是否继续启动? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 启动服务
echo "🚀 启动服务中..."
echo ""
python3 app.py

