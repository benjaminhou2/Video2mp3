/**
 * Video2Voice 前端脚本
 * 处理用户交互和与后端的通信
 */

// 全局变量
let taskCount = 1; // 任务计数器
let statusUpdateInterval = null; // 状态更新定时器
let filesUpdateInterval = null; // 文件列表更新定时器

// 跟踪已完成的任务（用于通知）
let completedTasks = new Set();

// 音频播放器相关
let currentAudioPlayer = null; // 当前播放的音频播放器
let currentPlayingFile = null; // 当前播放的文件名

    // 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 请求通知权限
    requestNotificationPermission();
    
    // 加载文件列表
    loadFiles();
    
    // 定期更新文件列表（每2秒，实现实时展示）
    filesUpdateInterval = setInterval(loadFiles, 2000);
});

/**
 * 请求浏览器通知权限
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * 检查已完成的任务并发送通知
 */
function checkCompletedTasks(tasks) {
    Object.entries(tasks).forEach(([taskId, task]) => {
        if (task.status === 'completed' && !completedTasks.has(taskId)) {
            completedTasks.add(taskId);
            showCompletionNotification(task);
        }
    });
}

/**
 * 显示完成通知
 */
function showCompletionNotification(task) {
    const title = task.title || '下载完成';
    const message = `文件已成功下载并转换为 MP3 格式`;
    
    // 浏览器桌面通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/static/favicon.ico', // 如果有图标
            tag: task.url, // 防止重复通知
            requireInteraction: false
        });
    }
    
    // 页面内提示（可选）
    showToastNotification(title, message, 'success');
}

/**
 * 显示页面内提示
 */
