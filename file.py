import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import cgi

class UploadHTTPRequestHandler(BaseHTTPRequestHandler):
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
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f2f2f2; }
        .container { background: #fff; padding: 20px; border-radius: 8px; max-width: 500px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { text-align: center; margin-bottom: 20px; font-size: 1.5rem;}
        input[type=file] { width: 100%; margin-bottom: 15px; }
        button { padding: 10px; margin: 5px 0; width: 100%; font-size: 1rem; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .btn-upload { background: #007bff; } .btn-upload:hover { background: #0056b3; }
        .btn-download { background: #28a745; } .btn-download:hover { background: #218838; }
        .btn-refresh { background: #17a2b8; } .btn-refresh:hover { background: #117a8b; }
        .file-list { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; margin-bottom: 10px; }
        .file-list li { display: flex; align-items: center; margin-bottom: 5px; }
        .file-checkbox { margin-right: 8px; }
        @media (max-width: 480px) { .container { padding: 10px; } button { font-size: 0.9rem; } }
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
    };
    xhr.onload = function() { if (xhr.status === 200) { alert('上传成功'); refreshList(); } else { alert('上传失败: ' + xhr.status); } };
    xhr.send(form);
}
function refreshList() {
    fetch('/list').then(response => response.json()).then(data => {
        const ul = document.getElementById('fileList'); ul.innerHTML = '';
        data.files.forEach(function(f) {
            const li = document.createElement('li');
            li.innerHTML = '<input type="checkbox" class="file-checkbox" value="' + f + '"><label>' + f + '</label>';
            ul.appendChild(li);
        });
    });
}
function downloadSelected() {
    const checks = document.querySelectorAll('.file-checkbox:checked');
    if (!checks.length) { alert('请选择要下载的文件'); return; }
    checks.forEach(function(cb) {
        window.open('/download?file=' + encodeURIComponent(cb.value), '_blank');
    });
}
window.onload = refreshList;
</script>
</body>
</html>"""
            self.wfile.write(html.encode('utf-8'))
        elif self.path.startswith('/download'):
            import urllib.parse
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            filename = params.get('file', [''])[0]
            if filename and os.path.isfile(filename):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                with open(filename, 'rb') as fp:
                    self.wfile.write(fp.read())
            else:
                self.send_error(404, '文件未找到')
        elif self.path == '/list':
            files = [f for f in os.listdir('.') if os.path.isfile(f)]
            import json
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'files': files}).encode('utf-8'))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/upload':
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
                self.send_error(400, "错误的Content-Type")
        else:
            self.send_error(404)

def run(server_class=HTTPServer, handler_class=UploadHTTPRequestHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Serving on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
