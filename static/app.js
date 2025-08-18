let globalKey = '';
function getKey() { if (!window.ENCRYPTED) { return '0'; } if (!globalKey) { globalKey = prompt('请输入密钥：'); } return globalKey; }
function resetKey() { globalKey = ''; showToast('密钥已重置', 'warn'); }
// Toast
function showToast(msg, type = 'ok', timeout = 3200) { const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; document.getElementById('toastStack').appendChild(el); setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => el.remove(), 420); }, timeout); }
// Theme
const userPrefKey = 'fs_theme_pref';
let colorSchemeMQ = matchMedia('(prefers-color-scheme: dark)');
let mqListener = null;

function applyTheme(mode) {
    localStorage.setItem(userPrefKey, mode);
    if (mqListener && mode !== 'auto') {try { colorSchemeMQ.removeEventListener('change', mqListener); } catch (e) { try { colorSchemeMQ.removeListener(mqListener); } catch (e) { } }mqListener = null;}
    if (mode === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else if (mode === 'light') {
        document.documentElement.classList.remove('dark-mode');
    } else if (mode === 'auto') {
        if (colorSchemeMQ.matches) {document.documentElement.classList.add('dark-mode');} else {document.documentElement.classList.remove('dark-mode');}
        if (!mqListener) {
            mqListener = (e) => {if (e.matches) document.documentElement.classList.add('dark-mode'); else document.documentElement.classList.remove('dark-mode');};
            try { colorSchemeMQ.addEventListener('change', mqListener); } catch (e) { try { colorSchemeMQ.addListener(mqListener); } catch (e) { } }
        }
    }
    try {
        const btn = document.getElementById('themeBtn');
        if (btn) {
            const icons = { light: '☀️', dark: '🌙', auto: '🌗' };
            btn.textContent = icons[mode] || '🌗';
            btn.title = '切换主题（当前：' + (mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '自动') + '）';
        }
    } catch (e) { }
}
(function () {
    const saved = localStorage.getItem(userPrefKey);
    if (saved) {applyTheme(saved);} else {applyTheme('auto');}
})();

const themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', () => {
    const current = localStorage.getItem(userPrefKey) || 'auto';
    const order = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    applyTheme(next);
    showToast('主题：' + next, 'ok');
});

// 主题色调色板处理（主按钮 + 子菜单）
(function initPaletteMenu() {
    const menu = document.getElementById('themePaletteMenu');
    const mainBtn = document.getElementById('themeColorBtn');
    if (!menu || !mainBtn) return;
    const btns = [...menu.querySelectorAll('.palette-btn')];
    // 初始化按钮颜色与点击处理
    btns.forEach(b => {
        const c = b.getAttribute('data-color');
        b.style.background = c;
        b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            btns.forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            applyThemeColor(c);
            localStorage.setItem('fs_theme_color', c);
            // 关闭菜单（做个简单的过渡）
            menu.classList.remove('show');
            menu.classList.add('hide');
            setTimeout(() => { menu.style.display = 'none'; }, 180);
            showToast('主题色已设置: ' + c, 'ok', 1200);
        });
    });
    // 主按钮切换菜单显示
    mainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.style.display === 'block' && menu.classList.contains('show')) {
            menu.classList.remove('show'); menu.classList.add('hide');
            setTimeout(() => { menu.style.display = 'none'; }, 180);
        } else {
            menu.style.display = 'block';
            // small delay to allow transition classes
            requestAnimationFrame(() => { menu.classList.remove('hide'); menu.classList.add('show'); });
        }
    });
    // 点击页面任意处关闭菜单
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== mainBtn) {
            if (menu.style.display === 'block') {
                menu.classList.remove('show'); menu.classList.add('hide');
                setTimeout(() => { menu.style.display = 'none'; }, 180);
            }
        }
    });
    // 加载时应用已保存颜色并选中按钮
    const saved = localStorage.getItem('fs_theme_color');
    if (saved) {
        const match = btns.find(x => x.getAttribute('data-color') === saved);
        if (match) { match.classList.add('selected'); applyThemeColor(saved); }
    }
})();

