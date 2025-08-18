// UI 辅助：Toast、元素引用、拖放与选择展示
function showToast(msg, type = 'ok', timeout = 3200) { const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; document.getElementById('toastStack').appendChild(el); setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => el.remove(), 420); }, timeout); }

// 元素绑定（部分可能在 DOMContentLoaded 前未就绪，建议在 footer 前加载或确保 DOM 已加载）
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progressBar');
const progressWrap = document.getElementById('progressWrap');
const statusSpan = document.getElementById('status');
const speedLine = document.getElementById('speedLine');
const etaLine = document.getElementById('etaLine');
const dropZone = document.getElementById('dropZone');
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
const aboutBtn = document.getElementById('aboutBtn');

if (encState) encState.textContent = window.ENCRYPTED ? '加密模式已启用' : '未加密模式';
if (window.ENCRYPTED && resetKeyBtn) resetKeyBtn.style.display = 'inline-flex';
if (resetKeyBtn) resetKeyBtn.onclick = () => { if (window.FSAuth) window.FSAuth.resetKey(); };

// Drag & Drop
;['dragenter','dragover'].forEach(ev => dropZone && dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
;['dragleave','drop'].forEach(ev => dropZone && dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); if (ev === 'drop') { handleFiles(e.dataTransfer.files); } dropZone.classList.remove('dragover'); }));

function handleFiles(list) {
    if (!list || !list.length) return;
    try {
        const dt = new DataTransfer();
        for (let i = 0; i < list.length; i++) dt.items.add(list[i]);
        fileInput.files = dt.files;
    } catch (e) {
        showToast('浏览器不支持自动填充文件列表，请使用“浏览选择”', 'warn');
    }
    updateSelectedFiles();
    showToast('已选择 ' + list.length + ' 个文件', 'ok');
}

fileInput && fileInput.addEventListener('change', () => { updateSelectedFiles(); });

function updateSelectedFiles() {
    const files = fileInput.files;
    const el = document.getElementById('selectedList');
    if (!files || !files.length) { el && (el.textContent = '未选择文件'); uploadBtn && (uploadBtn.disabled = false); return; }
    let total = 0; let names = [];
    for (let i = 0; i < files.length; i++) { names.push(files[i].name); total += files[i].size || 0; }
    el.textContent = '已选择 ' + files.length + ' 个 • 总大小：' + FSUtils.formatSize(total) + ' • ' + names.slice(0,6).join(', ') + (names.length > 6 ? ' ...' : '');
    uploadBtn && (uploadBtn.disabled = false);
}

aboutBtn && aboutBtn.addEventListener('click', () => { showToast('简单文件服务器 · 保留上传/下载/列表功能', 'ok', 4000); });

clearBtn && (clearBtn.onclick = () => { progressBar && (progressBar.value = 0); progressWrap && (progressWrap.style.display = 'none'); statusSpan && (statusSpan.textContent = '待命'); speedLine && (speedLine.textContent = '0 KB/s'); etaLine && (etaLine.textContent = ''); });

// 选择、搜索、表格交互
function renderTableFromCache(fileCache) {
    const filter = (searchInput && searchInput.value.trim().toLowerCase()) || '';
    fileTableBody && (fileTableBody.innerHTML = '');
    let shown = 0;
    (fileCache||[]).forEach(f => {
        if (filter && !f.name.toLowerCase().includes(filter)) return;
        shown++;
        const tr = document.createElement('tr');
        tr.dataset.name = f.name;
        tr.innerHTML = '<td><input type="checkbox" class="row-check"></td>' +
            '<td class="name-cell"><span class="file-icon">' + FSUtils.extIcon(f.name) + '</span><span class="fname">' + FSUtils.escapeHtml(f.name) + '</span></td>' +
            '<td>' + FSUtils.formatSize(f.size) + '</td>';
        tr.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { const cb = tr.querySelector('input'); cb.checked = !cb.checked; tr.classList.toggle('selected', cb.checked); updateSelected(); } });
        tr.querySelector('input').addEventListener('change', e => { tr.classList.toggle('selected', e.target.checked); updateSelected(); });
        fileTableBody.appendChild(tr);
    });
    fileCount && (fileCount.textContent = shown + ' / ' + (fileCache||[]).length);
    updateSelected();
}
function updateSelected() { const c = fileTableBody ? [...fileTableBody.querySelectorAll('.row-check:checked')].length : 0; selectedCount && (selectedCount.textContent = c + ' 已选'); }
selectAllBtn && (selectAllBtn.onclick = () => { fileTableBody.querySelectorAll('.row-check').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); });
invertBtn && (invertBtn.onclick = () => { fileTableBody.querySelectorAll('.row-check').forEach(cb => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }); });
searchInput && searchInput.addEventListener('input', () => { /* render will be called by files module when fileCache updated, but support local filter */ if (window.FSFiles && window.FSFiles.fileCache) renderTableFromCache(window.FSFiles.fileCache); });

// 下载所选
downloadSelBtn && (downloadSelBtn.onclick = () => { if (window.FSFiles) window.FSFiles.downloadSelected(); });

