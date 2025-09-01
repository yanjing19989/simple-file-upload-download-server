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
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>文件上传与下载</title>
    <style>
        /* 主题色变量 */
        :root {
            --bg-color: #f2f2f2;
            --container-bg: #fff;
            --text-color: #000;
            --btn-upload-bg: #007bff;
            --btn-upload-hover: #0056b3;
            --btn-download-bg: #28a745;
            --btn-download-hover: #218838;
            --btn-refresh-bg: #17a2b8;
            --btn-refresh-hover: #117a8b;
        }
        .dark-mode {
            --bg-color: #1e1e1e;
            --container-bg: #2e2e2e;
            --text-color: #ddd;
            --btn-upload-bg: #007bff;
            --btn-upload-hover: #0056b3;
            --btn-download-bg: #28a745;
            --btn-download-hover: #218838;
            --btn-refresh-bg: #17a2b8;
            --btn-refresh-hover: #117a8b;
        }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: var(--bg-color); color: var(--text-color);}
        .container {  background: var(--container-bg); color: var(--text-color); padding: 20px; border-radius: 8px; max-width: 500px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        button.btn-upload { background: var(--btn-upload-bg); }
        button.btn-upload:hover { background: var(--btn-upload-hover); }
        button.btn-download { background: var(--btn-download-bg); }
        button.btn-download:hover { background: var(--btn-download-hover); }
        button.btn-refresh { background: var(--btn-refresh-bg); }
        button.btn-refresh:hover { background: var(--btn-refresh-hover); }
        h1 { text-align: center; margin-bottom: 20px; font-size: 1.5rem;}
        input[type=file] { width: 100%; margin-bottom: 15px; font-size: 1rem;}
        button { padding: 10px; margin: 5px 0; width: 100%; font-size: 1rem; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .file-list { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; margin-bottom: 10px; }
        .file-list li { display: flex; align-items: center; margin-bottom: 5px; }
        .file-checkbox { margin-right: 8px; }
        @media (max-width: 480px) { .container { padding: 10px; } button { font-size: 1rem; } }
    </style>
</head>
<body>
<div class="container">
    <h1>上传文件</h1>
    <input type="file" id="fileInput" multiple>
    <button class="btn-upload" onclick="upload()">上传</button>
    <progress id="progressBar" value="0" max="100" style="width:100%;display:none;margin-top:10px;"></progress>
    <span id="status" style="display:block;text-align:center;margin-top:5px;"></span>
    <h1>下载文件</h1>
    <ul id="fileList" class="file-list"></ul>
    <button class="btn-download" onclick="downloadSelected()">下载所选</button>
    <button class="btn-refresh" onclick="refreshList()">刷新列表</button>
</div>
<script>

function formatSize(bytes) {
    const units = ['B','KB','MB','GB','TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return bytes.toFixed(2) + ' ' + units[i];
}

window.ENCRYPTED = {encrypted_status};
let globalKey = '';

function getKey() {
    if (!window.ENCRYPTED) {
        return '0';
    }
    if (!globalKey) {
        globalKey = prompt('请输入密钥：');
    }
    return globalKey;
}

function resetKey() {
    globalKey = '';
}
function upload() {
    const files = document.getElementById('fileInput').files;
    if (!files.length) { alert('请选择文件'); return; }
    const form = new FormData();
    for (let i = 0; i < files.length; i++) { form.append('file', files[i]); }
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/upload');
    let lastLoaded = 0, lastTime = Date.now();
    xhr.upload.onprogress = function(event) {
        const now = Date.now();
        if (event.lengthComputable && (now - lastTime >= 250 || event.loaded === event.total)) {
            document.getElementById('progressBar').style.display = 'block';
            const percent = (event.loaded / event.total) * 100;
            document.getElementById('progressBar').value = percent;
            const deltaTime = (now - lastTime) / 1000;
            const deltaBytes = event.loaded - lastLoaded;
            document.getElementById('status').textContent = (deltaBytes / deltaTime / 1024).toFixed(2) + ' KB/s';
            lastLoaded = event.loaded; lastTime = now;
        }
    };    xhr.onload = function() { 
        if (xhr.status === 200) { 
            alert('上传成功'); 
            refreshList(); 
        } else if (xhr.status === 401) {
            alert('密钥错误，请重新输入');
            resetKey();
        } else { 
            alert('上传失败: ' + xhr.status); 
        } 
    };
    const key = getKey();
    if (!key) return;
    xhr.setRequestHeader('X-Secret-Key', key);
    xhr.send(form);
}
function refreshList() {
    const key = getKey();
    if (!key) return;
    fetch('/list', { headers: { 'X-Secret-Key': key } })
    .then(response => {
        if (response.status === 401) {
            alert('密钥错误，请重新输入');
            resetKey();
            return refreshList();
        }
        return response.json();
    })
    .then(data => {
        const ul = document.getElementById('fileList'); ul.innerHTML = '';
        data.files.forEach(function(f) {
            const li = document.createElement('li');
            // 文件名称与大小
            li.innerHTML = '<input type="checkbox" class="file-checkbox" value="' + f.name + '">' +
                           '<label style="flex:1;cursor:pointer;">' + f.name + '</label>' +
                           '<span style="margin-left:16px;">' + formatSize(f.size) + '</span>';
            // 点击行触发复选框
            li.addEventListener('click', function(e) {
                if (e.target.tagName !== 'INPUT') {
                    const cb = this.querySelector('input');
                    cb.checked = !cb.checked;
                }
            });
            ul.appendChild(li);
        });
    });
}
function downloadSelected() {
    const checks = document.querySelectorAll('.file-checkbox:checked');
    if (!checks.length) { alert('请选择要下载的文件'); return; }
    const key = getKey();
    if (!key) return;
    checks.forEach(function(cb) {
        window.open('/download?file=' + encodeURIComponent(cb.value) + '&key=' + encodeURIComponent(key), '_blank');
    });
}

window.addEventListener('DOMContentLoaded', () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function handleThemeChange(e) {
        if (e.matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
    handleThemeChange(mediaQuery);
    mediaQuery.addEventListener('change', handleThemeChange);
});

window.onload = refreshList;
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
    import socket
    host_ip = socket.gethostbyname(socket.gethostname())
    url = f"http://{host_ip}:{port}/"
    print(f"Serving on {host_ip}:{port}")

    try:
        import qrcode
        # qrcode 支持在终端打印 ASCII（利用 terminal module）
        qr = qrcode.QRCode()
        qr.add_data(url)
        qr.make()
        qr.print_ascii(invert=True)
    except Exception:
        # 如果 qrcode 无法直接打印，生成并打印基本字符串
        print(url)

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
