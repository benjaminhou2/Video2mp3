# -*- coding: utf-8 -*-
"""
Video2Voice - YouTube 视频转音频 Web 应用
主程序文件 - Flask 后端服务
"""

# Disable SSL certificate verification at Python level
import ssl
import os
import certifi

# 彻底禁用 SSL 证书验证（解决 macOS SSL 证书问题）
# 必须在导入任何网络库之前设置
ssl._create_default_https_context = ssl._create_unverified_context

# 设置环境变量禁用 SSL 验证
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''

# 尝试设置证书路径（如果 certifi 可用）
try:
    cert_path = certifi.where()
    os.environ['SSL_CERT_FILE'] = cert_path
    os.environ['REQUESTS_CA_BUNDLE'] = cert_path
except:
    pass

import json
import threading
import urllib.parse
from pathlib import Path
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

# 在导入 yt-dlp 之前，确保 SSL 验证已禁用
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 禁用 requests 的 SSL 验证和警告
import requests
requests.packages.urllib3.disable_warnings()

import yt_dlp

# 尝试自动检测 ffmpeg 路径
FFMPEG_PATH = None
try:
    # 方法1: 尝试使用 imageio-ffmpeg（如果已安装）
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"检测到 ffmpeg: {FFMPEG_PATH}")
except ImportError:
    pass
except Exception as e:
    print(f"使用 imageio-ffmpeg 检测 ffmpeg 失败: {e}")

# 如果 imageio-ffmpeg 不可用，尝试从系统 PATH 查找
if not FFMPEG_PATH:
    import shutil
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        FFMPEG_PATH = ffmpeg_path
        print(f"从系统 PATH 检测到 ffmpeg: {FFMPEG_PATH}")

# 创建 Flask 应用实例
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置下载目录
DOWNLOAD_DIR = Path(__file__).parent / 'downloads'
DOWNLOAD_DIR.mkdir(exist_ok=True)  # 如果目录不存在则创建

# MP3 文件存储目录
MP3_DIR = DOWNLOAD_DIR / 'mp3'
MP3_DIR.mkdir(exist_ok=True)  # 如果目录不存在则创建

# 全局任务状态字典，用于存储每个任务的进度信息
tasks_status = {}
tasks_lock = threading.Lock()  # 线程锁，保证任务状态更新的线程安全


def progress_hook(d, task_id):
    """
    下载进度回调函数
    会在下载过程中被 yt-dlp 调用，更新任务状态
    
    Args:
        d: yt-dlp 传递的进度信息字典
        task_id: 任务 ID
    """
    import time
    from datetime import datetime
    
    with tasks_lock:
        if d['status'] == 'downloading':
            # 正在下载，更新进度信息
            percent = d.get('_percent_str', '0%')
            speed = d.get('_speed_str', 'N/A')
            eta = d.get('_eta_str', 'N/A')
            
            # 获取下载大小信息
            downloaded_bytes = d.get('downloaded_bytes', 0)
            total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            
            # 格式化大小
            downloaded_str = format_size(downloaded_bytes) if downloaded_bytes > 0 else '0 B'
            total_str = format_size(total_bytes) if total_bytes > 0 else '未知'
            
            # 计算已用时间
            start_time = tasks_status[task_id].get('start_time', time.time())
            elapsed_time = time.time() - start_time
            elapsed_str = format_time(elapsed_time)
            
            # 格式化速度
            speed_str = format_speed(speed) if speed != 'N/A' else 'N/A'
            
            # 格式化剩余时间
            eta_str = format_eta(eta) if eta != 'N/A' else '计算中...'
            
            # 解析进度百分比（安全处理各种格式）
            try:
                if '%' in percent:
                    percent_str = percent.replace('%', '').strip()
                    progress_percent = int(float(percent_str))
                else:
                    progress_percent = 0
            except (ValueError, AttributeError):
                progress_percent = 0
            
            tasks_status[task_id]['status'] = 'downloading'
            tasks_status[task_id]['progress'] = percent
            tasks_status[task_id]['progress_percent'] = progress_percent
            tasks_status[task_id]['speed'] = speed_str
            tasks_status[task_id]['speed_raw'] = speed
            tasks_status[task_id]['eta'] = eta_str
            tasks_status[task_id]['downloaded_bytes'] = downloaded_bytes
            tasks_status[task_id]['downloaded_str'] = downloaded_str
            tasks_status[task_id]['total_bytes'] = total_bytes
            tasks_status[task_id]['total_str'] = total_str
            tasks_status[task_id]['elapsed_time'] = elapsed_time
            tasks_status[task_id]['elapsed_str'] = elapsed_str
            
        elif d['status'] == 'finished':
            # 下载完成，正在进行后处理（转换格式）
            tasks_status[task_id]['status'] = 'converting'
            tasks_status[task_id]['progress'] = '100%'
            tasks_status[task_id]['progress_percent'] = 100
            tasks_status[task_id]['message'] = '正在转换为 MP3 格式...'