// 生成和应用主题色的函数
function applyThemeColor(hex) {
    if (!hex || hex[0] !== '#') return;
    try {
        const rgb = hexToRgb(hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const primary = hex;
        
        // 优化色彩生成算法
        const primaryMid = hslToHex(hsl.h, clamp(hsl.s * 0.98, 0.4, 1), clamp(hsl.l * 1.1, 0.45, 0.7));
        const primaryDark = hslToHex(hsl.h, clamp(hsl.s * 1.1, 0.6, 1), clamp(hsl.l * 0.7, 0.2, 0.5));
        const primary2 = hslToHex(hsl.h, clamp(hsl.s * 0.8, 0.3, 1), clamp(hsl.l * 1.4, 0.7, 0.9));
        const primary3 = hslToHex(hsl.h, clamp(hsl.s * 0.9, 0.4, 1), clamp(hsl.l * 1.15, 0.55, 0.8));
        const rgbVals = `${parseInt(rgb.r)},${parseInt(rgb.g)},${parseInt(rgb.b)}`;
        
        // 生成更自然的背景渐变色
        const bgLight = hslToHex(hsl.h, clamp(hsl.s * 0.25, 0.1, 0.4), clamp(hsl.l * 2.2, 0.92, 0.98));
        const bgMid = hslToHex(hsl.h, clamp(hsl.s * 0.15, 0.05, 0.3), clamp(hsl.l * 1.8, 0.88, 0.95));
        const bgDark = hslToHex(hsl.h, clamp(hsl.s * 0.9, 0.4, 1), clamp(hsl.l * 0.25, 0.08, 0.3));
        const bgDarkMid = hslToHex(hsl.h, clamp(hsl.s * 0.7, 0.3, 1), clamp(hsl.l * 0.12, 0.04, 0.18));
        
        const root = document.documentElement.style;
        root.setProperty('--primary', primary);
        root.setProperty('--primary-mid', primaryMid);
        root.setProperty('--primary-dark', primaryDark);
        root.setProperty('--primary-2', primary2);
        root.setProperty('--primary-3', primary3);
        root.setProperty('--primary-rgb', rgbVals);
        root.setProperty('--grad', `linear-gradient(135deg, ${primary}, ${primary2})`);
        
        // 设置背景渐变变量
        root.setProperty('--bg-light', bgLight);
        root.setProperty('--bg-mid', bgMid);
        root.setProperty('--bg-dark', bgDark);
        root.setProperty('--bg-dark-mid', bgDarkMid);
        
        // 应用背景渐变
        document.body.style.background = `radial-gradient(circle at 20% 20%, ${bgLight} 0%, ${bgMid} 40%, ${bgMid} 100%)`;
        document.body.style.backgroundAttachment = 'fixed';
        
        // 深色模式下的背景
        const darkModeStyle = document.getElementById('dynamicDarkBg') || document.createElement('style');
        darkModeStyle.id = 'dynamicDarkBg';
        darkModeStyle.textContent = `.dark-mode body { background: radial-gradient(circle at 20% 20%, ${bgDark} 0%, ${bgDarkMid} 60%, ${bgDarkMid} 100%) !important; background-attachment: fixed !important; }`;
        if (!document.getElementById('dynamicDarkBg')) {
            document.head.appendChild(darkModeStyle);
        }
    } catch (e) { console.error('theme color apply error', e); }
}

// 色彩工具函数
function hexToRgb(hex) { const h = hex.replace('#', ''); const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16); const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255; return { r, g, b }; }
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h, s, l = (max + min) / 2; if (max === min) { h = s = 0; } else { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; } return { h: h * 360, s, l }; }
function hslToHex(h, s, l) { h /= 360; let r, g, b; if (s === 0) { r = g = b = l; } else { const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3); } const toHex = x => { const v = Math.round(x * 255).toString(16).padStart(2, '0'); return v; }; return `#${toHex(r)}${toHex(g)}${toHex(b)}`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// 在加载时应用已保存颜色
(function applySavedColorOnLoad() { 
    const saved = localStorage.getItem('fs_theme_color'); 
    if (saved) { 
        // 延迟一点应用，确保DOM完全加载
        setTimeout(() => {
            applyThemeColor(saved); 
            const menu = document.getElementById('themePaletteMenu');
            if (menu) { 
                const match = [...menu.querySelectorAll('.palette-btn')].find(x => x.getAttribute('data-color') === saved); 
                if (match) match.classList.add('selected'); 
            }
        }, 100);
    }
})();

