import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import cgi
import argparse
import random
# 加密模式开关与一次性密钥
ENCRYPTED = False
SECRET_KEY = ''

class UploadHTTPRequestHandler(BaseHTTPRequestHandler):
    def _check_key(self):
        if not ENCRYPTED:
            return True
        key = self.headers.get('X-Secret-Key')
        if not key:
            import urllib.parse
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            key = params.get('key', [''])[0]
        return key == SECRET_KEY

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            html = """<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
<meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
<title>文件中心</title>
<link rel=\"icon\" href=\"data:,\">
<style>
:root { --radius:14px; --grad:linear-gradient(135deg,#4e54c8,#8f94fb); --grad-accent:linear-gradient(135deg,#11998e,#38ef7d); --danger:#ff4d4f; --warn:#faad14; --ok:#52c41a; --text:#1f2330; --muted:#6b7280; --bg:#f5f7fb; --card-bg:rgba(255,255,255,.75); --border:1px solid rgba(255,255,255,.35); --blur:18px; --shadow:0 4px 24px -4px rgba(0,0,0,.08),0 8px 40px -8px rgba(0,0,0,.08); --code:#1e293b; }
.dark-mode { --text:#e6eaf3; --muted:#94a3b8; --bg:#0f172a; --card-bg:rgba(30,41,59,.6); --border:1px solid rgba(148,163,184,.18); --shadow:0 8px 32px -4px rgba(0,0,0,.55); --code:#cbd5e1; }
* { box-sizing:border-box; }
html,body { height:100%; }
body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; background:radial-gradient(circle at 20% 20%, #e0e7ff 0%, #f5f7fb 40%, #f5f7fb 100%); color:var(--text); -webkit-font-smoothing: antialiased; transition:background .5s, color .4s; }
.dark-mode body { background:radial-gradient(circle at 20% 20%, #1e293b 0%, #0f172a 60%, #0f172a 100%); }
main { max-width:1080px; margin:40px auto; padding:32px 28px 40px; backdrop-filter:blur(var(--blur)); background:var(--card-bg); border:var(--border); border-radius:28px; box-shadow:var(--shadow); position:relative; overflow:hidden; }
main:before { content:''; position:absolute; inset:0; background:linear-gradient(120deg,rgba(255,255,255,.35),rgba(255,255,255,0)); pointer-events:none; mix-blend-mode:overlay; }
header { display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; margin-bottom:28px; }
.logo { font-size:clamp(1.35rem,2.2vw,1.9rem); font-weight:600; letter-spacing:.5px; background:var(--grad); -webkit-background-clip:text; color:transparent; display:flex; align-items:center; gap:10px; }
.badge { font-size:.65rem; padding:2px 6px; border-radius:20px; background:rgba(0,0,0,.08); color:var(--muted); font-weight:500; letter-spacing:.5px; }
.dark-mode .badge { background:rgba(255,255,255,.1); }
.actions { display:flex; gap:10px; flex-wrap:wrap; }
button, .btn { --btn-bg:#475569; --btn-bg-hover:#334155; font:600 14px/1 system-ui,-apple-system; padding:11px 18px; border-radius:12px; border:1px solid rgba(255,255,255,.15); cursor:pointer; background:var(--btn-bg); color:#fff; display:inline-flex; gap:8px; align-items:center; justify-content:center; position:relative; transition:.25s; letter-spacing:.3px; }
button:hover { background:var(--btn-bg-hover); box-shadow:0 4px 14px -4px rgba(0,0,0,.4); }
.btn-primary { --btn-bg:#4e54c8; --btn-bg-hover:#3d42a4; background:var(--grad); border:none; }
.btn-accent { --btn-bg:#11998e; --btn-bg-hover:#0e7f76; background:var(--grad-accent); border:none; }
.btn-outline { background:transparent; color:var(--text); border:1px solid rgba(99,102,241,.35); }
.btn-outline:hover { background:rgba(99,102,241,.08); }
.btn-ghost { background:transparent; color:var(--muted); border:1px solid transparent; }
.btn-ghost:hover { color:var(--text); background:rgba(148,163,184,.15); }
.dark-mode .btn-outline { color:#cbd5e1; }
input[type=file] { display:none; }
#selectLabel { --btn-bg:#6366f1; --btn-bg-hover:#4f46e5; }
.grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); align-items:start; }
.card { background:var(--card-bg); border:var(--border); border-radius:24px; padding:24px 22px 26px; position:relative; backdrop-filter:blur(var(--blur)); overflow:hidden; box-shadow:var(--shadow); }
.card h2 { margin:0 0 18px; font-size:1.05rem; font-weight:600; letter-spacing:.5px; display:flex; align-items:center; gap:8px; }
.drop-zone { border:2px dashed rgba(99,102,241,.45); border-radius:18px; padding:38px 24px; text-align:center; background:linear-gradient(160deg,rgba(99,102,241,.07),rgba(99,102,241,0)); transition:.35s; position:relative; }
.drop-zone.dragover { background:linear-gradient(140deg,rgba(99,102,241,.15),rgba(99,102,241,.06)); border-color:#6366f1; }
.drop-zone p { margin:0; font-size:.9rem; color:var(--muted); }
.progress-wrap { margin-top:18px; display:none; }
progress { width:100%; height:14px; -webkit-appearance:none; appearance:none; }
progress::-webkit-progress-bar { background:rgba(148,163,184,.25); border-radius:30px; overflow:hidden; }
progress::-webkit-progress-value { background:var(--grad); border-radius:30px; }
.meta-line { font-size:.72rem; margin-top:8px; color:var(--muted); letter-spacing:.5px; display:flex; justify-content:space-between; }
#status { font-weight:600; color:#6366f1; }
.table-container { max-height:370px; overflow:auto; border-radius:18px; border:1px solid rgba(148,163,184,.25); background:linear-gradient(135deg,rgba(255,255,255,.55),rgba(255,255,255,.35)); backdrop-filter:blur(10px); }
.dark-mode .table-container { background:linear-gradient(135deg,rgba(30,41,59,.7),rgba(30,41,59,.45)); }
.files-table { width:100%; border-collapse:collapse; font-size:.82rem; }
.files-table thead { position:sticky; top:0; background:rgba(255,255,255,.65); backdrop-filter:blur(10px); }
.dark-mode .files-table thead { background:rgba(30,41,59,.8); }
.files-table th, .files-table td { padding:10px 14px; text-align:left; white-space:nowrap; }
.files-table tbody tr { cursor:pointer; transition:.2s; }
.files-table tbody tr:hover { background:rgba(99,102,241,.12); }
.files-table tbody tr.selected { background:rgba(99,102,241,.2); }
.name-cell { display:flex; align-items:center; gap:8px; }
.file-icon { width:28px; height:28px; border-radius:10px; background:linear-gradient(135deg,#6366f1,#818cf8); display:flex; align-items:center; justify-content:center; font-size:12px; color:#fff; font-weight:600; letter-spacing:.5px; box-shadow:0 2px 8px -2px rgba(0,0,0,.4); }
.tag { display:inline-flex; align-items:center; font-size:.6rem; padding:3px 7px; border-radius:30px; background:rgba(99,102,241,.15); color:#6366f1; margin-left:4px; letter-spacing:.5px; }
.dark-mode .tag { background:rgba(99,102,241,.25); }
.toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; align-items:center; }
#search { flex:1; min-width:190px; background:rgba(148,163,184,.18); border:1px solid rgba(148,163,184,.3); padding:10px 14px; border-radius:12px; outline:none; color:var(--text); font-size:.8rem; backdrop-filter:blur(10px); transition:.25s; }
#search:focus { background:rgba(255,255,255,.55); border-color:#6366f1; }
.dark-mode #search { background:rgba(51,65,85,.6); }
footer { margin-top:40px; text-align:center; font-size:.68rem; color:var(--muted); letter-spacing:.5px; }
.toggle-theme { width:44px; padding:10px 0; }
.count { font-size:.7rem; color:var(--muted); margin-left:6px; }
.toast-stack { position:fixed; top:18px; right:18px; display:flex; flex-direction:column; gap:12px; z-index:999; }
.toast { min-width:200px; max-width:340px; background:var(--card-bg); border:var(--border); padding:12px 16px 14px; font-size:.75rem; backdrop-filter:blur(var(--blur)); border-radius:16px; box-shadow:var(--shadow); display:flex; gap:12px; align-items:flex-start; animation:fadeSlide .4s cubic-bezier(.4,.4,.2,1); position:relative; overflow:hidden; }
.toast:before { content:''; position:absolute; inset:0; background:linear-gradient(120deg,rgba(255,255,255,.4),rgba(255,255,255,0)); mix-blend-mode:overlay; pointer-events:none; }
.toast.ok { border-left:5px solid var(--ok); }
.toast.err { border-left:5px solid var(--danger); }
.toast.warn { border-left:5px solid var(--warn); }
@keyframes fadeSlide { from { opacity:0; transform:translateY(-8px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:linear-gradient(180deg,#818cf8,#6366f1); border-radius:8px; }
.dark-mode ::-webkit-scrollbar-thumb { background:linear-gradient(180deg,#475569,#334155); }
@media (max-width:780px){ main { margin:0; border-radius:0; min-height:100vh; } header { flex-direction:column; align-items:stretch; } .actions { width:100%; } .grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<main>
    <header>
        <div class=\"logo\">文件中心 <span class=\"badge\">v1</span></div>
        <div class=\"actions\">
            <button class=\"btn-outline toggle-theme\" id=\"themeBtn\" title=\"切换主题\">🌗</button>
            <button class=\"btn-outline\" id=\"resetKeyBtn\" style=\"display:none;\">重置密钥</button>
            <button class=\"btn-ghost\" id=\"aboutBtn\">关于</button>
        </div>
    </header>
    <section class=\"grid\">
        <div class=\"card\">
            <h2>上传文件</h2>
            <div class=\"drop-zone\" id=\"dropZone\">
                <p style=\"font-size:.8rem;margin-bottom:12px;\"><strong>拖拽文件</strong> 或 <label for=\"fileInput\" id=\"selectLabel\" class=\"btn btn-primary\">浏览选择</label></p>
                <p style=\"font-size:.65rem; letter-spacing:.5px;\">支持多文件，大小显示与进度跟踪</p>
                <input type=\"file\" id=\"fileInput\" multiple>
                <!-- 已选择文件信息 -->
                <div id="selectedList" style="margin-top:12px;font-size:.85rem;color:var(--muted);">未选择文件</div>
                <div class=\"meta-line\" style=\"margin-top:22px;\"><span>状态</span><span id=\"status\">待命</span></div>
                <div class=\"progress-wrap\" id=\"progressWrap\">
                    <progress id=\"progressBar\" value=\"0\" max=\"100\"></progress>
                    <div class=\"meta-line\"><span id=\"speedLine\">0 KB/s</span><span id=\"etaLine\"></span></div>
                </div>
            </div>
            <div style=\"display:flex; gap:12px; flex-wrap:wrap; margin-top:24px;\">
                <button class=\"btn-primary\" id=\"uploadBtn\">开始上传</button>
                <button class=\"btn-outline\" id=\"clearBtn\">清空进度</button>
            </div>
        </div>
        <div class=\"card\" style=\"position:relative;\">
            <h2 style=\"display:flex;align-items:center;gap:8px;\">文件列表 <span id=\"fileCount\" class=\"count\"></span></h2>
            <div class=\"toolbar\">
                <input id=\"search\" placeholder=\"搜索文件...\" autocomplete=\"off\">
                <button class=\"btn-outline\" id=\"selectAllBtn\">全选</button>
                <button class=\"btn-outline\" id=\"invertBtn\">反选</button>
                <button class=\"btn-accent\" id=\"downloadSelBtn\">下载所选</button>
                <button class=\"btn-outline\" id=\"refreshBtn\">刷新</button>
            </div>
            <div class=\"table-container\">
                <table class=\"files-table\" id=\"filesTable\">
                    <thead><tr><th style=\"width:40px;\"></th><th>文件名</th><th style=\"width:110px;\">大小</th></tr></thead>
                    <tbody id=\"fileTableBody\"></tbody>
                </table>
            </div>
            <div class=\"meta-line\" style=\"margin-top:14px;\"><span id=\"selectedCount\">0 已选</span><span id=\"lastRefresh\">--</span></div>
        </div>
    </section>
    <footer>界面增强版 · 保留原有上传/下载接口 · <span id=\"encState\"></span></footer>
</main>
<div class=\"toast-stack\" id=\"toastStack\"></div>
<script>
window.ENCRYPTED = {encrypted_status};
let globalKey = '';
function getKey(){ if(!window.ENCRYPTED){ return '0'; } if(!globalKey){ globalKey = prompt('请输入密钥：'); } return globalKey; }
function resetKey(){ globalKey=''; showToast('密钥已重置','warn'); }
// Toast
function showToast(msg,type='ok',timeout=3200){ const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg; document.getElementById('toastStack').appendChild(el); setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=>el.remove(),420); },timeout); }
// Theme
const userPrefKey='fs_theme_pref';
function applyTheme(mode){ if(mode==='dark'){ document.documentElement.classList.add('dark-mode'); } else { document.documentElement.classList.remove('dark-mode'); } }
(function(){ const saved=localStorage.getItem(userPrefKey); if(saved){ applyTheme(saved); } else { const mq=matchMedia('(prefers-color-scheme: dark)'); applyTheme(mq.matches?'dark':'light'); } })();
const themeBtn=document.getElementById('themeBtn'); themeBtn.addEventListener('click',()=>{ const dark=document.documentElement.classList.toggle('dark-mode'); localStorage.setItem(userPrefKey,dark?'dark':'light'); });
// Elements
const fileInput=document.getElementById('fileInput');
const uploadBtn=document.getElementById('uploadBtn');
const progressBar=document.getElementById('progressBar');
const progressWrap=document.getElementById('progressWrap');
const statusSpan=document.getElementById('status');
const speedLine=document.getElementById('speedLine');
const etaLine=document.getElementById('etaLine');
const dropZone=document.getElementById('dropZone');
const fileTableBody=document.getElementById('fileTableBody');
const fileCount=document.getElementById('fileCount');
const selectedCount=document.getElementById('selectedCount');
const lastRefresh=document.getElementById('lastRefresh');
const downloadSelBtn=document.getElementById('downloadSelBtn');
const refreshBtn=document.getElementById('refreshBtn');
const selectAllBtn=document.getElementById('selectAllBtn');
const invertBtn=document.getElementById('invertBtn');
const searchInput=document.getElementById('search');
const clearBtn=document.getElementById('clearBtn');
const resetKeyBtn=document.getElementById('resetKeyBtn');
const encState=document.getElementById('encState');
encState.textContent = window.ENCRYPTED ? '加密模式已启用' : '未加密模式';
if(window.ENCRYPTED) resetKeyBtn.style.display='inline-flex';
resetKeyBtn.onclick=resetKey;
// Drag&Drop
;['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
;['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{ e.preventDefault(); e.stopPropagation(); if(ev==='drop'){ handleFiles(e.dataTransfer.files); } dropZone.classList.remove('dragover'); }));
function handleFiles(list){ if(!list || !list.length) return; // 使用 DataTransfer 来安全赋值给 file input
    try{
        const dt = new DataTransfer();
        for(let i=0;i<list.length;i++){ dt.items.add(list[i]); }
        fileInput.files = dt.files;
    }catch(e){
        // 某些环境下可能不支持 DataTransfer，回退为提示
        showToast('浏览器不支持自动填充文件列表，请使用“浏览选择”', 'warn');
    }
    updateSelectedFiles();
    showToast('已选择 '+list.length+' 个文件','ok');
}

// 文件选择时更新显示
fileInput.addEventListener('change', ()=>{ updateSelectedFiles(); });

function updateSelectedFiles(){ const files = fileInput.files; const el = document.getElementById('selectedList'); if(!files || !files.length){ el.textContent = '未选择文件'; uploadBtn.disabled = false; return; } let total = 0; let names = []; for(let i=0;i<files.length;i++){ names.push(files[i].name); total += files[i].size || 0; } el.textContent = '已选择 '+files.length+' 个 • 总大小：'+formatSize(total) + ' • ' + names.slice(0,6).join(', ') + (names.length>6? ' ...':''); uploadBtn.disabled = false; }
// Upload
uploadBtn.addEventListener('click', upload);
function upload(){ const files=fileInput.files; if(!files.length){ showToast('请选择文件','warn'); return; } const form=new FormData(); for(let i=0;i<files.length;i++) form.append('file',files[i]); const xhr=new XMLHttpRequest(); xhr.open('POST','/upload'); const key=getKey(); if(!key) return; xhr.setRequestHeader('X-Secret-Key', key); let lastLoaded=0, lastTime=Date.now(); progressWrap.style.display='block'; statusSpan.textContent='准备上传'; xhr.upload.onprogress=function(e){ const now=Date.now(); if(e.lengthComputable && (now-lastTime>=180 || e.loaded===e.total)){ const percent=(e.loaded/e.total)*100; progressBar.value=percent; const dt=(now-lastTime)/1000; const db=e.loaded-lastLoaded; const speed=db/dt; speedLine.textContent=(speed/1024).toFixed(2)+' KB/s'; const remain=e.total-e.loaded; etaLine.textContent= speed? '剩余 '+(remain/speed).toFixed(1)+'s':''; statusSpan.textContent = percent.toFixed(1)+'%'; lastLoaded=e.loaded; lastTime=now; }}; xhr.onload=function(){ if(xhr.status===200){ showToast('上传成功','ok'); statusSpan.textContent='完成'; refreshList(); } else if(xhr.status===401){ showToast('密钥错误','err'); resetKey(); } else { showToast('上传失败: '+xhr.status,'err'); statusSpan.textContent='失败'; }}; xhr.onerror=function(){ showToast('网络错误','err'); }; xhr.send(form); }
clearBtn.onclick=()=>{ progressBar.value=0; progressWrap.style.display='none'; statusSpan.textContent='待命'; speedLine.textContent='0 KB/s'; etaLine.textContent=''; };
// List
let fileCache=[];
function refreshList(){ const key=getKey(); if(!key) return; fetch('/list',{ headers:{'X-Secret-Key':key} }).then(r=>{ if(r.status===401){ showToast('密钥错误','err'); resetKey(); return refreshList(); } return r.json(); }).then(data=>{ if(!data) return; fileCache=data.files||[]; renderTable(); lastRefresh.textContent='刷新: '+new Date().toLocaleTimeString(); showToast('列表已刷新','ok',1800); }); }
refreshBtn.onclick=refreshList;
function renderTable(){ const filter=searchInput.value.trim().toLowerCase(); fileTableBody.innerHTML=''; let shown=0; fileCache.forEach(f=>{ if(filter && !f.name.toLowerCase().includes(filter)) return; shown++; const tr=document.createElement('tr'); tr.dataset.name=f.name; tr.innerHTML='<td><input type="checkbox" class="row-check"></td>'+
'<td class="name-cell"><span class="file-icon">'+extIcon(f.name)+'</span><span class="fname">'+escapeHtml(f.name)+'</span></td>'+
'<td>'+formatSize(f.size)+'</td>'; tr.addEventListener('click',e=>{ if(e.target.tagName!== 'INPUT'){ const cb=tr.querySelector('input'); cb.checked=!cb.checked; tr.classList.toggle('selected',cb.checked); updateSelected(); }}); tr.querySelector('input').addEventListener('change',e=>{ tr.classList.toggle('selected',e.target.checked); updateSelected(); }); fileTableBody.appendChild(tr); }); fileCount.textContent = shown+' / '+fileCache.length; updateSelected(); }
function updateSelected(){ const c=[...fileTableBody.querySelectorAll('.row-check:checked')].length; selectedCount.textContent=c+' 已选'; }
selectAllBtn.onclick=()=>{ fileTableBody.querySelectorAll('.row-check').forEach(cb=>{ cb.checked=true; cb.dispatchEvent(new Event('change')); }); };
invertBtn.onclick=()=>{ fileTableBody.querySelectorAll('.row-check').forEach(cb=>{ cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); }); };
searchInput.addEventListener('input',()=>renderTable());
// Download
downloadSelBtn.onclick=downloadSelected;
function downloadSelected(){ const key=getKey(); if(!key) return; const checks=[...fileTableBody.querySelectorAll('.row-check:checked')]; if(!checks.length){ showToast('请至少选择一个文件','warn'); return; } checks.forEach(cb=>{ const name=cb.closest('tr').dataset.name; window.open('/download?file='+encodeURIComponent(name)+'&key='+encodeURIComponent(key),'_blank'); }); showToast('开始下载 '+checks.length+' 个文件','ok'); }
// Utils
function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\'':'&#39;'}[c])); }
function formatSize(bytes){ const u=['B','KB','MB','GB','TB']; let i=0; let n=bytes; while(n>=1024 && i<u.length-1){ n/=1024; i++; } return n.toFixed(2)+' '+u[i]; }
function extIcon(name){ const ext=name.split('.').pop().toLowerCase(); if(['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return 'IMG'; if(['zip','rar','7z','tar','gz'].includes(ext)) return 'ARC'; if(['mp4','mkv','avi','mov','webm'].includes(ext)) return 'VID'; if(['mp3','wav','flac','aac','ogg'].includes(ext)) return 'AUD'; if(['pdf'].includes(ext)) return 'PDF'; if(['txt','md','log'].includes(ext)) return 'TXT'; if(['py','js','ts','java','c','cpp','go','rs','sh','bat'].includes(ext)) return 'SRC'; return ext.substring(0,3).toUpperCase(); }
// About
aboutBtn.onclick=()=>{ showToast('简单文件服务器 · 保留上传/下载/列表功能','ok',4000); };
// 密钥按钮
if(window.ENCRYPTED){ document.getElementById('resetKeyBtn').addEventListener('click',()=>{ resetKey(); }); }
// 初始加载
refreshList();
</script>
</body>
</html>"""
            # 替换加密状态
            html = html.replace('{encrypted_status}', 'true' if ENCRYPTED else 'false')
            self.wfile.write(html.encode('utf-8'))
        elif self.path.startswith('/download'):
            if not self._check_key():
                self.send_error(401, 'Unauthorized, invalid key')
                return
            import urllib.parse
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            filename = params.get('file', [''])[0]
            if filename and os.path.isfile(filename):
                safe_path = os.path.abspath(filename)
                base_dir = os.path.abspath('.')
                if not safe_path.startswith(base_dir + os.sep) or not os.path.isfile(safe_path):
                    self.send_error(403, 'Access to the file is prohibited')
                    return
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                with open(filename, 'rb') as fp:
                    self.wfile.write(fp.read())
            else:
                self.send_error(404, 'File not found')
        elif self.path == '/list':
            if not self._check_key():
                self.send_error(401, 'Unauthorized, invalid key')
                return
            # 返回文件名和文件大小
            file_infos = []
            for f in os.listdir('.'):
                if os.path.isfile(f):
                    size = os.path.getsize(f)
                    file_infos.append({'name': f, 'size': size})
            import json
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'files': file_infos}).encode('utf-8'))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/upload':
            if not self._check_key():
                self.send_error(401, 'Unauthorized, invalid key')
                return
            ctype, pdict = cgi.parse_header(self.headers.get('Content-Type'))
            if ctype == 'multipart/form-data':
                pdict['boundary'] = pdict['boundary'].encode('utf-8')
                form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD':'POST'}, keep_blank_values=True)
                # 支持多个文件上传
                files = form['file']
                if not isinstance(files, list):
                    files = [files]
                for field_item in files:
                    filename = os.path.basename(field_item.filename)
                    with open(filename, 'wb') as f:
                        f.write(field_item.file.read())
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'OK')
            else:
                self.send_error(400, "Wrong Content-Type")
        else:
            self.send_error(404)

def run(server_class=HTTPServer, handler_class=UploadHTTPRequestHandler, port=80):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Serving on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='File upload and download server.')
    parser.add_argument('-p', '--port', type=int, default=80, help='Port to run the server on (default: 80)')
    parser.add_argument('-e', '--encrypted', action='store_true', help='Enable encryption mode and enter a one-time key to access')
    args = parser.parse_args()
    if args.encrypted:
        ENCRYPTED = True
        SECRET_KEY = f"{random.randint(1000, 9999):04d}"
        print(f"一次性密钥: {SECRET_KEY}")
    run(port=args.port)
