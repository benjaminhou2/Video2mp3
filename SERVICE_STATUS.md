# 🎵 Video2Voice 服务状态

## ✅ 服务已成功启动

**访问地址**: http://localhost:5001

**状态**: 运行中

**端口**: 5001

## 📋 使用说明

1. **打开浏览器**，访问：http://localhost:5001

2. **输入 YouTube 视频 URL**，例如：
   - https://www.youtube.com/watch?v=uyiII_Q3voM
   - https://youtu.be/uyiII_Q3voM

3. **（可选）指定文件名**，如果不指定则使用视频标题

4. **点击"开始下载"**，等待下载完成

5. **下载的文件**保存在：`/Users/ben/Desktop/vedio2voice/downloads/`

## 🛑 停止服务

在运行服务的终端中按 `Ctrl + C`

或者使用命令：
```bash
lsof -ti:5001 | xargs kill -9
```

## 🔧 重启服务

```bash
cd /Users/ben/Desktop/vedio2voice
python3 run.py
```

## ✅ SSL 证书问题已解决

所有 SSL 证书相关的配置已经完成，可以正常下载 YouTube 视频。