function showToastNotification(title, message, type = 'info') {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // 添加到页面
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const container = document.querySelector('.toast-container');
    container.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * 添加新的任务输入框
 */
function addTask() {
    taskCount++;
    const taskList = document.getElementById('taskList');
    
    // 创建新的任务项 HTML
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <div class="input-group">
            <label>视频 URL</label>
            <input type="text" 
                   class="input url-input" 
                   placeholder="https://www.youtube.com/watch?v=..." 
                   required>
        </div>
        <div class="input-group">
            <label>文件名（可选）</label>
            <input type="text" 
                   class="input filename-input" 
                   placeholder="留空则使用视频标题">
        </div>
        <button class="btn-remove" onclick="removeTask(this)">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>
    `;
    
    taskList.appendChild(taskItem);
    
    // 显示第一个任务的删除按钮（如果有多个任务）
    updateRemoveButtons();
}

/**
 * 移除任务输入框
 * @param {HTMLElement} button - 被点击的删除按钮
 */
function removeTask(button) {
    const taskItem = button.closest('.task-item');
    taskItem.style.animation = 'fadeOut 0.3s ease';
    
    setTimeout(() => {
        taskItem.remove();
        taskCount--;
        updateRemoveButtons();
    }, 300);
}

/**
 * 更新删除按钮的显示状态
 * 只有当有多个任务时才显示删除按钮
 */
function updateRemoveButtons() {
    const taskItems = document.querySelectorAll('.task-item');
    const removeButtons = document.querySelectorAll('.btn-remove');
    
    if (taskItems.length > 1) {
        removeButtons.forEach(btn => btn.style.display = 'flex');
    } else {
        removeButtons.forEach(btn => btn.style.display = 'none');
    }
}

/**
 * 开始下载任务
 * 收集所有输入的 URL 和文件名，发送到后端
 */
async function startDownload() {
    // 收集所有任务
    const taskItems = document.querySelectorAll('.task-item');
    const tasks = [];
    
    taskItems.forEach(item => {
        const url = item.querySelector('.url-input').value.trim();
        const filename = item.querySelector('.filename-input').value.trim();
        
        if (url) {
            tasks.push({ url, filename });
        }
    });
    
    // 验证是否有任务
    if (tasks.length === 0) {
        alert('请至少输入一个视频 URL！');
        return;
    }
    
    // 验证 URL 格式
    const invalidUrls = tasks.filter(task => !isValidYouTubeUrl(task.url));
    if (invalidUrls.length > 0) {
        alert('请输入有效的 YouTube 视频链接！');
        return;
    }
    
    try {
        // 发送请求到后端
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tasks })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 显示进度区域
            document.getElementById('progressSection').style.display = 'block';
            
            // 开始定期更新状态
            startStatusUpdate();
            
            // 刷新文件列表（下载完成后会自动更新）
            setTimeout(loadFiles, 2000);
            
            // 可选：清空输入框
            // clearInputs();
        } else {
            alert('启动下载失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        alert('连接服务器失败：' + error.message);
        console.error('Error:', error);
    }
}

/**
 * 验证 YouTube URL 是否有效
 * @param {string} url - 要验证的 URL
 * @returns {boolean} 是否有效
 */
function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

/**
 * 开始定期更新任务状态
 * 每秒从后端获取一次最新状态
 */
function startStatusUpdate() {
    // 清除已存在的定时器
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
    
    // 立即更新一次
    updateStatus();
    
    // 设置定时器，每秒更新一次
    statusUpdateInterval = setInterval(updateStatus, 1000);
}

/**
 * 从后端获取并更新任务状态显示
 */
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const tasks = await response.json();
        
        // 如果没有任务，停止更新
        if (Object.keys(tasks).length === 0) {
            return;
        }
        
        // 更新进度列表显示
        const progressList = document.getElementById('progressList');
        progressList.innerHTML = '';
        
        let hasActiveTask = false; // 是否有进行中的任务
        
        // 遍历所有任务，创建进度显示项
        for (const [taskId, task] of Object.entries(tasks)) {
            const progressItem = createProgressItem(taskId, task);
            progressList.appendChild(progressItem);
            
            // 检查是否有进行中的任务
            if (['pending', 'starting', 'downloading', 'converting'].includes(task.status)) {
                hasActiveTask = true;
            }
        }
        
        // 如果所有任务都完成，停止更新并刷新文件列表
        if (!hasActiveTask) {
            clearInterval(statusUpdateInterval);
            statusUpdateInterval = null;
            // 下载完成后刷新文件列表
            loadFiles();
            
            // 检查是否有新完成的任务，发送通知
            checkCompletedTasks(tasks);
        }
        
    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

/**
 * 创建单个任务的进度显示元素
 * @param {string} taskId - 任务 ID
 * @param {Object} task - 任务信息
 * @returns {HTMLElement} 进度显示元素
 */
function createProgressItem(taskId, task) {
    const item = document.createElement('div');
    item.className = `progress-item ${task.status}`;
    item.setAttribute('data-task-id', taskId);
    
    // 状态文本映射和图标
    const statusConfig = {
        'pending': { text: '等待中', icon: '⏳' },
        'starting': { text: '启动中', icon: '🚀' },
        'downloading': { text: '下载中', icon: '⬇️' },
        'converting': { text: '转换中', icon: '🔄' },
        'completed': { text: '完成', icon: '✅' },
        'error': { text: '错误', icon: '❌' }
    };
    
    const status = statusConfig[task.status] || { text: task.status, icon: '📋' };
    
    // 计算进度百分比（用于进度条）- 安全处理
    let progressPercent = 0;
    if (task.progress_percent !== undefined) {
        progressPercent = task.progress_percent;
    } else if (task.progress) {
        try {
            const percentStr = task.progress.toString().replace('%', '').trim();
            progressPercent = Math.floor(parseFloat(percentStr)) || 0;
        } catch (e) {
            progressPercent = 0;
        }
    }
    
    // 获取统计信息
    const downloadedStr = task.downloaded_str || '0 B';
    const totalStr = task.total_str || '未知';
    const speedStr = task.speed || 'N/A';
    const etaStr = task.eta || '计算中...';
    const elapsedStr = task.elapsed_str || '0秒';
    
    // 构建 HTML
    item.innerHTML = `
        <div class="progress-card-header">
            <div class="progress-icon-status">
                <div class="status-icon">${status.icon}</div>
                <div class="progress-title-group">
                    <div class="progress-title" title="${task.title || task.url}">
                        ${escapeHtml(task.title || task.url)}
                    </div>
                    ${task.status === 'completed' && task.elapsed_str ? 
                        `<div class="progress-subtitle">总用时: ${elapsedStr}</div>` : ''}
                </div>
            </div>
            <span class="progress-status status-${task.status}">
                ${status.text}
            </span>
        </div>
        
        ${task.status === 'downloading' ? `
            <div class="progress-stats">
                <div class="stat-item">
                    <span class="stat-label">进度</span>
                    <span class="stat-value">${task.progress || '0%'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已下载</span>
                    <span class="stat-value">${downloadedStr} / ${totalStr}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">速度</span>
                    <span class="stat-value">${speedStr}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">剩余时间</span>
                    <span class="stat-value">${etaStr}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已用时间</span>
                    <span class="stat-value">${elapsedStr}</span>
                </div>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-container">
                    <div class="progress-bar progress-bar-downloading" 
                         style="width: ${progressPercent}%" 
                         data-percent="${progressPercent}">
                        <span class="progress-bar-text">${progressPercent}%</span>
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${task.status === 'converting' ? `
            <div class="progress-stats">
                <div class="stat-item">
                    <span class="stat-label">状态</span>
                    <span class="stat-value">正在转换为 MP3 格式...</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已用时间</span>
                    <span class="stat-value">${elapsedStr}</span>
                </div>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-container">
                    <div class="progress-bar progress-bar-converting" style="width: 100%">
                        <span class="progress-bar-text">转换中...</span>
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${task.status === 'pending' || task.status === 'starting' ? `
            <div class="progress-bar-wrapper">
                <div class="progress-bar-container">
                    <div class="progress-bar progress-bar-${task.status}" 
                         style="width: ${task.status === 'starting' ? '5' : '0'}%">
                        <span class="progress-bar-text">${task.status === 'starting' ? '准备中...' : '等待中...'}</span>
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${task.status === 'completed' ? `
            <div class="progress-stats">
                <div class="stat-item">
                    <span class="stat-label">状态</span>
                    <span class="stat-value success">✅ 下载完成</span>
                </div>
                ${task.total_str && task.total_str !== '未知' ? `
                    <div class="stat-item">
                        <span class="stat-label">文件大小</span>
                        <span class="stat-value">${task.total_str}</span>
                    </div>
                ` : ''}
                ${task.elapsed_str ? `
                    <div class="stat-item">
                        <span class="stat-label">总用时</span>
                        <span class="stat-value">${task.elapsed_str}</span>
                    </div>
                ` : ''}
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-container">
                    <div class="progress-bar progress-bar-completed" style="width: 100%">
                        <span class="progress-bar-text">100% 完成</span>
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${task.status === 'error' ? `
            <div class="progress-stats">
                <div class="stat-item error-full">
                    <span class="stat-label">错误信息</span>
                    <span class="stat-value error">${escapeHtml(task.message || '未知错误')}</span>
                </div>
            </div>
            ${progressPercent > 0 ? `
                <div class="progress-bar-wrapper">
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-bar-error" style="width: ${progressPercent}%">
                            <span class="progress-bar-text">${progressPercent}%</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        ` : ''}
        
        <div class="progress-message">${escapeHtml(task.message || '')}</div>
    `;
    
    return item;
}

/**
 * HTML 转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 清除已完成的任务
 */
async function clearCompleted() {
    try {
        const response = await fetch('/api/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 立即更新显示
            updateStatus();
        }
    } catch (error) {
        console.error('Failed to clear tasks:', error);
    }
}

/**
 * 加载文件列表
 */
async function loadFiles() {
    // 如果正在播放，暂时不刷新（避免中断播放）
    if (currentAudioPlayer && !currentAudioPlayer.paused) {
        return;
    }
    
    try {
        const response = await fetch('/api/files');
        const data = await response.json();
        
        if (data.success) {
            displayFiles(data.files);
        } else {
            document.getElementById('filesList').innerHTML = 
                '<p style="text-align: center; color: #ff3b30; padding: 20px;">加载失败：' + (data.error || '未知错误') + '</p>';
        }
    } catch (error) {
        console.error('Failed to load files:', error);
        document.getElementById('filesList').innerHTML = 
            '<p style="text-align: center; color: #ff3b30; padding: 20px;">无法加载文件列表</p>';
    }
}

/**
 * 刷新文件列表
 */
function refreshFiles() {
    loadFiles();
}

/**
 * 显示文件列表
 * @param {Array} files - 文件数组
 */
function displayFiles(files) {
    const filesList = document.getElementById('filesList');
    
    if (!files || files.length === 0) {
        filesList.innerHTML = '<p style="text-align: center; color: #86868b; padding: 20px;">暂无已下载的文件</p>';
        return;
    }
    
    // 如果正在播放音频，保存当前播放状态
    let savedAudioState = null;
    if (currentAudioPlayer && currentPlayingFile) {
        savedAudioState = {
            filename: currentPlayingFile,
            currentTime: currentAudioPlayer.currentTime,
            paused: currentAudioPlayer.paused,
            url: currentAudioPlayer.src
        };
    }
    
    let html = '<div class="files-grid">';
    
    files.forEach(file => {
        const isPlaying = currentPlayingFile === file.name;
        html += `
            <div class="file-item ${isPlaying ? 'playing' : ''}">
                <div class="file-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="14" fill="#007AFF" opacity="0.1"/>
                        <path d="M22 10L18 6H10C8.9 6 8 6.9 8 8V24C8 25.1 8.9 26 10 26H22C23.1 26 24 25.1 24 24V12L22 10Z" fill="#007AFF"/>
                        <path d="M20 10H22L18 6V8C18 9.1 18.9 10 20 10Z" fill="#007AFF" opacity="0.3"/>
                        <path d="M14 18L12 20L14 22M18 18L20 20L18 22" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${escapeHtml(file.name)}</div>
                    <div class="file-details">
                        <span>📦 ${file.size_str}</span>
                        <span>🕒 ${file.modified}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-play" onclick="togglePlay('${escapeHtml(file.name)}', '${file.url}')" title="${isPlaying ? '暂停' : '播放'}">
                        ${isPlaying ? `
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="6" y="4" width="3" height="12" fill="currentColor"/>
                                <rect x="11" y="4" width="3" height="12" fill="currentColor"/>
                            </svg>
                        ` : `
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M7 5L15 10L7 15V5Z" fill="currentColor"/>
                            </svg>
                        `}
                    </button>
                </div>
            </div>
            ${isPlaying ? `
                <div class="audio-player-container">
                    <audio id="audio-player-${escapeHtml(file.name)}" controls class="audio-player">
                        <source src="${file.url}" type="audio/mpeg">
                        您的浏览器不支持音频播放。
                    </audio>
                </div>
            ` : ''}
        `;
    });
    
    html += '</div>';
    filesList.innerHTML = html;
    
    // 如果之前正在播放，恢复播放状态
    if (savedAudioState) {
        const audioElement = document.getElementById(`audio-player-${savedAudioState.filename}`);
        if (audioElement) {
            // 恢复音频元素引用
            currentAudioPlayer = audioElement;
            
            // 恢复播放位置
            audioElement.currentTime = savedAudioState.currentTime;
            
            // 恢复播放状态
            if (!savedAudioState.paused) {
                // 等待音频加载后再播放
                audioElement.addEventListener('loadedmetadata', function() {
                    audioElement.currentTime = savedAudioState.currentTime;
                    const playPromise = audioElement.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(err => {
                            console.error('恢复播放失败:', err);
                        });
                    }
                }, { once: true });
                
                // 如果元数据已加载，直接播放
                if (audioElement.readyState >= 1) {
                    audioElement.currentTime = savedAudioState.currentTime;
                    const playPromise = audioElement.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(err => {
                            console.error('恢复播放失败:', err);
                        });
                    }
                }
            }
            
            // 重新绑定事件监听器
            audioElement.addEventListener('ended', function() {
                stopAudio();
            });
            
            audioElement.addEventListener('error', function(e) {
                console.error('音频播放错误:', e, audioElement.error);
                const errorMsg = audioElement.error ? 
                    `错误代码: ${audioElement.error.code} - ${getAudioErrorMessage(audioElement.error.code)}` : 
                    '未知错误';
                showToastNotification('播放失败', errorMsg, 'error');
                stopAudio();
            });
        }
    }
}

/**
 * 切换播放/暂停
 * @param {string} filename - 文件名
 * @param {string} url - 音频文件 URL
 */
function togglePlay(filename, url) {
    if (currentPlayingFile === filename && currentAudioPlayer) {
        // 如果点击的是当前播放的文件，暂停/继续播放
        if (currentAudioPlayer.paused) {
            currentAudioPlayer.play();
        } else {
            currentAudioPlayer.pause();
        }
    } else {
        // 如果点击的是其他文件，停止当前播放，开始播放新文件
        stopAudio();
        playAudio(filename, url);
    }
}

/**
 * 播放音频
 * @param {string} filename - 文件名
 * @param {string} url - 音频文件 URL
 */
function playAudio(filename, url) {
    // 停止当前播放
    stopAudio();
    
    // 创建新的音频元素
    const audio = document.createElement('audio');
    audio.id = `audio-player-${filename}`;
    audio.src = url;
    audio.controls = true;
    audio.className = 'audio-player';
    audio.preload = 'metadata'; // 预加载元数据，而不是整个文件
    
    // 添加错误处理
    audio.addEventListener('error', function(e) {
        console.error('音频播放错误:', e, audio.error);
        const errorMsg = audio.error ? 
            `错误代码: ${audio.error.code} - ${getAudioErrorMessage(audio.error.code)}` : 
            '未知错误';
        showToastNotification('播放失败', errorMsg, 'error');
        stopAudio();
    });
    
    // 添加加载事件监听
    audio.addEventListener('loadstart', function() {
        console.log('开始加载音频:', filename);
    });
    
    audio.addEventListener('loadedmetadata', function() {
        console.log('音频元数据加载完成:', filename, '时长:', audio.duration, '秒');
    });
    
    audio.addEventListener('canplay', function() {
        console.log('音频可以播放:', filename);
    });
    
    audio.addEventListener('canplaythrough', function() {
        console.log('音频可以完整播放:', filename);
    });
    
    audio.addEventListener('waiting', function() {
        console.log('音频等待缓冲:', filename);
    });
    
    audio.addEventListener('stalled', function() {
        console.warn('音频加载停滞:', filename);
    });
    
    // 添加到页面
    const container = document.createElement('div');
    container.className = 'audio-player-container';
    container.appendChild(audio);
    
    // 找到对应的文件项，在它后面插入播放器
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const nameElement = item.querySelector('.file-name');
        if (nameElement && nameElement.textContent === filename) {
            item.classList.add('playing');
            item.parentNode.insertBefore(container, item.nextSibling);
        }
    });
    
    // 播放音频
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('播放开始:', filename);
            })
            .catch(err => {
                // 忽略 "interrupted" 错误（这是正常的，当元素被移除时会发生）
                if (err.name !== 'AbortError' && !err.message.includes('interrupted')) {
                    console.error('播放失败:', err);
                    showToastNotification('播放失败', '无法播放音频文件: ' + err.message, 'error');
                    stopAudio();
                }
            });
    }
    
    // 监听播放结束
    audio.addEventListener('ended', function() {
        console.log('播放结束:', filename);
        stopAudio();
    });
    
    // 监听暂停
    audio.addEventListener('pause', function() {
        console.log('播放暂停:', filename);
    });
    
    // 更新全局变量
    currentAudioPlayer = audio;
    currentPlayingFile = filename;
}

