// 文件列表、上传和批量下载。请求状态通过 FSUI 的公开接口更新。
window.FSFiles = (function () {
    let fileCache = [];
    let refreshController = null;
    let refreshSequence = 0;
    let uploadBusy = false;
    let downloadBusy = false;

    function showLockedState(title = '文件列表已锁定') {
        FSUI.setFileViewState(
            'locked',
            title,
            '输入访问密钥后可查看和传输文件',
            { label: '输入密钥', handler: () => refreshList() },
        );
    }

    async function requestAccess(errorMessage) {
        const key = await FSAuth.requestKey(errorMessage);
        if (!key) showLockedState();
        return key;
    }

    async function withAuthRetry(operation) {
        let key = await requestAccess();
        if (!key) return { cancelled: true };

        let response = await operation(key);
        if (response.status !== 401) return { key, response };

        FSAuth.resetKey({ silent: true });
        key = await requestAccess('密钥错误，请重新输入');
        if (!key) return { cancelled: true };
        response = await operation(key);
        return { key, response };
    }

    async function refreshList(options) {
        const notify = options && options.notify;
        const sequence = ++refreshSequence;
        if (refreshController) refreshController.abort();
        const controller = new AbortController();
        refreshController = controller;

        FSUI.setRefreshBusy(true);
        FSUI.setFileViewState('loading', '正在读取文件', '正在连接服务器');
        try {
            const result = await withAuthRetry(key => fetch('/list', {
                headers: { 'X-Secret-Key': key },
                signal: controller.signal,
            }));
            if (result.cancelled || sequence !== refreshSequence) return;
            if (!result.response.ok) {
                throw new Error('服务器返回 ' + result.response.status);
            }
            const data = await result.response.json();
            if (!data || !Array.isArray(data.files)) {
                throw new Error('文件列表格式无效');
            }
            if (sequence !== refreshSequence) return;
            fileCache = data.files;
            FSUI.renderTableFromCache(fileCache);
            FSUI.setLastRefresh();
            if (notify) FSUI.showToast('文件列表已刷新', 'ok', 1800);
        } catch (error) {
            if (error.name === 'AbortError' || sequence !== refreshSequence) {
                return;
            }
            FSUI.setFileViewState(
                'error',
                '无法读取文件列表',
                error.message || '请检查服务器连接后重试',
                { label: '重新加载', handler: () => refreshList() },
            );
            FSUI.showToast('文件列表加载失败', 'err');
        } finally {
            if (sequence === refreshSequence) {
                refreshController = null;
                FSUI.setRefreshBusy(false);
            }
        }
    }

    function createUploadRequest(files, key) {
        return new Promise(resolve => {
            const form = new FormData();
            files.forEach(file => form.append('file', file));
            const xhr = new XMLHttpRequest();
            const startedAt = Date.now();
            let lastLoaded = 0;
            let lastTime = startedAt;
            let speedText = '0.00 B/s';
            let settled = false;

            function finish(result) {
                if (settled) return;
                settled = true;
                xhr.upload.onprogress = null;
                xhr.onload = null;
                xhr.onerror = null;
                xhr.onabort = null;
                resolve(result);
            }

            FSUI.setUploadStatus('uploading', '正在上传', '计算剩余时间');
            FSUI.setUploadProgress(0, speedText, '计算剩余时间');
            xhr.open('POST', '/upload');
            xhr.setRequestHeader('X-Secret-Key', key);
            xhr.upload.onprogress = event => {
                const now = Date.now();
                if (!event.lengthComputable ||
                    (now - lastTime < 400 && event.loaded !== event.total)) {
                    return;
                }
                const percent = event.total
                    ? event.loaded / event.total * 100
                    : 0;
                const elapsed = Math.max((now - startedAt) / 1000, 0.1);
                const interval = Math.max((now - lastTime) / 1000, 0.1);
                const speed = event.loaded === event.total
                    ? event.total / elapsed
                    : (event.loaded - lastLoaded) / interval;
                const remaining = Math.max(0, event.total - event.loaded);
                const eta = speed > 0 && remaining > 0
                    ? '约剩 ' + Math.ceil(remaining / speed) + ' 秒'
                    : (percent >= 100 ? '服务器正在处理' : '计算剩余时间');
                speedText = FSUtils.formatSize(speed) + '/s';
                FSUI.setUploadProgress(percent, speedText, eta);
                lastLoaded = event.loaded;
                lastTime = now;
            };
            xhr.onload = () => finish({ status: xhr.status, speedText });
            xhr.onerror = () => finish({ status: 0, networkError: true });
            xhr.onabort = () => finish({ status: 0, aborted: true });
            xhr.send(form);
        });
    }

    async function upload() {
        if (uploadBusy) return;
        const files = FSUI.getUploadFiles();
        if (!files.length) {
            FSUI.showToast('请先选择要上传的文件', 'warn');
            return;
        }

        uploadBusy = true;
        FSUI.setUploadBusy(true);
        try {
            const result = await withAuthRetry(
                key => createUploadRequest(files, key),
            );
            if (result.cancelled) {
                FSUI.setUploadStatus('idle', '上传已取消', '需要访问密钥');
                return;
            }
            const response = result.response;
            if (response.networkError) {
                FSUI.setUploadStatus('error', '网络连接失败', '请检查服务器连接');
                FSUI.showToast('上传失败：网络连接异常', 'err');
                return;
            }
            if (response.aborted) {
                FSUI.setUploadStatus('error', '上传已中止', '可重新开始上传');
                return;
            }
            if (response.status === 200) {
                FSUI.setUploadProgress(100, response.speedText, '传输完成');
                FSUI.setUploadStatus('success', '上传完成', '传输完成');
                FSUI.showToast('文件上传成功');
                await refreshList();
                return;
            }
            const detail = response.status === 401
                ? '访问密钥仍然无效'
                : '服务器返回 ' + response.status;
            FSUI.setUploadStatus('error', '上传失败', detail);
            FSUI.showToast('上传失败：' + detail, 'err');
        } finally {
            uploadBusy = false;
            FSUI.setUploadBusy(false);
        }
    }

    async function validateDownload(key, name) {
        return fetch(
            '/download?file=' + encodeURIComponent(name) +
                '&key=' + encodeURIComponent(key),
            { method: 'HEAD' },
        );
    }

    function triggerDownload(name, key) {
        const link = document.createElement('a');
        link.href = '/download?file=' + encodeURIComponent(name) +
            '&key=' + encodeURIComponent(key);
        link.download = name;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function downloadSelected() {
        if (downloadBusy) return;
        const names = FSUI.getSelectedNames();
        if (!names.length) {
            FSUI.showToast('请至少选择一个文件', 'warn');
            return;
        }

        downloadBusy = true;
        FSUI.setDownloadBusy(true);
        try {
            const result = await withAuthRetry(
                key => validateDownload(key, names[0]),
            );
            if (result.cancelled) return;
            if (!result.response.ok) {
                throw new Error('服务器返回 ' + result.response.status);
            }
            FSUI.showToast('开始下载 ' + names.length + ' 个文件');
            for (let index = 0; index < names.length; index++) {
                triggerDownload(names[index], result.key);
                if (index < names.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        } catch (error) {
            FSUI.showToast(
                '下载失败：' + (error.message || '网络连接异常'),
                'err',
            );
        } finally {
            downloadBusy = false;
            FSUI.setDownloadBusy(false);
        }
    }

    FSUI.bindActions({
        upload,
        refresh: refreshList,
        download: downloadSelected,
        getFiles: () => fileCache,
    });
    window.addEventListener('DOMContentLoaded', () => refreshList());

    return {
        refreshList,
        upload,
        downloadSelected,
        get fileCache() { return fileCache; },
    };
})();
