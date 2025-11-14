import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import cgi
import argparse
from pathlib import Path
import random
import sys
import urllib.parse
# 加密模式开关与一次性密钥
ENCRYPTED = False
SECRET_KEY = ''
CLASSIC_MODE = False

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    basepath = Path(sys._MEIPASS)
else:
    basepath = Path(__file__).resolve().parent

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

    def _stream_file(self, fp, start, end):
        try:
            fp.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk_size = min(8192, remaining)
                chunk = fp.read(chunk_size)
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            self.log_error('Client closed connection while streaming file.')
            return False
        return True

    def do_GET(self):
        if self.path == '/':
            # 返回静态 index.html
            try:
                if CLASSIC_MODE:
                    # 如果是经典模式，返回 classic.html
                    index_file = os.path.join(basepath, 'static', 'classic.html')
                else:
                    index_file = os.path.join(basepath, 'static', 'index.html')
                with open(index_file, 'rb') as fh:
                    data = fh.read()
                # 替换一次性密钥
                data = data.decode('utf-8').replace('{encrypted_status}', 'true' if ENCRYPTED else 'false')
                self.send_response(200)
                self.send_header('Content-type','text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'Error reading index: {e}')
            return
        elif self.path.startswith('/static/'):
            # 简单静态文件服务
            safe_path = os.path.normpath(self.path.lstrip('/'))
            full_path = os.path.join(basepath, safe_path)
            if not os.path.isfile(full_path):
                self.send_error(404, 'Not found')
                return
            # 简单 MIME 映射
            mime = 'application/octet-stream'
            if full_path.endswith('.css'):
                mime = 'text/css; charset=utf-8'
            elif full_path.endswith('.js'):
                mime = 'application/javascript; charset=utf-8'
            elif full_path.endswith('.html'):
                mime = 'text/html; charset=utf-8'
            elif full_path.endswith('.map'):
                mime = 'application/json; charset=utf-8'
            try:
                with open(full_path, 'rb') as fh:
                    data = fh.read()
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(500, f'Error reading static: {e}')
            return
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
                
                # 获取文件大小
                file_size = os.path.getsize(filename)
                
                # 处理 Range 请求（断点续传支持）
                range_header = self.headers.get('Range')
                if range_header:
                    # 解析 Range 头，格式: bytes=start-end
                    try:
                        range_match = range_header.replace('bytes=', '').split('-')
                        start = int(range_match[0]) if range_match[0] else 0
                        end = int(range_match[1]) if range_match[1] else file_size - 1
                        
                        if start >= file_size or end >= file_size or start > end:
                            self.send_error(416, 'Range Not Satisfiable')
                            return
                        
                        content_length = end - start + 1
                        
                        self.send_response(206)  # Partial Content
                        self.send_header('Content-Type', 'application/octet-stream')
                        self.send_header('Content-Disposition', f'attachment; filename*=UTF-8\'\'{urllib.parse.quote(filename.encode("utf-8"))}')
                        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                        self.send_header('Content-Length', str(content_length))
                        self.send_header('Accept-Ranges', 'bytes')
                        self.end_headers()
                        
                        with open(filename, 'rb') as fp:
                            self._stream_file(fp, start, end)
                    except (ValueError, IndexError):
                        self.send_error(400, 'Invalid Range header')
                        return
                else:
                    # 正常下载（无 Range 请求）
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Disposition', f'attachment; filename*=UTF-8\'\'{urllib.parse.quote(filename.encode("utf-8"))}')
                    self.send_header('Content-Length', str(file_size))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.end_headers()
                    
                    with open(filename, 'rb') as fp:
                        self._stream_file(fp, 0, file_size - 1)
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

    def do_HEAD(self):
        # 支持 HEAD 请求，主要用于文件下载预检
        if self.path.startswith('/download'):
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
                # 获取文件大小
                file_size = os.path.getsize(filename)
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename*=UTF-8\'\'{urllib.parse.quote(filename.encode("utf-8"))}')
                self.send_header('Content-Length', str(file_size))
                self.send_header('Accept-Ranges', 'bytes')  # 重要：告诉客户端支持断点续传
                self.end_headers()
            else:
                self.send_error(404, 'File not found')

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
    print(f"Serving on {url}")

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
    parser.add_argument('-c', '--classic', action='store_true', help='Enable classic mode and use classic.html as the homepage')
    args = parser.parse_args()
    if args.encrypted:
        ENCRYPTED = True
        SECRET_KEY = f"{random.randint(1000, 9999):04d}"
        print(f"一次性密钥: {SECRET_KEY}")
    if args.classic:
        CLASSIC_MODE = True
        print("Classic mode enabled: serving classic.html as homepage")
    run(port=args.port)
