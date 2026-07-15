// 文件列表、上传和批量下载。
window.FSFiles = (function () {
    let fileCache = [];

    async function requestAccess(errorMessage) {
        const key = await FSAuth.requestKey(errorMessage);
        if (!key) {
            FSUI.setFileViewState('locked', '文件列表已锁定', '输入访问密钥后可查看和传输文件', {
                label: '输入密钥',
                handler: () => refreshList()
            });
        }
        return key;
    }

    async function refreshList(options) {
        const notify = options && options.notify;
        FSUI.setFileViewState('loading', '正在读取文件', '正在连接服务器');
        refreshBtn.disabled = true;
        try {
            const key = await requestAccess();
            if (!key) return;
            const response = await fetch('/list', { headers: { 'X-Secret-Key': key } });
            if (response.status === 401) {
                FSAuth.resetKey({ silent: true });
                const retryKey = await requestAccess('密钥错误，请重新输入');
                if (retryKey) return refreshList(options);
                return;
            }
            if (!response.ok) throw new Error('服务器返回 ' + response.status);
            const data = await response.json();
            if (!data || !Array.isArray(data.files)) throw new Error('文件列表格式无效');
            fileCache = data.files;
            FSUI.renderTableFromCache(fileCache);
            lastRefresh.textContent = '刷新于 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (notify) showToast('文件列表已刷新', 'ok', 1800);
        } catch (error) {
            FSUI.setFileViewState('error', '无法读取文件列表', error.message || '请检查服务器连接后重试', {
                label: '重新加载',
                handler: () => refreshList()
            });
            showToast('文件列表加载失败', 'err');
        } finally {
            refreshBtn.disabled = false;
        }
    }

    async function upload() {
        if (!fileInput.files.length) {
            showToast('请先选择要上传的文件', 'warn');
            return;
        }
        const key = await FSAuth.requestKey();
        if (!key) {
            FSUI.setUploadStatus('idle', '上传已取消', '需要访问密钥');
            return;
        }

        const form = new FormData();
        for (const file of fileInput.files) form.append('file', file);
        const xhr = new XMLHttpRequest();
        const startedAt = Date.now();
        let lastLoaded = 0;
        let lastTime = startedAt;

        FSUI.setUploadBusy(true);
        FSUI.setUploadStatus('uploading', '正在上传', '计算剩余时间');
        FSUI.setUploadProgress(0, '0 KB/s', '计算剩余时间');
        xhr.open('POST', '/upload');
        xhr.setRequestHeader('X-Secret-Key', key);

        xhr.upload.onprogress = event => {
            const now = Date.now();
            if (!event.lengthComputable || (now - lastTime < 400 && event.loaded !== event.total)) return;
            const percent = event.total ? event.loaded / event.total * 100 : 0;
            const elapsed = Math.max((now - startedAt) / 1000, .1);
            const interval = Math.max((now - lastTime) / 1000, .1);
            const speed = event.loaded === event.total ? event.total / elapsed : (event.loaded - lastLoaded) / interval;
            const remaining = Math.max(0, event.total - event.loaded);
            const eta = speed > 0 && remaining > 0 ? '约剩 ' + Math.ceil(remaining / speed) + ' 秒' : (percent >= 100 ? '服务器正在处理' : '计算剩余时间');
            FSUI.setUploadProgress(percent, FSUtils.formatSize(speed) + '/s', eta);
            lastLoaded = event.loaded;
            lastTime = now;
        };

        xhr.onload = async () => {
            FSUI.setUploadBusy(false);
            if (xhr.status === 200) {
                FSUI.setUploadProgress(100, speedLine.textContent, '传输完成');
                FSUI.setUploadStatus('success', '上传完成', '传输完成');
                showToast('文件上传成功');
                await refreshList();
            } else if (xhr.status === 401) {
                FSAuth.resetKey({ silent: true });
                FSUI.setUploadStatus('error', '上传未开始', '访问密钥错误');
                const newKey = await FSAuth.requestKey('密钥错误，请重新输入');
                if (newKey) showToast('密钥已更新，请再次点击上传', 'warn');
            } else {
                FSUI.setUploadStatus('error', '上传失败', '服务器返回 ' + xhr.status);
                showToast('上传失败：服务器返回 ' + xhr.status, 'err');
            }
        };
        xhr.onerror = () => {
            FSUI.setUploadBusy(false);
            FSUI.setUploadStatus('error', '网络连接失败', '请检查服务器连接');
            showToast('上传失败：网络连接异常', 'err');
        };
        xhr.onabort = () => {
            FSUI.setUploadBusy(false);
            FSUI.setUploadStatus('error', '上传已中止', '可重新开始上传');
        };
        xhr.send(form);
    }

    async function downloadSelected() {
        const names = FSUI.getSelectedNames();
        if (!names.length) {
            showToast('请至少选择一个文件', 'warn');
            return;
        }
        const key = await FSAuth.requestKey();
        if (!key) return;

        let index = 0;
        const downloadNext = () => {
            if (index >= names.length) return;
            const name = names[index];
            const link = document.createElement('a');
            link.href = '/download?file=' + encodeURIComponent(name) + '&key=' + encodeURIComponent(key);
            link.download = name;
            link.hidden = true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            index++;
            if (index < names.length) setTimeout(downloadNext, 300);
        };
        downloadNext();
        showToast('开始下载 ' + names.length + ' 个文件');
    }

    return {
        refreshList,
        upload,
        downloadSelected,
        get fileCache() { return fileCache; }
    };
})();

uploadBtn.addEventListener('click', () => FSFiles.upload());
refreshBtn.addEventListener('click', () => FSFiles.refreshList({ notify: true }));
downloadSelBtn.addEventListener('click', () => FSFiles.downloadSelected());
window.addEventListener('DOMContentLoaded', () => FSFiles.refreshList());