def download_audio(url, filename, task_id):
    """
    下载视频并提取音频的主函数
    在独立线程中执行，不会阻塞主线程
    
    Args:
        url: YouTube 视频 URL
        filename: 保存的文件名（不含扩展名）
        task_id: 任务 ID
    """
    try:
        # 如果用户没有指定文件名，使用默认值
        if not filename:
            filename = '%(title)s'  # yt-dlp 会自动替换为视频标题
        
        # 设置 yt-dlp 的下载选项
        ydl_opts = {
            'format': 'bestaudio/best',  # 选择最佳音频质量
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',  # 使用 FFmpeg 提取音频
                'preferredcodec': 'mp3',       # 转换为 MP3 格式
                'preferredquality': '192',     # 音频比特率 192kbps
            }],
            # 如果检测到 ffmpeg 路径，则指定路径
            **({'ffmpeg_location': FFMPEG_PATH} if FFMPEG_PATH else {}),
            'outtmpl': str(MP3_DIR / f'{filename}.%(ext)s'),  # 输出文件模板（保存到 mp3 目录）
            'progress_hooks': [lambda d: progress_hook(d, task_id)],  # 进度回调
            'quiet': False,  # 显示详细信息
            'no_warnings': False,
            # SSL 证书相关配置（彻底禁用 SSL 验证）
            'nocheckcertificate': True,  # 禁用 SSL 证书验证（yt-dlp 主要选项）
            'no_check_certificate': True,  # 兼容性选项
            'verifyssl': False,  # 禁用 SSL 验证
            'no_check_ssl_certificate': True,  # 另一个 SSL 禁用选项
            'prefer_insecure': True,  # 优先使用不安全的连接
            # HTTP 请求头配置
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            },
            # 网络相关配置
            'socket_timeout': 30,
            'extractor_retries': 3,
            'fragment_retries': 3,
            'retries': 3,
            # YouTube 特定配置
            'geo_bypass': True,
            'youtube_include_dash_manifest': False,
            'youtube_include_hls_manifest': False,
            'ignore_no_formats_error': True,
        }
        
        # 更新任务状态为开始下载
        with tasks_lock:
            tasks_status[task_id]['status'] = 'starting'
            tasks_status[task_id]['message'] = '正在获取视频信息...'
        
        # 执行下载
        # 在创建 YoutubeDL 对象之前，再次确保 SSL 验证已禁用
        import ssl
        
        # 保存原始上下文
        original_context = ssl._create_default_https_context
        
        # 创建不验证SSL的上下文并设置为默认
        unverified_context = ssl._create_unverified_context()
        ssl._create_default_https_context = lambda: unverified_context
        
        try:
            # 创建 YoutubeDL 对象并执行下载
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 先获取视频信息
                info = ydl.extract_info(url, download=False)
                video_title = info.get('title', 'Unknown')
                
                with tasks_lock:
                    tasks_status[task_id]['title'] = video_title
                    tasks_status[task_id]['message'] = f'开始下载: {video_title}'
                
                # 开始下载和转换
                ydl.download([url])
        finally:
            # 恢复原始的 SSL 上下文
            ssl._create_default_https_context = original_context
        
        # 任务完成
        import time
        with tasks_lock:
            start_time = tasks_status[task_id].get('start_time', time.time())
            total_time = time.time() - start_time
            
            tasks_status[task_id]['status'] = 'completed'
            tasks_status[task_id]['progress'] = '100%'
            tasks_status[task_id]['progress_percent'] = 100
            tasks_status[task_id]['message'] = '✅ 下载完成！'
            tasks_status[task_id]['elapsed_time'] = total_time
            tasks_status[task_id]['elapsed_str'] = format_time(total_time)
            tasks_status[task_id]['completed_time'] = time.time()
            
    except Exception as e:
        # 发生错误，记录错误信息
        with tasks_lock:
            tasks_status[task_id]['status'] = 'error'
            tasks_status[task_id]['message'] = f'❌ 错误: {str(e)}'


@app.route('/')
def index():
    """
    主页路由
    返回 index.html 页面
    """
    return render_template('index.html')


