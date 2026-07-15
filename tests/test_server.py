"""HTTP integration tests using a live server and temporary storage."""

import http.client
import json
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from file import FileServer, UploadHTTPRequestHandler, basepath


class ServerTestCase(unittest.TestCase):
    def setUp(self):
        self.storage = tempfile.TemporaryDirectory()
        handler = type(
            'TestHandler',
            (UploadHTTPRequestHandler,),
            {
                'storage_root': Path(self.storage.name).resolve(),
                'static_root': (basepath / 'static').resolve(),
                'encrypted': False,
                'secret_key': '',
                'classic_mode': False,
            },
        )
        self.handler = handler
        self.server = FileServer(('127.0.0.1', 0), handler)
        self.thread = threading.Thread(
            target=self.server.serve_forever, daemon=True
        )
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.storage.cleanup()

    def request(self, method, target, body=None, headers=None):
        connection = http.client.HTTPConnection(
            self.host, self.port, timeout=5
        )
        connection.request(method, target, body=body, headers=headers or {})
        response = connection.getresponse()
        payload = response.read()
        result = response.status, dict(response.getheaders()), payload
        connection.close()
        return result

    @staticmethod
    def multipart(files):
        boundary = '----sfs-test-boundary'
        chunks = []
        for field_name, filename, payload in files:
            chunks.append(f'--{boundary}\r\n'.encode())
            if filename is None:
                chunks.extend([
                    (
                        f'Content-Disposition: form-data; '
                        f'name="{field_name}"\r\n\r\n'
                    ).encode(),
                    payload,
                    b'\r\n',
                ])
            else:
                chunks.extend([
                    (
                        f'Content-Disposition: form-data; '
                        f'name="{field_name}"; filename="{filename}"\r\n'
                    ).encode(),
                    b'Content-Type: application/octet-stream\r\n\r\n',
                    payload,
                    b'\r\n',
                ])
        chunks.append(f'--{boundary}--\r\n'.encode())
        return b''.join(chunks), {
            'Content-Type': f'multipart/form-data; boundary={boundary}'
        }

    def test_modern_encrypted_and_ie8_classic_index(self):
        """Serve the modern variants and the dependency-free classic page."""
        status, headers, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'id="appearancePanel"', body)
        self.assertIn(b'window.ENCRYPTED = false', body)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(int(headers['Content-Length']), len(body))

        self.handler.encrypted = True
        status, _, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'window.ENCRYPTED = true', body)

        self.handler.encrypted = False
        self.handler.classic_mode = True
        status, _, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        classic = body.decode('utf-8')
        self.assertIn('class="container"', classic)
        self.assertIn('method="post" action="/upload"', classic)
        self.assertIn('enctype="multipart/form-data"', classic)
        self.assertIn('name="response" value="classic"', classic)
        self.assertIn('window.XMLHttpRequest', classic)
        self.assertIn("new ActiveXObject('Microsoft.XMLHTTP')", classic)
        self.assertNotIn('{upload_notice}', classic)

        for feature in ('const ', 'let ', '=>', 'fetch(', '<script src='):
            with self.subTest(feature=feature):
                self.assertNotIn(feature, classic)

    def test_classic_form_upload_redirects_and_shows_notice(self):
        """Redirect only a successful classic form upload to its homepage."""
        root = Path(self.storage.name)
        (root / 'report.txt').write_bytes(b'old')
        body, headers = self.multipart([
            ('response', None, b'classic'),
            ('file', r'C:\fakepath\report.txt', b'new'),
        ])

        status, _, payload = self.request(
            'POST', '/upload', body=body, headers=headers
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload, b'OK')

        self.handler.classic_mode = True
        status, response_headers, payload = self.request(
            'POST', '/upload', body=body, headers=headers
        )
        self.assertEqual(status, 303)
        self.assertEqual(response_headers['Location'], '/?upload=success')
        self.assertEqual(payload, b'')
        self.assertEqual((root / 'report.txt').read_bytes(), b'new')

        status, _, page = self.request('GET', '/?upload=success')
        self.assertEqual(status, 200)
        self.assertIn('上传成功，文件列表已刷新。'.encode(), page)

    def test_classic_and_encrypted_cli_flags_are_exclusive(self):
        """Reject the unsupported encrypted classic mode at argument parsing."""
        result = subprocess.run(
            [sys.executable, str(basepath / 'file.py'), '-e', '-c'],
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn('--classic', result.stderr)
        self.assertIn('--encrypted', result.stderr)

    def test_static_cache_headers_and_traversal_protection(self):
        status, headers, body = self.request('GET', '/static/style.css')
        self.assertEqual(status, 200)
        self.assertTrue(body)
        self.assertEqual(headers['Cache-Control'], 'no-cache')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertIn('ETag', headers)

        status, _, body = self.request(
            'GET',
            '/static/style.css',
            headers={'If-None-Match': headers['ETag']},
        )
        self.assertEqual(status, 304)
        self.assertEqual(body, b'')

        for target in (
            '/static/../file.py',
            '/static/%2e%2e/file.py',
            '/static/%2e%2e%5cfile.py',
        ):
            with self.subTest(target=target):
                status, _, _ = self.request('GET', target)
                self.assertEqual(status, 404)

    def test_list_and_authentication(self):
        """Require the exact key and preserve UTF-8 filenames in list JSON."""
        root = Path(self.storage.name)
        (root / 'alpha.txt').write_bytes(b'alpha')
        (root / '中文.txt').write_bytes(b'123456')
        (root / '资料').mkdir()
        self.handler.encrypted = True
        self.handler.secret_key = '4321'
        self.assertEqual(
            self.handler._redact_log_value('/list?key=4321'),
            '/list?key=***',
        )

        self.assertEqual(self.request('GET', '/list')[0], 401)
        self.assertEqual(
            self.request(
                'GET', '/list', headers={'X-Secret-Key': '0000'}
            )[0],
            401,
        )
        status, headers, body = self.request(
            'GET', '/list', headers={'X-Secret-Key': '4321'}
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'application/json; charset=utf-8')
        self.assertIn('中文.txt'.encode(), body)
        response = json.loads(body)
        self.assertEqual(response['path'], '')
        self.assertEqual(
            [item['name'] for item in response['directories']],
            ['资料'],
        )
        listed = {item['name']: item for item in response['files']}
        self.assertEqual(listed['alpha.txt']['size'], 5)
        self.assertEqual(listed['中文.txt']['size'], 6)
        for name in ('alpha.txt', '中文.txt'):
            expected = (root / name).stat().st_mtime_ns // 1_000_000
            self.assertEqual(listed[name]['modified'], expected)
            self.assertIsInstance(listed[name]['modified'], int)

    def test_download_head_and_range_forms(self):
        """Cover HEAD plus valid, malformed, and unsatisfiable ranges."""
        payload = b'abcdefghij'
        (Path(self.storage.name) / 'sample.txt').write_bytes(payload)

        status, headers, body = self.request(
            'HEAD', '/download?file=sample.txt'
        )
        self.assertEqual(status, 200)
        self.assertEqual(body, b'')
        self.assertEqual(headers['Content-Length'], str(len(payload)))
        self.assertEqual(headers['Accept-Ranges'], 'bytes')
        self.assertEqual(
            headers['Content-Disposition'],
            "attachment; filename=\"sample.txt\"; "
            "filename*=UTF-8''sample.txt",
        )

        (Path(self.storage.name) / '中文.txt').write_bytes(b'utf8')
        status, headers, _ = self.request(
            'HEAD', '/download?file=%E4%B8%AD%E6%96%87.txt'
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            headers['Content-Disposition'],
            'attachment; filename="__.txt"; '
            "filename*=UTF-8''%E4%B8%AD%E6%96%87.txt",
        )

        cases = [
            ('bytes=0-3', 206, b'abcd', 'bytes 0-3/10'),
            ('bytes=4-', 206, b'efghij', 'bytes 4-9/10'),
            ('bytes=-3', 206, b'hij', 'bytes 7-9/10'),
            ('bytes=0-999', 206, payload, 'bytes 0-9/10'),
        ]
        for value, expected_status, expected_body, content_range in cases:
            with self.subTest(value=value):
                status, headers, body = self.request(
                    'GET',
                    '/download?file=sample.txt',
                    headers={'Range': value},
                )
                self.assertEqual(status, expected_status)
                self.assertEqual(body, expected_body)
                self.assertEqual(headers['Content-Range'], content_range)

        for value in ('bytes=bad', 'bytes=0-1,4-5', 'items=0-1'):
            with self.subTest(value=value):
                self.assertEqual(
                    self.request(
                        'GET',
                        '/download?file=sample.txt',
                        headers={'Range': value},
                    )[0],
                    400,
                )
        status, headers, _ = self.request(
            'GET',
            '/download?file=sample.txt',
            headers={'Range': 'bytes=10-'},
        )
        self.assertEqual(status, 416)
        self.assertEqual(headers['Content-Range'], 'bytes */10')

    def test_upload_multiple_files_and_atomic_overwrite(self):
        root = Path(self.storage.name)
        (root / 'alpha.txt').write_bytes(b'old')
        large_payload = b'x' * (1024 * 1024 + 17)
        body, headers = self.multipart([
            ('file', r'C:\fakepath\alpha.txt', b'new-alpha'),
            ('file', 'beta.bin', large_payload),
        ])
        status, response_headers, payload = self.request(
            'POST', '/upload', body=body, headers=headers
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload, b'OK')
        self.assertEqual(response_headers['Content-Length'], '2')
        self.assertEqual((root / 'alpha.txt').read_bytes(), b'new-alpha')
        self.assertEqual((root / 'beta.bin').read_bytes(), large_payload)
        self.assertFalse(list(root.glob('.sfs-upload-*')))

    def test_upload_rejects_invalid_requests(self):
        """Reject missing fields and invalid upload directories."""
        body, headers = self.multipart([
            ('other', 'ignored.txt', b'ignored'),
        ])
        self.assertEqual(
            self.request('POST', '/upload', body=body, headers=headers)[0],
            400,
        )
        body, headers = self.multipart([
            ('file', 'blocked.txt', b'blocked'),
        ])
        self.assertEqual(
            self.request(
                'POST', '/upload?path=missing', body=body, headers=headers
            )[0],
            404,
        )
        self.assertEqual(
            self.request(
                'POST',
                '/upload?path=..%2Foutside',
                body=body,
                headers=headers,
            )[0],
            403,
        )

    def test_nested_list_download_and_upload(self):
        """Browse and transfer files within an existing nested directory."""
        root = Path(self.storage.name)
        nested = root / 'nested'
        nested.mkdir()
        child = nested / 'child'
        child.mkdir()
        (nested / 'secret.txt').write_bytes(b'secret')
        (root / '.sfs-upload-hidden').mkdir()

        status, _, body = self.request('GET', '/list')
        self.assertEqual(status, 200)
        root_listing = json.loads(body)
        self.assertEqual(
            [item['name'] for item in root_listing['directories']],
            ['nested'],
        )
        self.assertEqual(
            self.request(
                'GET', '/list?path=.sfs-upload-hidden'
            )[0],
            403,
        )

        status, _, body = self.request('GET', '/list?path=nested')
        self.assertEqual(status, 200)
        nested_listing = json.loads(body)
        self.assertEqual(nested_listing['path'], 'nested')
        self.assertEqual(
            [item['name'] for item in nested_listing['directories']],
            ['child'],
        )
        self.assertEqual(
            [item['name'] for item in nested_listing['files']],
            ['secret.txt'],
        )

        status, _, body = self.request(
            'GET', '/download?file=nested%2Fsecret.txt'
        )
        self.assertEqual(status, 200)
        self.assertEqual(body, b'secret')

        upload_body, headers = self.multipart([
            ('file', 'added.txt', b'added'),
        ])
        status, _, _ = self.request(
            'POST',
            '/upload?path=nested',
            body=upload_body,
            headers=headers,
        )
        self.assertEqual(status, 200)
        self.assertEqual((nested / 'added.txt').read_bytes(), b'added')
        self.assertFalse(list(nested.glob('.sfs-upload-*')))

    def test_shared_path_validation_and_external_symlinks(self):
        """Reject traversal syntax and targets outside shared storage."""
        root = Path(self.storage.name)
        (root / 'nested').mkdir()
        (root / 'plain.txt').write_bytes(b'plain')

        invalid_lists = (
            '/list?path=..%2Foutside',
            '/list?path=%2Fnested',
            '/list?path=nested%5Cchild',
            '/list?path=C%3A%2Ftemp',
            '/list?path=nested%2F%2Fchild',
        )
        for target in invalid_lists:
            with self.subTest(target=target):
                self.assertEqual(self.request('GET', target)[0], 403)
        self.assertEqual(self.request('GET', '/list?path=missing')[0], 404)
        self.assertEqual(
            self.request('GET', '/list?path=plain.txt')[0],
            404,
        )
        self.assertEqual(
            self.request('GET', '/download?file=..%2Fplain.txt')[0],
            403,
        )

        with tempfile.TemporaryDirectory() as external:
            target = Path(external) / 'outside.txt'
            target.write_bytes(b'outside')
            link = root / 'outside-link.txt'
            try:
                link.symlink_to(target)
            except OSError:
                self.skipTest('Symbolic links are unavailable')
            self.assertEqual(
                self.request(
                    'GET', '/download?file=outside-link.txt'
                )[0],
                403,
            )
            external_directory = Path(external) / 'outside-directory'
            external_directory.mkdir()
            directory_link = root / 'outside-directory-link'
            internal_link = root / 'nested-link'
            try:
                directory_link.symlink_to(
                    external_directory,
                    target_is_directory=True,
                )
                internal_link.symlink_to(
                    root / 'nested',
                    target_is_directory=True,
                )
            except OSError:
                self.skipTest('Directory symbolic links are unavailable')
            _, _, body = self.request('GET', '/list')
            self.assertNotIn(b'outside-link.txt', body)
            self.assertNotIn(b'outside-directory-link', body)
            self.assertNotIn(b'nested-link', body)
            self.assertEqual(
                self.request(
                    'GET', '/list?path=outside-directory-link'
                )[0],
                403,
            )
            self.assertEqual(
                self.request('GET', '/list?path=nested-link')[0],
                403,
            )

if __name__ == '__main__':
    unittest.main()