/**
 * 获取音频错误消息
 */
function getAudioErrorMessage(errorCode) {
    const errorMessages = {
        1: 'MEDIA_ERR_ABORTED - 用户中止',
        2: 'MEDIA_ERR_NETWORK - 网络错误',
        3: 'MEDIA_ERR_DECODE - 解码错误',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持的格式'
    };
    return errorMessages[errorCode] || '未知错误';
}

/**
 * 停止音频播放
 */
function stopAudio() {
    if (currentAudioPlayer) {
        try {
            // 先暂停播放
            currentAudioPlayer.pause();
            // 移除所有事件监听器（通过克隆元素）
            const newAudio = currentAudioPlayer.cloneNode(false);
            currentAudioPlayer.parentNode.replaceChild(newAudio, currentAudioPlayer);
            currentAudioPlayer = null;
        } catch (e) {
            console.warn('停止播放时出错:', e);
            currentAudioPlayer = null;
        }
    }
    
    if (currentPlayingFile) {
        // 移除播放器容器
        const playerContainer = document.querySelector('.audio-player-container');
        if (playerContainer) {
            playerContainer.remove();
        }
        
        // 移除播放状态
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            item.classList.remove('playing');
        });
        
        currentPlayingFile = null;
        
        // 刷新文件列表以更新播放按钮状态（但不立即刷新，避免冲突）
        setTimeout(() => {
            if (!currentPlayingFile) {
                loadFiles();
            }
        }, 100);
    }
}

