// 文件操作：上传、刷新列表、下载
window.FSFiles = (function(){
    let fileCache = [];
    function refreshList() {
        const key = FSAuth.getKey(); if (!key) return;
        fetch('/list', { headers: { 'X-Secret-Key': key } }).then(r => {
            if (r.status === 401) { showToast && showToast('密钥错误', 'err'); FSAuth.resetKey(); return refreshList(); }
            return r.json();
        }).then(data => { if (!data) return; fileCache = data.files || []; renderTableFromCache(fileCache); lastRefresh && (lastRefresh.textContent = '刷新: ' + new Date().toLocaleTimeString()); showToast && showToast('列表已刷新', 'ok', 1800); });
    }
    function upload() {
        if (!fileInput) return showToast && showToast('找不到上传输入框', 'err');
        const files = fileInput.files; if (!files || !files.length) { showToast && showToast('请选择文件', 'warn'); return; }
        const form = new FormData(); for (let i = 0; i < files.length; i++) form.append('file', files[i]);
        const xhr = new XMLHttpRequest(); xhr.open('POST', '/upload'); const key = FSAuth.getKey(); if (!key) return; xhr.setRequestHeader('X-Secret-Key', key);
        let lastLoaded = 0, lastTime = Date.now(); progressWrap && (progressWrap.style.display = 'block'); statusSpan && (statusSpan.textContent = '准备上传');
        xhr.upload.onprogress = function (e) { const now = Date.now(); if (e.lengthComputable && (now - lastTime >= 180 || e.loaded === e.total)) { const percent = (e.loaded / e.total) * 100; progressBar && (progressBar.value = percent); const dt = (now - lastTime) / 1000; const db = e.loaded - lastLoaded; const speed = db / dt; speedLine && (speedLine.textContent = (speed / 1024).toFixed(2) + ' KB/s'); const remain = e.total - e.loaded; etaLine && (etaLine.textContent = speed ? '剩余 ' + (remain / speed).toFixed(1) + 's' : ''); statusSpan && (statusSpan.textContent = percent.toFixed(1) + '%'); lastLoaded = e.loaded; lastTime = now; } };
        xhr.onload = function () { if (xhr.status === 200) { showToast && showToast('上传成功', 'ok'); statusSpan && (statusSpan.textContent = '完成'); refreshList(); } else if (xhr.status === 401) { showToast && showToast('密钥错误', 'err'); FSAuth.resetKey(); } else { showToast && showToast('上传失败: ' + xhr.status, 'err'); statusSpan && (statusSpan.textContent = '失败'); } };
        xhr.onerror = function () { showToast && showToast('网络错误', 'err'); };
        xhr.send(form);
    }
    function downloadSelected() {
        const key = FSAuth.getKey(); if (!key) return; const checks = [...fileTableBody.querySelectorAll('.row-check:checked')]; if (!checks.length) { showToast && showToast('请至少选择一个文件', 'warn'); return; } checks.forEach(cb => { const name = cb.closest('tr').dataset.name; window.open('/download?file=' + encodeURIComponent(name) + '&key=' + encodeURIComponent(key), '_blank'); }); showToast && showToast('开始下载 ' + checks.length + ' 个文件', 'ok'); }
    // 对外接口
    return { refreshList, upload, downloadSelected, get fileCache() { return fileCache; } };
})();

// 绑定按钮事件
if (typeof uploadBtn !== 'undefined' && uploadBtn) uploadBtn.addEventListener('click', () => window.FSFiles.upload());
if (typeof refreshBtn !== 'undefined' && refreshBtn) refreshBtn.addEventListener('click', () => window.FSFiles.refreshList());

// 初始加载
window.addEventListener('DOMContentLoaded', () => { if (FSAuth && FSFiles) FSFiles.refreshList(); });

