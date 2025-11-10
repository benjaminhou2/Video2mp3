# SSL 证书问题解决方案

## 问题分析

**错误信息**：
```
ERROR: [youtube] uyiII_Q3voM: Unable to download API page: [SSL: CERTIFICATE_VERIFY_FAILED] 
certificate verify failed: unable to get local issuer certificate
```

**原因**：
- macOS 上的 Python 可能没有正确配置 SSL 证书
- yt-dlp 在验证 YouTube SSL 证书时失败

## 已实施的解决方案

### 1. Python 级别的 SSL 配置
在 `app.py` 文件开头添加了：
```python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

### 2. 环境变量配置
设置了证书文件路径：
```python
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
```

### 3. yt-dlp 配置优化
在下载选项中添加了：
- `'nocheckcertificate': True` - 禁用 SSL 证书验证
- `'no_check_certificate': True` - 兼容性选项
- 优化的 HTTP 请求头
- 增加重试次数和超时时间

## 测试方法

1. 启动服务：
   ```bash
   python3 run.py
   ```

2. 在浏览器中访问：http://localhost:5000

3. 输入视频 URL：https://youtu.be/uyiII_Q3voM?si=xemKxhcwIsJJ5-sr

4. 点击"开始下载"测试

## 如果问题仍然存在

如果 SSL 问题仍然出现，可以尝试：

1. **更新 yt-dlp**：
   ```bash
   pip3 install --upgrade yt-dlp
   ```

2. **安装 Python 证书**（macOS）：
   ```bash
   /Applications/Python\ 3.11/Install\ Certificates.command
   ```

3. **使用系统 Python**：
   确保使用系统自带的 Python，而不是 Homebrew 的 Python