/**
 * 清空所有输入框
 */
function clearInputs() {
    const urlInputs = document.querySelectorAll('.url-input');
    const filenameInputs = document.querySelectorAll('.filename-input');
    
    urlInputs.forEach(input => input.value = '');
    filenameInputs.forEach(input => input.value = '');
}

// 添加淡出动画的 CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-10px);
        }
    }
`;
document.head.appendChild(style);

// =========================================================================
// 本地 MOV 文件音频提取功能
// =========================================================================

/**
 * 开始本地 MOV 文件音频提取
 */
async function startLocalExtract() {
    // 获取文件输入元素
    const fileInput = document.getElementById('movFileInput');
    const outputFormat = document.getElementById('outputFormat').value;
    const outputFilename = document.getElementById('outputFilename').value.trim();
    
    // 验证文件选择
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('请选择一个 MOV 格式的视频文件');
        return;
    }
    
    const file = fileInput.files[0];
    
    // 验证文件格式
    if (file.type !== 'video/quicktime' && !file.name.toLowerCase().endsWith('.mov')) {
        alert('请选择 MOV 格式的视频文件');
        return;
    }
    
    // 显示进度区域
    showLocalExtractProgress();
    updateLocalExtractProgress(0, '上传中...', 'uploading', file.name);
    
    try {
        // 创建 FormData 对象
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', outputFormat);
        
        if (outputFilename) {
            formData.append('filename', outputFilename);
        }
        
        // 创建 XMLHttpRequest 对象，用于监控上传进度
        const xhr = new XMLHttpRequest();
        
        // 监听上传进度
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100); // 上传占100%进度
                updateLocalExtractProgress(percent, '上传中...', 'uploading', file.name);
            }
        });
        
        // 监听开始发送请求
        xhr.onloadstart = function() {
            updateLocalExtractProgress(0, '开始上传...', 'pending', file.name);
        };
        
        // 监听上传完成（准备处理）
        xhr.upload.onload = function() {
            updateLocalExtractProgress(100, '上传完成，正在提取音频...', 'extracting', file.name);
        };
        
        // 监听响应
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        updateLocalExtractProgress(100, '提取完成！', 'completed', file.name);
                        showToastNotification('提取成功', `已成功从 ${file.name} 中提取音频`, 'success');
                        // 刷新文件列表
                        setTimeout(loadFiles, 1000);
                    } else {
                        updateLocalExtractProgress(100, `错误: ${result.error}`, 'error', file.name);
                        showToastNotification('提取失败', result.error, 'error');
                    }
                } catch (error) {
                    updateLocalExtractProgress(100, `解析响应失败: ${error.message}`, 'error', file.name);
                    showToastNotification('提取失败', '服务器响应格式错误', 'error');
                }
            } else {
                updateLocalExtractProgress(100, `请求失败: ${xhr.statusText}`, 'error', file.name);
                showToastNotification('提取失败', `服务器错误: ${xhr.status}`, 'error');
            }
        };
        
        // 监听错误
        xhr.onerror = function() {
            updateLocalExtractProgress(0, '网络错误', 'error', file.name);
            showToastNotification('提取失败', '网络连接错误', 'error');
        };
        
        // 发送请求
        xhr.open('POST', '/api/local-extract', true);
        xhr.send(formData);
        
    } catch (error) {
        updateLocalExtractProgress(0, `操作失败: ${error.message}`, 'error', file.name);
        showToastNotification('提取失败', error.message, 'error');
    }
}

/**
 * 显示本地提取进度区域
 */
function showLocalExtractProgress() {
    document.getElementById('localExtractProgress').style.display = 'block';
}

/**
 * 隐藏本地提取进度区域
 */
function hideLocalExtractProgress() {
    document.getElementById('localExtractProgress').style.display = 'none';
}

/**
 * 更新本地提取进度
 * @param {number} percent - 进度百分比 (0-100)
 * @param {string} message - 状态消息
 * @param {string} status - 状态类型 (pending, uploading, extracting, completed, error)
 * @param {string} filename - 文件名
 */
// 用于存储动态进度更新的定时器
let extractProgressInterval = null;
// 用于存储当前的动态进度值
let currentExtractProgress = 0;

/**
 * 更新本地提取进度
 * @param {number} percent - 进度百分比 (0-100)
 * @param {string} message - 状态消息
 * @param {string} status - 状态类型 (pending, uploading, extracting, completed, error)
 * @param {string} filename - 文件名
 */
function updateLocalExtractProgress(percent, message, status, filename) {
    // 状态配置
    const statusConfig = {
        'pending': { text: '准备中', icon: '⏳', barClass: 'progress-bar-pending' },
        'uploading': { text: '上传中', icon: '⬆️', barClass: 'progress-bar-uploading' },
        'extracting': { text: '提取中', icon: '🔄', barClass: 'progress-bar-extracting' },
        'completed': { text: '完成', icon: '✅', barClass: 'progress-bar-completed' },
        'error': { text: '错误', icon: '❌', barClass: 'progress-bar-error' }
    };
    
    const config = statusConfig[status] || statusConfig['pending'];
    
    // 更新标题
    const titleElement = document.getElementById('localExtractTitle');
    titleElement.textContent = filename ? `正在处理: ${filename}` : '准备中...';
    
    // 更新状态
    const statusElement = document.getElementById('localExtractStatus');
    statusElement.textContent = config.text;
    statusElement.className = `progress-status status-${status}`;
    
    // 更新图标
    const iconElement = document.querySelector('#localExtractProgress .status-icon');
    iconElement.textContent = config.icon;
    
    // 更新进度条
    const barElement = document.getElementById('localExtractBar');
    const barTextElement = document.getElementById('localExtractBarText');
    
    // 更新统计信息
    const statsElement = document.getElementById('localExtractStats');
    statsElement.style.display = 'flex';
    
    const percentElement = document.getElementById('localExtractPercent');
    const messageElement = document.getElementById('localExtractMessage');
    
    // 处理不同状态的进度更新
    if (status === 'extracting') {
        // 开始动态进度更新
        startDynamicProgress(percent, message);
    } else {
        // 清除动态进度更新
        stopDynamicProgress();
        
        // 更新固定进度
        barElement.style.width = `${percent}%`;
        barTextElement.textContent = `${percent}%`;
        percentElement.textContent = `${percent}%`;
        messageElement.textContent = message;
    }
    
    // 更新进度条类
    barElement.className = `progress-bar ${config.barClass}`;
    
    // 如果状态是错误，显示错误样式
    if (status === 'error') {
        messageElement.className = 'stat-value error';
    } else {
        messageElement.className = 'stat-value';
    }
    
    // 如果状态是完成或错误，显示完成或错误信息
    if (status === 'completed' || status === 'error') {
        // 添加完成/错误动画效果
        const progressElement = document.getElementById('localExtractProgress');
        progressElement.classList.add('progress-complete');
        
        // 一段时间后清除动画类
        setTimeout(() => {
            progressElement.classList.remove('progress-complete');
        }, 2000);
    }
}

/**
 * 开始动态进度更新
 * @param {number} initialPercent - 初始进度百分比
 * @param {string} baseMessage - 基础状态消息
 */
function startDynamicProgress(initialPercent, baseMessage) {
    // 清除现有的定时器
    stopDynamicProgress();
    
    // 设置初始进度
    currentExtractProgress = initialPercent;
    
    // 获取元素
    const barElement = document.getElementById('localExtractBar');
    const barTextElement = document.getElementById('localExtractBarText');
    const percentElement = document.getElementById('localExtractPercent');
    const messageElement = document.getElementById('localExtractMessage');
    
    // 计算目标进度（在初始进度和100%之间）
    const targetProgress = 100;
    
    // 更新进度函数
    const updateProgress = () => {
        // 计算进度增量（动态调整，使进度在提取过程中平滑增长）
        const progressIncrement = Math.random() * 2 + 0.5;
        
        // 更新进度
        currentExtractProgress += progressIncrement;
        
        // 确保进度不超过目标
        if (currentExtractProgress >= targetProgress) {
            currentExtractProgress = targetProgress;
            stopDynamicProgress();
        }
        
        // 计算剩余时间（模拟）
        const remainingSeconds = Math.round((targetProgress - currentExtractProgress) / 2);
        const timeMessage = remainingSeconds > 0 ? `预计剩余 ${remainingSeconds} 秒` : '';
        
        // 更新显示
        const displayPercent = Math.round(currentExtractProgress);
        barElement.style.width = `${displayPercent}%`;
        barTextElement.textContent = `${displayPercent}%`;
        percentElement.textContent = `${displayPercent}%`;
        messageElement.textContent = `${baseMessage} ${timeMessage}`;
    };
    
    // 设置定时器，每500毫秒更新一次进度
    extractProgressInterval = setInterval(updateProgress, 500);
    
    // 立即执行一次更新
    updateProgress();
}

/**
 * 停止动态进度更新
 */
function stopDynamicProgress() {
    if (extractProgressInterval) {
        clearInterval(extractProgressInterval);
        extractProgressInterval = null;
    }
}

// 添加本地提取相关的 CSS 样式
const localExtractStyle = document.createElement('style');
localExtractStyle.textContent = `
    .file-input {
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #d1d1d6;
        background-color: #ffffff;
        font-size: 14px;
        width: 100%;
        box-sizing: border-box;
    }
    
    .file-input:focus {
        outline: none;
        border-color: #007AFF;
        box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
    }
    
    .progress-bar-uploading {
        background: linear-gradient(90deg, #007AFF, #0056b3);
    }
    
    .progress-bar-extracting {
        background: linear-gradient(90deg, #34C759, #28a745);
    }
    
    .stat-value.error {
        color: #ff3b30;
    }
`;
document.head.appendChild(localExtractStyle);

