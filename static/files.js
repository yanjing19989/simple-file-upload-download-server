// 文件列表、上传和批量下载。请求状态通过 FSUI 的公开接口更新。
(function () {
    let fileCache = [];
    let currentPath = '';
    let refreshController = null;
    let refreshSequence = 0;
    let uploadBusy = false;
    let downloadBusy = false;
    let activeUploadRequest = null;
    let uploadCancelRequested = false;

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

    function endpointWithPath(endpoint, path) {
        return path
            ? endpoint + '?path=' + encodeURIComponent(path)
            : endpoint;
    }

    function downloadUrl(path, key) {
        return '/download?file=' + encodeURIComponent(path) +
            '&key=' + encodeURIComponent(key);
    }

    async function fetchFileList(signal, path = currentPath) {
        const result = await withAuthRetry(key => fetch(
            endpointWithPath('/list', path),
            {
                headers: { 'X-Secret-Key': key },
                signal,
            },
        ));
        if (result.cancelled) return result;
        if (!result.response.ok) {
            const error = new Error(
                '服务器返回 ' + result.response.status
            );
            error.status = result.response.status;
            throw error;
        }
        const data = await result.response.json();
        if (!data || !Array.isArray(data.files) ||
            !Array.isArray(data.directories) ||
            typeof data.path !== 'string') {
            throw new Error('文件列表格式无效');
        }
        const directories = data.directories.map(directory => ({
            ...directory,
            kind: 'directory',
            path: FSUtils.joinPath(data.path, directory.name),
        }));
        const files = data.files.map(file => ({
            ...file,
            kind: 'file',
            path: FSUtils.joinPath(data.path, file.name),
        }));
        return {
            key: result.key,
            path: data.path,
            entries: directories.concat(files),
        };
    }

    async function refreshList(options) {
        const notify = options && options.notify;
        const requestedPath = currentPath;
        const sequence = ++refreshSequence;
        if (refreshController) refreshController.abort();
        const controller = new AbortController();
        refreshController = controller;

        FSUI.setRefreshBusy(true);
        FSUI.setFileViewState('loading', '正在读取文件', '正在连接服务器');
        try {
            const result = await fetchFileList(
                controller.signal,
                requestedPath,
            );
            if (result.cancelled || sequence !== refreshSequence) return;
            currentPath = result.path;
            fileCache = result.entries;
            FSUI.setDirectory(currentPath);
            FSUI.renderTableFromCache(fileCache);
            FSUI.setLastRefresh();
            if (notify) FSUI.showToast('文件列表已刷新', 'ok', 1800);
        } catch (error) {
            if (error.name === 'AbortError' || sequence !== refreshSequence) {
                return;
            }
            const missingDirectory =
                error.status === 404 && Boolean(requestedPath);
            FSUI.setFileViewState(
                'error',
                missingDirectory
                    ? '当前目录不存在'
                    : '无法读取文件列表',
                missingDirectory
                    ? '目录可能已被移动或删除'
                    : (error.message || '请检查服务器连接后重试'),
                missingDirectory
                    ? { label: '返回根目录', handler: () => navigate('') }
                    : { label: '重新加载', handler: () => refreshList() },
            );
            FSUI.showToast('文件列表加载失败', 'err');
        } finally {
            if (sequence === refreshSequence) {
                refreshController = null;
                FSUI.setRefreshBusy(false);
            }
        }
    }

    function navigate(path) {
        if (uploadBusy) {
            FSUI.showToast('上传期间无法切换目录', 'warn');
            return;
        }
        currentPath = String(path || '');
        fileCache = [];
        FSUI.clearDirectoryState();
        FSUI.setDirectory(currentPath);
        refreshList();
    }

    function createUploadRequest(files, key, path) {
        return new Promise(resolve => {
            const form = new FormData();
            files.forEach(file => form.append('file', file));
            const xhr = new XMLHttpRequest();
            activeUploadRequest = xhr;
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
                if (activeUploadRequest === xhr) {
                    activeUploadRequest = null;
                }
                resolve(result);
            }

            FSUI.setUploadStatus('uploading', '正在上传', '计算剩余时间');
            FSUI.setUploadProgress(0, speedText, '计算剩余时间');
            xhr.open('POST', endpointWithPath('/upload', path));
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

    function cancelUpload() {
        if (!uploadBusy) return;
        uploadCancelRequested = true;
        FSUI.setUploadStatus('idle', '正在取消上传', '请稍候');
        if (activeUploadRequest) activeUploadRequest.abort();
    }

    function showUploadError(title, detail, message) {
        FSUI.setUploadStatus('error', title, detail);
        FSUI.showToast(message || '上传失败：' + detail, 'err');
    }

    async function prepareUpload(files, path) {
        FSUI.setUploadStatus(
            'uploading',
            '正在检查同名文件',
            '读取最新文件列表',
        );
        const latest = await fetchFileList(undefined, path);
        if (latest.cancelled) {
            return { cancelled: true, reason: 'auth' };
        }
        currentPath = latest.path;
        FSUI.setDirectory(currentPath);
        fileCache = latest.entries;
        FSUI.renderTableFromCache(fileCache);
        FSUI.setLastRefresh();
        if (uploadCancelRequested) {
            return { cancelled: true, reason: 'cancel' };
        }
        const conflicts = FSUtils.findUploadConflicts(
            files,
            fileCache.filter(entry => entry.kind === 'file'),
        );
        if (conflicts.length) {
            const confirmed = await FSUI.confirmOverwrite(conflicts);
            if (!confirmed) {
                return { cancelled: true, reason: 'conflict' };
            }
        }
        return latest;
    }

    async function upload() {
        if (uploadBusy) return;
        const files = FSUI.getUploadFiles();
        if (!files.length) {
            FSUI.showToast('请先选择要上传的文件', 'warn');
            return;
        }

        uploadBusy = true;
        uploadCancelRequested = false;
        const uploadPath = currentPath;
        FSUI.setUploadBusy(true);
        try {
            let authRestarts = 0;
            while (authRestarts <= 1) {
                let prepared;
                try {
                    prepared = await prepareUpload(files, uploadPath);
                } catch (error) {
                    showUploadError(
                        '无法检查同名文件',
                        error.message || '请检查服务器连接',
                        '上传前检查失败，请重试',
                    );
                    return;
                }
                if (prepared.cancelled || uploadCancelRequested) {
                    const conflictCancelled =
                        prepared.reason === 'conflict';
                    FSUI.setUploadStatus(
                        'idle',
                        conflictCancelled ? '已取消覆盖' : '上传已取消',
                        '已保留所选文件',
                    );
                    return;
                }

                const response = await createUploadRequest(
                    files,
                    prepared.key,
                    uploadPath,
                );
                if (response.aborted || uploadCancelRequested) {
                    FSUI.setUploadStatus(
                        'idle',
                        '上传已取消',
                        '已保留所选文件',
                    );
                    return;
                }
                if (response.networkError) {
                    showUploadError(
                        '网络连接失败',
                        '请检查服务器连接',
                        '上传失败：网络连接异常',
                    );
                    return;
                }
                if (response.status === 200) {
                    FSUI.setUploadProgress(
                        100,
                        response.speedText,
                        '传输完成',
                    );
                    FSUI.setUploadStatus('success', '上传完成', '传输完成');
                    FSUI.clearUploadSelection();
                    FSUI.showToast('文件上传成功');
                    await refreshList();
                    return;
                }
                if (response.status === 401 && authRestarts === 0) {
                    FSAuth.resetKey({ silent: true });
                    authRestarts++;
                    continue;
                }
                const detail = response.status === 401
                    ? '访问密钥仍然无效'
                    : '服务器返回 ' + response.status;
                showUploadError('上传失败', detail);
                return;
            }
        } finally {
            activeUploadRequest = null;
            uploadBusy = false;
            FSUI.setUploadBusy(false);
        }
    }

    async function validateDownload(key, path) {
        return fetch(downloadUrl(path, key), { method: 'HEAD' });
    }

    function triggerDownload(path, name, key) {
        const link = document.createElement('a');
        link.href = downloadUrl(path, key);
        link.download = name;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function listDirectory(path, key) {
        const response = await fetch(endpointWithPath('/list', path), {
            headers: { 'X-Secret-Key': key },
        });
        if (!response.ok) {
            throw new Error(
                '读取文件夹失败，服务器返回 ' + response.status
            );
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.files) ||
            !Array.isArray(data.directories)) {
            throw new Error('文件夹列表格式无效');
        }
        return data;
    }

    async function writeRemoteFile(path, name, targetDirectory, key) {
        const response = await fetch(
            '/download?file=' + encodeURIComponent(path),
            { headers: { 'X-Secret-Key': key } },
        );
        if (!response.ok) {
            throw new Error(
                '下载 ' + name + ' 失败，服务器返回 ' + response.status
            );
        }
        const fileHandle = await targetDirectory.getFileHandle(
            name,
            { create: true },
        );
        const writable = await fileHandle.createWritable();
        try {
            if (response.body && response.body.pipeTo) {
                await response.body.pipeTo(writable);
            } else {
                await writable.write(await response.blob());
                await writable.close();
            }
        } catch (error) {
            try {
                await writable.abort();
            } catch (abortError) {
                // 流可能已由 pipeTo 自动中止。
            }
            throw error;
        }
    }

    async function writeRemoteDirectory(path, targetDirectory, key) {
        const data = await listDirectory(path, key);
        let downloadedFiles = 0;
        for (const directory of data.directories) {
            const childPath = FSUtils.joinPath(path, directory.name);
            const childTarget = await targetDirectory.getDirectoryHandle(
                directory.name,
                { create: true },
            );
            downloadedFiles += await writeRemoteDirectory(
                childPath,
                childTarget,
                key,
            );
        }
        for (const file of data.files) {
            await writeRemoteFile(
                FSUtils.joinPath(path, file.name),
                file.name,
                targetDirectory,
                key,
            );
            downloadedFiles++;
        }
        return downloadedFiles;
    }

    async function downloadToDirectory(entries, downloadPath) {
        if (typeof window.showDirectoryPicker !== 'function') {
            throw new Error(
                '当前浏览器或访问方式不支持文件夹下载，请使用 HTTPS 或 localhost 下的 Chrome/Edge'
            );
        }

        // 必须在用户点击产生的激活状态内先打开目录选择器。
        const targetRoot = await window.showDirectoryPicker({
            mode: 'readwrite',
        });
        const authResult = await withAuthRetry(key => fetch(
            endpointWithPath('/list', downloadPath),
            { headers: { 'X-Secret-Key': key } },
        ));
        if (authResult.cancelled) return null;
        if (!authResult.response.ok) {
            throw new Error('服务器返回 ' + authResult.response.status);
        }
        await authResult.response.json();

        let downloadedFiles = 0;
        for (const entry of entries) {
            const path = FSUtils.joinPath(downloadPath, entry.name);
            if (entry.kind === 'directory') {
                const directory = await targetRoot.getDirectoryHandle(
                    entry.name,
                    { create: true },
                );
                downloadedFiles += await writeRemoteDirectory(
                    path,
                    directory,
                    authResult.key,
                );
            } else {
                await writeRemoteFile(
                    path,
                    entry.name,
                    targetRoot,
                    authResult.key,
                );
                downloadedFiles++;
            }
        }
        return downloadedFiles;
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
            const downloadPath = currentPath;
            const selectedSet = new Set(names);
            const entries = fileCache.filter(entry =>
                selectedSet.has(entry.name)
            );
            const directories = entries.filter(
                entry => entry.kind === 'directory'
            );
            if (directories.length) {
                const downloadedFiles = await downloadToDirectory(
                    entries,
                    downloadPath,
                );
                if (downloadedFiles === null) return;
                FSUI.showToast(
                    '下载完成：' + directories.length + ' 个文件夹，' +
                    downloadedFiles + ' 个文件',
                    'ok',
                );
                return;
            }
            const paths = names.map(name =>
                FSUtils.joinPath(downloadPath, name)
            );
            const result = await withAuthRetry(
                key => validateDownload(key, paths[0]),
            );
            if (result.cancelled) return;
            if (!result.response.ok) {
                throw new Error('服务器返回 ' + result.response.status);
            }
            if (currentPath !== downloadPath) {
                currentPath = downloadPath;
                FSUI.setDirectory(currentPath);
                refreshList();
            }
            FSUI.showToast('开始下载 ' + names.length + ' 个文件');
            for (let index = 0; index < names.length; index++) {
                triggerDownload(paths[index], names[index], result.key);
                if (index < names.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        } catch (error) {
            if (error && error.name === 'AbortError') return;
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
        cancelUpload,
        refresh: refreshList,
        navigate,
        download: downloadSelected,
        getFiles: () => fileCache,
    });
    window.addEventListener('fs:key-reset', () => {
        if (!window.ENCRYPTED) return;
        fileCache = [];
        currentPath = '';
        FSUI.clearDirectoryState({ preserveUpload: true });
        FSUI.setDirectory(currentPath);
    });
    window.addEventListener('DOMContentLoaded', () => {
        FSUI.setDirectory(currentPath);
        refreshList();
    });

})();