@app.route('/api/download', methods=['POST'])
def start_download():
    """
    开始下载任务的 API 接口
    接收前端发送的任务列表，为每个任务创建独立线程执行下载
    
    Returns:
        JSON 响应，包含任务 ID 列表
    """
    try:
        # 获取前端发送的 JSON 数据
        data = request.get_json()
        tasks = data.get('tasks', [])
        
        if not tasks:
            return jsonify({'error': '没有提供任务'}), 400
        
        task_ids = []
        
        # 为每个任务创建线程并启动
        for task in tasks:
            url = task.get('url', '').strip()
            filename = task.get('filename', '').strip()
            
            if not url:
                continue
            
            # 生成唯一的任务 ID
            task_id = f"task_{len(tasks_status) + 1}"
            task_ids.append(task_id)
            
            # 初始化任务状态
            import time
            with tasks_lock:
                tasks_status[task_id] = {
                    'url': url,
                    'filename': filename,
                    'status': 'pending',
                    'progress': '0%',
                    'progress_percent': 0,
                    'speed': 'N/A',
                    'speed_raw': 'N/A',
                    'eta': 'N/A',
                    'message': '等待开始...',
                    'title': '',
                    'start_time': time.time(),
                    'downloaded_bytes': 0,
                    'downloaded_str': '0 B',
                    'total_bytes': 0,
                    'total_str': '未知',
                    'elapsed_time': 0,
                    'elapsed_str': '0秒'
                }
            
            # 创建并启动下载线程
            thread = threading.Thread(
                target=download_audio,
                args=(url, filename, task_id),
                daemon=True  # 守护线程，主程序退出时自动结束
            )
            thread.start()
        
        return jsonify({
            'success': True,
            'task_ids': task_ids,
            'message': f'已启动 {len(task_ids)} 个下载任务'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    """
    获取所有任务状态的 API 接口
    前端会定期调用此接口更新显示
    
    Returns:
        JSON 响应，包含所有任务的当前状态
    """
    with tasks_lock:
        return jsonify(tasks_status)


@app.route('/api/clear', methods=['POST'])
def clear_tasks():
    """
    清除已完成的任务记录
    
    Returns:
        JSON 响应，确认清除操作
    """
    with tasks_lock:
        # 只保留正在进行中的任务
        global tasks_status
        tasks_status = {
            k: v for k, v in tasks_status.items() 
            if v['status'] in ['pending', 'starting', 'downloading', 'converting']
        }
    
    return jsonify({'success': True, 'message': '已清除完成的任务'})


@app.route('/api/files', methods=['GET'])
def get_files():
    """
    获取已下载的 MP3 文件列表
    
    Returns:
        JSON 响应，包含文件列表和详细信息
    """
    try:
        import time
        from datetime import datetime
        
        files = []
        
        # 遍历 mp3 目录中的所有文件
        if MP3_DIR.exists():
            for file_path in MP3_DIR.iterdir():
                if file_path.is_file() and file_path.suffix.lower() == '.mp3':
                    stat = file_path.stat()
                    
                    # 获取文件大小（格式化）
                    size = stat.st_size
                    size_str = format_size(size)
                    
                    # 获取文件修改时间
                    mtime = datetime.fromtimestamp(stat.st_mtime)
                    mtime_str = mtime.strftime('%Y-%m-%d %H:%M:%S')
                    
                    files.append({
                        'name': file_path.name,
                        'size': size,
                        'size_str': size_str,
                        'modified': mtime_str,
                        'modified_timestamp': stat.st_mtime,
                        'path': str(file_path.relative_to(Path(__file__).parent)),
                        'url': f'/api/audio/{urllib.parse.quote(file_path.name)}'  # URL 编码文件名
                    })
        
        # 按修改时间倒序排列（最新的在前）
        files.sort(key=lambda x: x['modified_timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': files,
            'count': len(files)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/audio/<filename>')
def serve_audio(filename):
    """
    提供音频文件访问（支持 HTTP Range 请求）
    
    Args:
        filename: 音频文件名
    
    Returns:
        音频文件响应（支持流式播放）
    """
    try:
        from flask import Response, request
        
        # 安全检查：确保文件名不包含路径分隔符
        if '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        # URL 解码文件名（处理中文文件名）
        filename = urllib.parse.unquote(filename)
        
        # 构建文件路径
        file_path = MP3_DIR / filename
        
        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            return jsonify({'error': 'File not found'}), 404
        
        # 检查文件扩展名
        if file_path.suffix.lower() != '.mp3':
            return jsonify({'error': 'Invalid file type'}), 400
        
        # 获取文件大小
        file_size = file_path.stat().st_size
        
        # 获取 Range 请求头
        range_header = request.headers.get('Range', None)
        
        if range_header:
            # 解析 Range 请求
            # 格式通常是: "bytes=start-end"
            byte_start = 0
            byte_end = file_size - 1
            
            try:
                # 提取范围
                range_match = range_header.replace('bytes=', '').split('-')
                if range_match[0]:
                    byte_start = int(range_match[0])
                if range_match[1]:
                    byte_end = int(range_match[1])
                else:
                    byte_end = file_size - 1
                
                # 确保范围有效
                if byte_start >= file_size:
                    return Response('Range Not Satisfiable', status=416, headers={
                        'Content-Range': f'bytes */{file_size}'
                    })
                
                if byte_end >= file_size:
                    byte_end = file_size - 1
                
                content_length = byte_end - byte_start + 1
                
                # 读取文件片段
                with open(file_path, 'rb') as f:
                    f.seek(byte_start)
                    data = f.read(content_length)
                
                # 返回 206 Partial Content
                response = Response(
                    data,
                    status=206,
                    mimetype='audio/mpeg',
                    headers={
                        'Content-Range': f'bytes {byte_start}-{byte_end}/{file_size}',
                        'Accept-Ranges': 'bytes',
                        'Content-Length': str(content_length),
                        'Content-Type': 'audio/mpeg',
                        'Cache-Control': 'public, max-age=3600',
                    }
                )
                return response
                
            except (ValueError, IndexError):
                # Range 请求格式错误，返回完整文件
                pass
        
        # 没有 Range 请求或解析失败，返回完整文件
        def generate():
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)  # 8KB chunks
                    if not chunk:
                        break
                    yield chunk
        
        response = Response(
            generate(),
            status=200,
            mimetype='audio/mpeg',
            headers={
                'Content-Length': str(file_size),
                'Accept-Ranges': 'bytes',
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
            }
        )
        return response
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def format_size(size_bytes):
    """
    格式化文件大小
    
    Args:
        size_bytes: 文件大小（字节）
    
    Returns:
        格式化后的字符串（如 "1.5 MB"）
    """
    if size_bytes == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    size = float(size_bytes)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.2f} {units[unit_index]}"


def format_speed(speed_str):
    """
    格式化下载速度
    
    Args:
        speed_str: 速度字符串（如 "2.5MiB/s"）
    
    Returns:
        格式化后的字符串（如 "2.5 MB/s"）
    """
    if speed_str == 'N/A' or not speed_str:
        return 'N/A'
    
    # yt-dlp 返回的速度格式可能是 "2.5MiB/s" 或 "2.5 MB/s"
    # 统一转换为 "MB/s" 格式
    try:
        # 移除空格和单位，提取数字
        import re
        match = re.search(r'([\d.]+)', speed_str)
        if match:
            num = float(match.group(1))
            # 如果包含 MiB 或 MB，保持原样；否则假设是 MB/s
            if 'MiB' in speed_str or 'MB' in speed_str:
                return speed_str.replace('MiB', 'MB')
            return f"{num:.2f} MB/s"
    except:
        pass
    
    return speed_str


def format_time(seconds):
    """
    格式化时间（秒）
    
    Args:
        seconds: 秒数
    
    Returns:
        格式化后的字符串（如 "1分30秒"）
    """
    if seconds < 60:
        return f"{int(seconds)}秒"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}分{secs}秒"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours}小时{minutes}分{secs}秒"


def format_eta(eta_str):
    """
    格式化剩余时间
    
    Args:
        eta_str: ETA 字符串（如 "00:02:30"）
    
    Returns:
        格式化后的字符串（如 "剩余2分30秒"）
    """
    if eta_str == 'N/A' or not eta_str:
        return '计算中...'
    
    # yt-dlp 返回的格式可能是 "00:02:30" 或 "2:30"
    try:
        parts = eta_str.split(':')
        if len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            if hours > 0:
                return f"剩余{hours}小时{minutes}分{seconds}秒"
            elif minutes > 0:
                return f"剩余{minutes}分{seconds}秒"
            else:
                return f"剩余{seconds}秒"
        elif len(parts) == 2:
            minutes, seconds = map(int, parts)
            return f"剩余{minutes}分{seconds}秒"
    except:
        pass
    
    return f"剩余{eta_str}"


if __name__ == '__main__':
    """
    程序入口
    启动 Flask 开发服务器
    """
    print("=" * 60)
    print("🎵 Video2Voice 服务启动中...")
    print("=" * 60)
    print(f"📁 下载目录: {DOWNLOAD_DIR.absolute()}")
    print(f"🌐 请在浏览器中访问: http://localhost:5001")
    print("=" * 60)
    
    # 启动 Flask 服务器
    # debug=True: 开启调试模式，代码修改后自动重启
    # host='0.0.0.0': 允许局域网内其他设备访问
    # port=5001: 使用 5001 端口（避免与 5000 端口冲突）
    app.run(debug=True, host='0.0.0.0', port=5001)

