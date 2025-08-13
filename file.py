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
<html lang=\"zh-CN\">
<head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>文件上传</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f2f2f2; }
        .container { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        h1 { text-align: center; margin-bottom: 20px; font-size: 1.5rem; }
        input[type=file] { display: block; width: 100%; margin-bottom: 15px; }
        button { width: 100%; padding: 10px; font-size: 1rem; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        progress { width: 100%; height: 20px; margin-top: 20px; -webkit-appearance: none; appearance: none; }
        progress[value]::-webkit-progress-bar { background-color: #eee; border-radius: 4px; }
        progress[value]::-webkit-progress-value { background-color: #007bff; border-radius: 4px; }
        #status { display: block; text-align: center; margin-top: 10px; font-weight: bold; }
        @media (max-width: 480px) { h1 { font-size: 1.2rem; } button { font-size: 0.9rem; } }
    </style>
</head>
<body>
<div class=\"container py-5\">
    <h1 class=\"text-center mb-4\">上传文件</h1>
    <div class=\"mb-3\">
        <input type=\"file\" class=\"form-control form-control-lg\" id=\"fileInput\">
    </div>
    <div class=\"d-grid mb-3\">
        <button class=\"btn btn-primary btn-lg\" onclick=\"upload()\">上传</button>
    </div>
    <div class=\"mb-3\">
        <progress id=\"progressBar\" value=\"0\" max=\"100\"></progress>
    </div>
    <div class=\"text-center\">
        <span id=\"status\" class=\"fw-bold\"></span>
    </div>
</div>
<script>
        function upload() {
            const file = document.getElementById('fileInput').files[0];
            if (!file) return alert('请选择文件');
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload');
            let lastLoaded = 0;
            let lastTime = Date.now();
            xhr.upload.onprogress = function(event) {
                const now = Date.now();
                if (event.lengthComputable && (now - lastTime >= 250 || event.loaded === event.total)) {
                    const percent = (event.loaded / event.total) * 100;
                    document.getElementById('progressBar').value = percent;
                    const deltaTime = (now - lastTime) / 1000;
                    const deltaBytes = event.loaded - lastLoaded;
                    const speed = deltaBytes / deltaTime;
                    document.getElementById('status').textContent = (speed/1024).toFixed(2) + ' KB/s';
                    lastLoaded = event.loaded;
                    lastTime = now;
                }
            };
            xhr.onload = function() {
                if (xhr.status === 200) {
                    alert('上传成功');
                } else {
                    alert('上传失败: ' + xhr.status);
                }
            };
            const form = new FormData();
            form.append('file', file);
            xhr.send(form);
        }
</script>
</body>
</html>"""
            self.wfile.write(html.encode('utf-8'))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/upload':
            ctype, pdict = cgi.parse_header(self.headers.get('Content-Type'))
            if ctype == 'multipart/form-data':
                pdict['boundary'] = pdict['boundary'].encode('utf-8')
                form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD':'POST'}, keep_blank_values=True)
                field_item = form['file']
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