// Elements
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
encState.textContent = window.ENCRYPTED ? '加密模式已启用' : '未加密模式';
if (window.ENCRYPTED) resetKeyBtn.style.display = 'inline-flex';
resetKeyBtn.onclick = resetKey;
// Drag&Drop
;['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
;['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); if (ev === 'drop') { handleFiles(e.dataTransfer.files); } dropZone.classList.remove('dragover'); }));
function handleFiles(list) {
    if (!list || !list.length) return; // 使用 DataTransfer 来安全赋值给 file input
    try {
        const dt = new DataTransfer();
        for (let i = 0; i < list.length; i++) { dt.items.add(list[i]); }
        fileInput.files = dt.files;
    } catch (e) {
        // 某些环境下可能不支持 DataTransfer，回退为提示
        showToast('浏览器不支持自动填充文件列表，请使用“浏览选择”', 'warn');
    }
    updateSelectedFiles();
    showToast('已选择 ' + list.length + ' 个文件', 'ok');
}

// 文件选择时更新显示
fileInput.addEventListener('change', () => { updateSelectedFiles(); });

function updateSelectedFiles() { const files = fileInput.files; const el = document.getElementById('selectedList'); if (!files || !files.length) { el.textContent = '未选择文件'; uploadBtn.disabled = false; return; } let total = 0; let names = []; for (let i = 0; i < files.length; i++) { names.push(files[i].name); total += files[i].size || 0; } el.textContent = '已选择 ' + files.length + ' 个 • 总大小：' + formatSize(total) + ' • ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' ...' : ''); uploadBtn.disabled = false; }
// Upload
uploadBtn.addEventListener('click', upload);
function upload() { const files = fileInput.files; if (!files.length) { showToast('请选择文件', 'warn'); return; } const form = new FormData(); for (let i = 0; i < files.length; i++) form.append('file', files[i]); const xhr = new XMLHttpRequest(); xhr.open('POST', '/upload'); const key = getKey(); if (!key) return; xhr.setRequestHeader('X-Secret-Key', key); let lastLoaded = 0, lastTime = Date.now(); progressWrap.style.display = 'block'; statusSpan.textContent = '准备上传'; xhr.upload.onprogress = function (e) { const now = Date.now(); if (e.lengthComputable && (now - lastTime >= 180 || e.loaded === e.total)) { const percent = (e.loaded / e.total) * 100; progressBar.value = percent; const dt = (now - lastTime) / 1000; const db = e.loaded - lastLoaded; const speed = db / dt; speedLine.textContent = (speed / 1024).toFixed(2) + ' KB/s'; const remain = e.total - e.loaded; etaLine.textContent = speed ? '剩余 ' + (remain / speed).toFixed(1) + 's' : ''; statusSpan.textContent = percent.toFixed(1) + '%'; lastLoaded = e.loaded; lastTime = now; } }; xhr.onload = function () { if (xhr.status === 200) { showToast('上传成功', 'ok'); statusSpan.textContent = '完成'; refreshList(); } else if (xhr.status === 401) { showToast('密钥错误', 'err'); resetKey(); } else { showToast('上传失败: ' + xhr.status, 'err'); statusSpan.textContent = '失败'; } }; xhr.onerror = function () { showToast('网络错误', 'err'); }; xhr.send(form); }
clearBtn.onclick = () => { progressBar.value = 0; progressWrap.style.display = 'none'; statusSpan.textContent = '待命'; speedLine.textContent = '0 KB/s'; etaLine.textContent = ''; };
// List
let fileCache = [];
function refreshList() { const key = getKey(); if (!key) return; fetch('/list', { headers: { 'X-Secret-Key': key } }).then(r => { if (r.status === 401) { showToast('密钥错误', 'err'); resetKey(); return refreshList(); } return r.json(); }).then(data => { if (!data) return; fileCache = data.files || []; renderTable(); lastRefresh.textContent = '刷新: ' + new Date().toLocaleTimeString(); showToast('列表已刷新', 'ok', 1800); }); }
refreshBtn.onclick = refreshList;
function renderTable() {
    const filter = searchInput.value.trim().toLowerCase(); fileTableBody.innerHTML = ''; let shown = 0; fileCache.forEach(f => {
        if (filter && !f.name.toLowerCase().includes(filter)) return; shown++; const tr = document.createElement('tr'); tr.dataset.name = f.name; tr.innerHTML = '<td><input type="checkbox" class="row-check"></td>' +
            '<td class="name-cell"><span class="file-icon">' + extIcon(f.name) + '</span><span class="fname">' + escapeHtml(f.name) + '</span></td>' +
            '<td>' + formatSize(f.size) + '</td>'; tr.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { const cb = tr.querySelector('input'); cb.checked = !cb.checked; tr.classList.toggle('selected', cb.checked); updateSelected(); } }); tr.querySelector('input').addEventListener('change', e => { tr.classList.toggle('selected', e.target.checked); updateSelected(); }); fileTableBody.appendChild(tr);
    }); fileCount.textContent = shown + ' / ' + fileCache.length; updateSelected();
}
function updateSelected() { const c = [...fileTableBody.querySelectorAll('.row-check:checked')].length; selectedCount.textContent = c + ' 已选'; }
selectAllBtn.onclick = () => { fileTableBody.querySelectorAll('.row-check').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); };
invertBtn.onclick = () => { fileTableBody.querySelectorAll('.row-check').forEach(cb => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }); };
searchInput.addEventListener('input', () => renderTable());
// Download
downloadSelBtn.onclick = downloadSelected;
function downloadSelected() { const key = getKey(); if (!key) return; const checks = [...fileTableBody.querySelectorAll('.row-check:checked')]; if (!checks.length) { showToast('请至少选择一个文件', 'warn'); return; } checks.forEach(cb => { const name = cb.closest('tr').dataset.name; window.open('/download?file=' + encodeURIComponent(name) + '&key=' + encodeURIComponent(key), '_blank'); }); showToast('开始下载 ' + checks.length + ' 个文件', 'ok'); }
// Utils
function escapeHtml(s) { return s.replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }
function formatSize(bytes) { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let n = bytes; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return n.toFixed(2) + ' ' + u[i]; }
function extIcon(name) { const ext = name.split('.').pop().toLowerCase(); if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'IMG'; if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'ARC'; if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'VID'; if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'AUD'; if (['pdf'].includes(ext)) return 'PDF'; if (['txt', 'md', 'log'].includes(ext)) return 'TXT'; if (['py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'bat'].includes(ext)) return 'SRC'; return ext.substring(0, 3).toUpperCase(); }
// About
aboutBtn.onclick = () => { showToast('简单文件服务器 · 保留上传/下载/列表功能', 'ok', 4000); };
// 密钥按钮
if (window.ENCRYPTED) { document.getElementById('resetKeyBtn').addEventListener('click', () => { resetKey(); }); }
// 初始加载
refreshList();
