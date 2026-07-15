import argparse
import cgi
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import sys
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath


ENCRYPTED = False
SECRET_KEY = ''
CLASSIC_MODE = False
STREAM_CHUNK_SIZE = 64 * 1024
UPLOAD_COPY_CHUNK_SIZE = 1024 * 1024

if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    basepath = Path(sys._MEIPASS)
else:
    basepath = Path(__file__).resolve().parent


class RangeSyntaxError(ValueError):
    pass


class RangeNotSatisfiable(ValueError):
    pass


class FileServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class UploadHTTPRequestHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    storage_root = Path.cwd().resolve()
    static_root = (basepath / 'static').resolve()
    encrypted = None
    secret_key = None
    classic_mode = None

    def _is_encrypted(self):
        return ENCRYPTED if self.encrypted is None else self.encrypted

    def _secret_key(self):
        return SECRET_KEY if self.secret_key is None else self.secret_key

    def _is_classic(self):
        return CLASSIC_MODE if self.classic_mode is None else self.classic_mode

    def _parsed_url(self):
        return urllib.parse.urlsplit(self.path)

    def _check_key(self):
        if not self._is_encrypted():
            return True
        key = self.headers.get('X-Secret-Key')
        if not key:
            query = urllib.parse.parse_qs(
                self._parsed_url().query, keep_blank_values=True
            )
            key = query.get('key', [''])[0]
        return hmac.compare_digest(str(key), str(self._secret_key()))

    def _require_key(self):
        if self._check_key():
            return True
        # A rejected POST may still have an unread multipart body. Closing the
        # HTTP/1.1 connection prevents those bytes becoming the next request.
        self.close_connection = True
        self.send_error(401, 'Unauthorized, invalid key')
        return False

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    @staticmethod
    def _redact_log_value(value):
        if not isinstance(value, str):
            return value
        return re.sub(r'([?&]key=)[^&\s]+', r'\1***', value)

    def log_message(self, format_string, *args):
        redacted = tuple(self._redact_log_value(value) for value in args)
        super().log_message(format_string, *redacted)

    def _send_headers(
        self,
        status,
        content_length,
        content_type=None,
        cache_control='no-store',
        extra_headers=None,
    ):
        self.send_response(status)
        if content_type:
            self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(content_length))
        if cache_control:
            self.send_header('Cache-Control', cache_control)
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()

    def _send_bytes(
        self,
        status,
        payload=b'',
        content_type='text/plain; charset=utf-8',
        cache_control='no-store',
        extra_headers=None,
        head_only=False,
    ):
        self._send_headers(
            status,
            len(payload),
            content_type,
            cache_control,
            extra_headers,
        )
        if payload and not head_only:
            self.wfile.write(payload)

    def _send_json(self, value, status=200):
        payload = json.dumps(
            value, ensure_ascii=False, separators=(',', ':')
        ).encode('utf-8')
        self._send_bytes(
            status,
            payload,
            'application/json; charset=utf-8',
        )

    def _stream_file(self, file_object, start, length):
        try:
            file_object.seek(start)
            remaining = length
            while remaining > 0:
                chunk = file_object.read(min(STREAM_CHUNK_SIZE, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            self.log_error('Client closed connection while streaming file.')
            return False
        return True

    @staticmethod
    def _parse_range_header(header, file_size):
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
        if not match:
            raise RangeSyntaxError('Invalid Range header')
        start_text, end_text = match.groups()
        if not start_text and not end_text:
            raise RangeSyntaxError('Invalid Range header')
        if file_size <= 0:
            raise RangeNotSatisfiable('Empty file has no satisfiable range')

        if start_text:
            start = int(start_text)
            if start >= file_size:
                raise RangeNotSatisfiable('Range start exceeds file size')
            if end_text:
                end = int(end_text)
                if end < start:
                    raise RangeNotSatisfiable('Range end precedes start')
                end = min(end, file_size - 1)
            else:
                end = file_size - 1
        else:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                raise RangeNotSatisfiable('Invalid suffix range')
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        return start, end

    def _safe_static_path(self, request_path):
        decoded = urllib.parse.unquote(request_path)
        if not decoded.startswith('/static/'):
            return None
        relative = PurePosixPath(decoded[len('/static/'):])
        if not relative.parts or '..' in relative.parts:
            return None
        candidate = self.static_root.joinpath(*relative.parts).resolve()
        try:
            candidate.relative_to(self.static_root)
        except ValueError:
            return None
        return candidate if candidate.is_file() else None

    def _resolve_shared_file(self, filename):
        if not filename or '\x00' in filename:
            return None
        normalized = filename.replace('\\', '/')
        if normalized != normalized.rsplit('/', 1)[-1]:
            raise PermissionError('Nested paths are not allowed')
        candidate = self.storage_root / normalized
        resolved = candidate.resolve()
        if resolved.parent != self.storage_root:
            raise PermissionError('File is outside the shared directory')
        return resolved if resolved.is_file() else None

    @staticmethod
    def _content_type(path):
        mime, _ = mimetypes.guess_type(str(path))
        mime = mime or 'application/octet-stream'
        if mime.startswith('text/') or mime in {
            'application/javascript',
            'application/json',
        }:
            return mime + '; charset=utf-8'
        return mime

    @staticmethod
    def _etag(stat_result):
        value = f'{stat_result.st_mtime_ns}:{stat_result.st_size}'.encode()
        return '"' + hashlib.sha256(value).hexdigest()[:24] + '"'

    def _send_static(self, request_path, head_only=False):
        path = self._safe_static_path(request_path)
        if path is None:
            self.send_error(404, 'Not found')
            return
        try:
            stat_result = path.stat()
            etag = self._etag(stat_result)
            headers = {'ETag': etag}
            if self.headers.get('If-None-Match') == etag:
                self._send_headers(
                    304, 0, cache_control='no-cache', extra_headers=headers
                )
                return
            self._send_headers(
                200,
                stat_result.st_size,
                self._content_type(path),
                'no-cache',
                headers,
            )
            if not head_only:
                with path.open('rb') as file_object:
                    self._stream_file(file_object, 0, stat_result.st_size)
        except OSError as error:
            self.log_error('Static file error: %s', error)
            self.send_error(500, 'Unable to read static file')

    def _send_index(self, head_only=False):
        filename = 'classic.html' if self._is_classic() else 'index.html'
        path = self.static_root / filename
        try:
            payload = path.read_text(encoding='utf-8').replace(
                '{encrypted_status}',
                'true' if self._is_encrypted() else 'false',
            ).encode('utf-8')
        except OSError as error:
            self.log_error('Index file error: %s', error)
            self.send_error(500, 'Unable to read index')
            return
        self._send_bytes(
            200,
            payload,
            'text/html; charset=utf-8',
            head_only=head_only,
        )

    def _send_download(self, head_only=False):
        if not self._require_key():
            return
        params = urllib.parse.parse_qs(
            self._parsed_url().query, keep_blank_values=True
        )
        filename = params.get('file', [''])[0]
        try:
            path = self._resolve_shared_file(filename)
        except (OSError, PermissionError):
            self.send_error(403, 'Access to the file is prohibited')
            return
        if path is None:
            self.send_error(404, 'File not found')
            return

        try:
            file_size = path.stat().st_size
            start, end = 0, file_size - 1
            status = 200
            range_header = self.headers.get('Range') if not head_only else None
            if range_header:
                try:
                    start, end = self._parse_range_header(
                        range_header, file_size
                    )
                    status = 206
                except RangeSyntaxError:
                    self.send_error(400, 'Invalid Range header')
                    return
                except RangeNotSatisfiable:
                    self._send_bytes(
                        416,
                        extra_headers={
                            'Content-Range': f'bytes */{file_size}',
                            'Accept-Ranges': 'bytes',
                        },
                        head_only=head_only,
                    )
                    return

            content_length = max(0, end - start + 1)
            quoted_name = urllib.parse.quote(path.name, safe='')
            headers = {
                'Accept-Ranges': 'bytes',
                'Content-Disposition': (
                    "attachment; filename*=UTF-8''" + quoted_name
                ),
            }
            if status == 206:
                headers['Content-Range'] = (
                    f'bytes {start}-{end}/{file_size}'
                )
            self._send_headers(
                status,
                content_length,
                'application/octet-stream',
                'no-store',
                headers,
            )
            if not head_only and content_length:
                with path.open('rb') as file_object:
                    self._stream_file(file_object, start, content_length)
        except OSError as error:
            self.log_error('Download error: %s', error)
            self.send_error(500, 'Unable to read file')

    def _send_file_list(self):
        if not self._require_key():
            return
        files = []
        try:
            for entry in self.storage_root.iterdir():
                try:
                    resolved = entry.resolve()
                    if resolved.parent != self.storage_root:
                        continue
                    if resolved.is_file():
                        metadata = resolved.stat()
                        files.append({
                            'name': entry.name,
                            'size': metadata.st_size,
                            'modified': metadata.st_mtime_ns // 1_000_000,
                        })
                except OSError:
                    continue
        except OSError as error:
            self.log_error('List error: %s', error)
            self.send_error(500, 'Unable to list files')
            return
        self._send_json({'files': files})

    @staticmethod
    def _upload_filename(value):
        if not value or '\x00' in value:
            return None
        filename = value.replace('\\', '/').rsplit('/', 1)[-1]
        return None if filename in {'', '.', '..'} else filename

    def _handle_upload(self):
        if not self._require_key():
            return
        content_type = self.headers.get('Content-Type', '')
        media_type, parameters = cgi.parse_header(content_type)
        if media_type != 'multipart/form-data' or not parameters.get('boundary'):
            self.close_connection = True
            self.send_error(400, 'Wrong Content-Type')
            return

        environment = {
            'REQUEST_METHOD': 'POST',
            'CONTENT_TYPE': content_type,
            'CONTENT_LENGTH': self.headers.get('Content-Length', ''),
        }
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ=environment,
                keep_blank_values=True,
            )
            if 'file' not in form:
                self.send_error(400, 'Missing file field')
                return
            items = form['file']
            if not isinstance(items, list):
                items = [items]
            if not items:
                self.send_error(400, 'Missing file field')
                return

            with tempfile.TemporaryDirectory(
                prefix='.sfs-upload-', dir=self.storage_root
            ) as temporary_directory:
                prepared = []
                for index, item in enumerate(items):
                    filename = self._upload_filename(item.filename)
                    if filename is None or item.file is None:
                        self.send_error(400, 'Invalid upload filename')
                        return
                    temporary_path = (
                        Path(temporary_directory) / f'upload-{index}.tmp'
                    )
                    with temporary_path.open('wb') as destination:
                        item.file.seek(0)
                        shutil.copyfileobj(
                            item.file,
                            destination,
                            length=UPLOAD_COPY_CHUNK_SIZE,
                        )
                    prepared.append(
                        (temporary_path, self.storage_root / filename)
                    )
                for temporary_path, destination in prepared:
                    os.replace(temporary_path, destination)
        except (BrokenPipeError, ConnectionResetError):
            self.log_error('Client closed connection while uploading.')
            return
        except (EOFError, OSError, ValueError, TypeError) as error:
            self.log_error('Upload error: %s', error)
            self.send_error(500, 'Unable to save upload')
            return

        self._send_bytes(200, b'OK')

    def do_GET(self):
        path = self._parsed_url().path
        if path == '/':
            self._send_index()
        elif path.startswith('/static/'):
            self._send_static(path)
        elif path == '/download':
            self._send_download()
        elif path == '/list':
            self._send_file_list()
        else:
            self.send_error(404)

    def do_HEAD(self):
        path = self._parsed_url().path
        if path == '/':
            self._send_index(head_only=True)
        elif path.startswith('/static/'):
            self._send_static(path, head_only=True)
        elif path == '/download':
            self._send_download(head_only=True)
        else:
            self.send_error(404)

    def do_POST(self):
        if self._parsed_url().path == '/upload':
            self._handle_upload()
        else:
            self.close_connection = True
            self.send_error(404)


def run(server_class=FileServer, handler_class=UploadHTTPRequestHandler, port=80):
    handler_class.storage_root = Path.cwd().resolve()
    handler_class.static_root = (basepath / 'static').resolve()
    httpd = server_class(('', port), handler_class)
    try:
        host_ip = socket.gethostbyname(socket.gethostname())
    except OSError:
        host_ip = '127.0.0.1'
    url = f'http://{host_ip}:{port}/'
    print(f'Serving on {url}')

    try:
        import qrcode

        qr = qrcode.QRCode()
        qr.add_data(url)
        qr.make()
        qr.print_ascii(invert=True)
    except Exception:
        print(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='File upload and download server.'
    )
    parser.add_argument(
        '-p',
        '--port',
        type=int,
        default=80,
        help='Port to run the server on (default: 80)',
    )
    parser.add_argument(
        '-e',
        '--encrypted',
        action='store_true',
        help='Enable encryption mode and enter a one-time key to access',
    )
    parser.add_argument(
        '-c',
        '--classic',
        action='store_true',
        help='Enable classic mode and use classic.html as the homepage',
    )
    args = parser.parse_args()
    if args.encrypted:
        ENCRYPTED = True
        SECRET_KEY = f'{secrets.randbelow(9000) + 1000:04d}'
        print(f'一次性密钥: {SECRET_KEY}')
    if args.classic:
        CLASSIC_MODE = True
        print('Classic mode enabled: serving classic.html as homepage')
    run(port=args.port)
