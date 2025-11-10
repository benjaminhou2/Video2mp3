# Video2Voice - YouTube 视频转音频工具

## 项目简介
这是一个简单易用的 Web 应用，可以从 YouTube 下载视频并提取音频，保存为 MP3 格式。

## 功能特点
- 🎵 从 YouTube 视频提取音频并转换为 MP3 格式
- 🚀 支持同时处理多个视频任务
- 💻 简洁美观的 Web 界面（Apple 风格设计）
- 📊 实时显示下载进度和任务状态
- 📁 自动管理下载文件
- 🎧 在线播放音频文件
- 🔔 完成通知功能（浏览器通知 + 页面提示）
- 📈 详细的下载统计信息（速度、大小、时间等）

## 项目结构
```
vedio2voice/
├── README.md              # 项目说明文档
├── requirements.txt       # Python 依赖包列表
├── app.py                # Flask 后端主程序
├── run.py                # 简化的启动脚本
├── start.sh              # Shell 启动脚本
├── templates/            # HTML 模板目录
│   └── index.html       # 主页面
├── static/              # 静态资源目录
│   ├── css/
│   │   └── style.css   # 样式文件
│   └── js/
│       └── main.js     # 前端脚本
└── downloads/           # 音频文件下载目录（自动创建）
    └── mp3/             # MP3 文件存储目录
```

## 安装步骤

### 1. 安装 Python 依赖
```bash
pip install -r requirements.txt
```

### 2. 安装 ffmpeg（音频处理必需）
**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
下载 ffmpeg 并添加到系统 PATH

**Linux:**
```bash
sudo apt-get install ffmpeg
```

## 使用方法

### 1. 启动服务
```bash
python3 run.py
```
或者
```bash
chmod +x start.sh
./start.sh
```

### 2. 打开浏览器
访问：http://localhost:5001

### 3. 使用界面
- 输入 YouTube 视频 URL
- 指定音频文件名（可选，默认使用视频标题）
- 点击"添加任务"按钮
- 可以继续添加更多任务
- 点击"开始下载"执行所有任务
- 在"已下载的音频文件"区域可以播放音频

## 技术栈
- **后端**: Python Flask
- **视频下载**: yt-dlp
- **前端**: HTML5 + CSS3 + JavaScript
- **音频处理**: ffmpeg
- **HTTP Range 支持**: 流式音频播放

## 功能亮点

### 下载功能
- 多任务并发下载
- 实时进度显示（百分比、速度、剩余时间）
- 详细的统计信息
- 错误处理和重试机制

### 播放功能
- 在线播放 MP3 文件
- HTTP Range 请求支持（流式播放）
- 播放状态保存和恢复
- 播放进度记忆

### UI/UX
- Apple 风格设计
- 响应式布局
- 动画效果
- 完成通知

## 注意事项
- 请确保网络连接稳定
- 下载速度取决于视频大小和网络状况
- 所有音频文件保存在 `downloads/mp3/` 目录中
- 请遵守 YouTube 服务条款，仅下载有权使用的内容
- macOS 用户可能需要处理 SSL 证书问题（已内置解决方案）

## 更新日志
- v1.0.0 (2025-11-08): 初始版本发布
- v1.1.0 (2025-11-09): 
  - 添加音频播放功能
  - 优化进度显示
  - 添加完成通知
  - HTTP Range 请求支持
  - UI/UX 优化
