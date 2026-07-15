// 页面状态、文件选择和反馈组件。
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progressBar');
const progressWrap = document.getElementById('progressWrap');
const progressPercent = document.getElementById('progressPercent');
const statusSpan = document.getElementById('status');
const speedLine = document.getElementById('speedLine');
const etaLine = document.getElementById('etaLine');
const uploadStatus = document.getElementById('uploadStatus');
const dropZone = document.getElementById('dropZone');
const selectedList = document.getElementById('selectedList');
const fileTableBody = document.getElementById('fileTableBody');
const fileCount = document.getElementById('fileCount');
const selectedCount = document.getElementById('selectedCount');
const lastRefresh = document.getElementById('lastRefresh');
const downloadSelBtn = document.getElementById('downloadSelBtn');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const invertBtn = document.getElementById('invertBtn');
const searchInput = document.getElementById('search');
const clearBtn = document.getElementById('clearBtn');
const resetKeyBtn = document.getElementById('resetKeyBtn');
const encState = document.getElementById('encState');
const securityPill = document.getElementById('securityPill');
const aboutBtn = document.getElementById('aboutBtn');
const aboutModal = document.getElementById('aboutModal');

const selectedNames = new Set();
let uploadBusy = false;
let lastFocusedElement = null;

function showToast(message, type = 'ok', timeout = 3200) {
    const stack = document.getElementById('toastStack');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', type === 'err' ? 'alert' : 'status');
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), 200);
    }, timeout);
}

function updateSelectedFiles() {
    const files = fileInput.files;
    if (!files || !files.length) {
        selectedList.textContent = '尚未选择文件';
        uploadBtn.disabled = true;
        return;
    }
    let total = 0;
    const names = [];
    for (const file of files) {
        total += file.size || 0;
        names.push(file.name);
    }
    const preview = names.slice(0, 3).join('、') + (names.length > 3 ? ' 等' : '');
    selectedList.textContent = files.length + ' 个文件 · ' + FSUtils.formatSize(total) + ' · ' + preview;
    uploadBtn.disabled = uploadBusy;
}

function handleFiles(files) {
    if (!files || !files.length) return;
    try {
        const transfer = new DataTransfer();
        for (const file of files) transfer.items.add(file);
        fileInput.files = transfer.files;
        updateSelectedFiles();
        showToast('已选择 ' + files.length + ' 个文件');
    } catch (error) {
        showToast('当前浏览器无法接收拖放文件，请使用“选择文件”', 'warn');
    }
}

['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('dragover');
    if (name === 'drop') handleFiles(event.dataTransfer.files);
}));
dropZone.addEventListener('click', event => {
    if (!event.target.closest('label')) fileInput.click();
});
dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
    }
});
fileInput.addEventListener('change', updateSelectedFiles);

function setUploadBusy(busy) {
    uploadBusy = busy;
    uploadBtn.disabled = busy || !fileInput.files.length;
    uploadBtn.querySelector('span').textContent = busy ? '正在上传' : '开始上传';
    fileInput.disabled = busy;
    clearBtn.disabled = busy;
    dropZone.setAttribute('aria-disabled', String(busy));
}

function setUploadStatus(type, title, detail) {
    uploadStatus.className = 'upload-status is-' + type;
    statusSpan.textContent = title;
    if (detail !== undefined) etaLine.textContent = detail;
}

function setUploadProgress(percent, speed, eta) {
    const value = Math.max(0, Math.min(100, percent || 0));
    progressBar.value = value;
    progressBar.textContent = value.toFixed(0) + '%';
    progressPercent.textContent = value.toFixed(0) + '%';
    speedLine.textContent = speed || '0 KB/s';
    etaLine.textContent = eta || (value >= 100 ? '传输完成' : '计算剩余时间');
}

function clearUploadProgress() {
    setUploadProgress(0, '0 KB/s', '准备就绪');
    setUploadStatus('idle', '等待上传', '准备就绪');
}
clearBtn.addEventListener('click', clearUploadProgress);

function stateIcon(kind) {
    if (kind === 'error') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>';
    if (kind === 'locked') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"/></svg>';
}

function setFileViewState(kind, title, detail, action) {
    if (kind === 'loading') {
        fileTableBody.innerHTML = '<tr class="state-row"><td colspan="3"><span class="loading-spinner" aria-hidden="true"></span><strong>' + FSUtils.escapeHtml(title) + '</strong><small>' + FSUtils.escapeHtml(detail || '') + '</small></td></tr>';
        fileCount.textContent = '正在读取…';
    } else {
        const button = action ? '<button class="button secondary-button" id="stateActionBtn" type="button">' + FSUtils.escapeHtml(action.label) + '</button>' : '';
        fileTableBody.innerHTML = '<tr class="state-row"><td colspan="3"><div class="state-content">' + stateIcon(kind) + '<strong>' + FSUtils.escapeHtml(title) + '</strong><small>' + FSUtils.escapeHtml(detail || '') + '</small>' + button + '</div></td></tr>';
        fileCount.textContent = kind === 'locked' ? '需要访问密钥' : '暂无可显示文件';
        if (action) document.getElementById('stateActionBtn').addEventListener('click', action.handler);
    }
    selectAllBtn.disabled = true;
    invertBtn.disabled = true;
}

