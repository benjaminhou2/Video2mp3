# SSL 证书问题 - 最终解决方案

## 问题描述
```
ERROR: [youtube] uyiII_Q3voM: Unable to download API page: 
[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: 
unable to get local issuer certificate
```

## 已实施的完整解决方案

### 1. Python 级别的 SSL 禁用（在文件开头）
```python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

### 2. 环境变量设置
```python
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
```

### 3. urllib3 警告禁用
```python
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
```

### 4. yt-dlp 配置选项
```python
ydl_opts = {
    'nocheckcertificate': True,
    'no_check_certificate': True,
    'verifyssl': False,
    ...
}
```

### 5. 在下载函数中再次确保 SSL 禁用
```python
# 在创建 YoutubeDL 对象之前
import ssl
original_context = ssl._create_default_https_context
ssl._create_default_https_context = ssl._create_unverified_context

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        # 执行下载
        ...
finally:
    ssl._create_default_https_context = original_context
```

## 测试步骤

1. **重启服务**（如果服务正在运行）：
   ```bash
   # 停止旧服务
   lsof -ti:5001 | xargs kill -9
   
   # 启动新服务
   python3 run.py
   ```

2. **在浏览器中访问**：
   ```
   http://localhost:5001
   ```

3. **测试下载**：
   - 输入 URL: `https://www.youtube.com/watch?v=uyiII_Q3voM`
   - 点击"开始下载"

## 如果问题仍然存在

如果 SSL 错误仍然出现，可能需要：

1. **更新 yt-dlp**：
   ```bash
   pip3 install --upgrade yt-dlp
   ```

2. **安装 Python SSL 证书**（macOS）：
   ```bash
   /Applications/Python\ 3.11/Install\ Certificates.command
   ```

3. **检查 Python 版本**：
   确保使用的是系统 Python，而不是 Homebrew Python

4. **使用虚拟环境**（推荐）：
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python3 run.py
   ```

## 注意事项

⚠️ **安全提示**：禁用 SSL 证书验证会降低安全性，但这是解决 macOS Python SSL 证书问题的常见方法。在生产环境中，应该正确配置 SSL 证书。