function updateSelected() {
    selectedCount.textContent = String(selectedNames.size);
    downloadSelBtn.disabled = selectedNames.size === 0;
}

function renderTableFromCache(files) {
    const cache = files || [];
    const available = new Set(cache.map(file => file.name));
    [...selectedNames].forEach(name => {
        if (!available.has(name)) selectedNames.delete(name);
    });
    const filter = searchInput.value.trim().toLowerCase();
    const visible = cache.filter(file => !filter || file.name.toLowerCase().includes(filter));
    fileTableBody.innerHTML = '';

    if (!visible.length) {
        const emptySearch = Boolean(filter && cache.length);
        setFileViewState('empty', emptySearch ? '没有匹配的文件' : '当前目录为空', emptySearch ? '尝试使用其他关键词搜索' : '上传文件后会显示在这里');
        fileCount.textContent = emptySearch ? '0 / ' + cache.length + ' 个文件' : '0 个文件';
        updateSelected();
        return;
    }

    for (const file of visible) {
        const row = document.createElement('tr');
        const checked = selectedNames.has(file.name);
        row.className = 'file-row' + (checked ? ' is-selected' : '');
        row.dataset.name = file.name;
        row.innerHTML =
            '<td class="checkbox-cell"><input type="checkbox" class="row-check" aria-label="选择 ' + FSUtils.escapeHtml(file.name) + '"' + (checked ? ' checked' : '') + '></td>' +
            '<td class="name-cell"><div class="file-name-wrap"><span class="file-icon" aria-hidden="true">' + FSUtils.extIcon(file.name) + '</span><span class="fname" title="' + FSUtils.escapeHtml(file.name) + '">' + FSUtils.escapeHtml(file.name) + '</span></div></td>' +
            '<td class="size-cell">' + FSUtils.formatSize(file.size) + '</td>';
        const checkbox = row.querySelector('.row-check');
        const applyCheck = value => {
            if (value) selectedNames.add(file.name); else selectedNames.delete(file.name);
            checkbox.checked = value;
            row.classList.toggle('is-selected', value);
            updateSelected();
        };
        checkbox.addEventListener('change', () => applyCheck(checkbox.checked));
        row.addEventListener('click', event => {
            if (event.target !== checkbox) applyCheck(!checkbox.checked);
        });
        fileTableBody.appendChild(row);
    }
    fileCount.textContent = filter ? visible.length + ' / ' + cache.length + ' 个文件' : cache.length + ' 个文件';
    selectAllBtn.disabled = false;
    invertBtn.disabled = false;
    updateSelected();
}

function getSelectedNames() {
    return [...selectedNames];
}

selectAllBtn.addEventListener('click', () => {
    fileTableBody.querySelectorAll('.file-row').forEach(row => selectedNames.add(row.dataset.name));
    if (window.FSFiles) renderTableFromCache(window.FSFiles.fileCache);
});
invertBtn.addEventListener('click', () => {
    fileTableBody.querySelectorAll('.file-row').forEach(row => {
        if (selectedNames.has(row.dataset.name)) selectedNames.delete(row.dataset.name);
        else selectedNames.add(row.dataset.name);
    });
    if (window.FSFiles) renderTableFromCache(window.FSFiles.fileCache);
});
searchInput.addEventListener('input', () => {
    if (window.FSFiles) renderTableFromCache(window.FSFiles.fileCache);
});

function openAbout() {
    lastFocusedElement = document.activeElement;
    aboutModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => aboutModal.querySelector('[data-close-modal]').focus());
}
function closeAbout() {
    aboutModal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedElement) lastFocusedElement.focus();
}
aboutBtn.addEventListener('click', openAbout);
aboutModal.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeAbout));
aboutModal.addEventListener('mousedown', event => { if (event.target === aboutModal) closeAbout(); });
document.addEventListener('keydown', event => {
    if (aboutModal.hidden) return;
    if (event.key === 'Escape') closeAbout();
    if (event.key === 'Tab') {
        const focusable = [...aboutModal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled)')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

if (window.ENCRYPTED) {
    encState.textContent = '密钥保护';
    securityPill.classList.add('is-protected');
    resetKeyBtn.style.display = 'grid';
} else {
    encState.textContent = '连接开放';
}
resetKeyBtn.addEventListener('click', () => FSAuth.resetKey());
window.addEventListener('fs:key-reset', () => {
    if (window.ENCRYPTED) setFileViewState('locked', '访问密钥已清除', '刷新列表或执行文件操作时需要重新输入密钥', { label: '重新解锁', handler: () => FSFiles.refreshList() });
});

window.FSUI = {
    setUploadBusy,
    setUploadStatus,
    setUploadProgress,
    setFileViewState,
    renderTableFromCache,
    getSelectedNames,
    updateSelectedFiles
};
