"""Integration tests for the HTTP file server.

The suite starts a real ``FileServer`` on an ephemeral loopback port for each
test. Requests therefore exercise routing, HTTP headers, authentication,
streaming, multipart parsing, and filesystem behavior together instead of
calling handler methods in isolation. Every test receives a temporary storage
directory so it cannot read or overwrite files in the repository.

Run from the repository root with::

    python -m unittest discover -s tests -p "test_*.py" -v

The external-symbolic-link assertion may be skipped on Windows accounts that
do not have permission to create symbolic links.
"""

import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import file
from file import FileServer, UploadHTTPRequestHandler, basepath


class ServerTestCase(unittest.TestCase):
    """Exercise the public HTTP contract against an isolated live server."""

    def setUp(self):
        """Create isolated storage and start a server on an available port."""
        self.storage = tempfile.TemporaryDirectory()
        # Handler configuration is stored on the class. A fresh subclass keeps
        # mutations such as encrypted/classic mode local to this test case.
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
        # Port 0 asks the OS for a free port and avoids collisions in CI.
        self.server = FileServer(('127.0.0.1', 0), handler)
        self.thread = threading.Thread(
            target=self.server.serve_forever, daemon=True
        )
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self):
        """Stop request threads before deleting the temporary directory."""
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.storage.cleanup()

    def request(self, method, target, body=None, headers=None):
        """Send one HTTP request and return ``(status, headers, body)``.

        A new connection per call prevents connection reuse from coupling
        otherwise independent assertions. Reading the complete body also
        ensures server-side streaming has finished before the test continues.
        """
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
        """Build a deterministic multipart body for upload tests.

        ``files`` contains ``(field_name, filename, payload)`` tuples. The
        caller passes the returned body and Content-Type header to ``request``;
        ``http.client`` supplies Content-Length automatically.
        """
        boundary = '----sfs-test-boundary'
        chunks = []
        for field_name, filename, payload in files:
            chunks.extend([
                f'--{boundary}\r\n'.encode(),
                (
                    f'Content-Disposition: form-data; name="{field_name}"; '
                    f'filename="{filename}"\r\n'
                ).encode(),
                b'Content-Type: application/octet-stream\r\n\r\n',
                payload,
                b'\r\n',
            ])
        chunks.append(f'--{boundary}--\r\n'.encode())
        return b''.join(chunks), {
            'Content-Type': f'multipart/form-data; boundary={boundary}'
        }

    def test_modern_classic_and_encrypted_index(self):
        """Serve the selected UI and inject encryption state without caching.

        The first response covers the modern default. The second mutates the
        isolated handler to verify the compatible ``-e -c`` combination.
        """
        status, headers, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'id="appearancePanel"', body)
        self.assertIn(b'window.ENCRYPTED = false', body)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(int(headers['Content-Length']), len(body))

        self.handler.classic_mode = True
        self.handler.encrypted = True
        status, _, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'class="container"', body)
        self.assertIn(b'window.ENCRYPTED = true', body)

    def test_log_redaction_preserves_non_string_arguments(self):
        """Redact query-string keys without breaking numeric log arguments."""
        self.assertEqual(
            self.handler._redact_log_value(
                'GET /download?file=a.txt&key=1234 HTTP/1.1'
            ),
            'GET /download?file=a.txt&key=*** HTTP/1.1',
        )
        self.assertEqual(self.handler._redact_log_value(401), 401)

    def test_static_cache_headers_and_traversal_protection(self):
        """Validate static caching, security headers, and traversal defenses.

        Traversal is attempted as plain ``..``, percent-encoded ``..``, and an
        encoded Windows backslash so both POSIX and Windows parsing paths are
        covered.
        """
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

        # All traversal spellings must look like a missing static resource and
        # must never disclose whether the repository file exists.
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
        self.handler.encrypted = True
        self.handler.secret_key = '4321'

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
        listed = {
            item['name']: item for item in json.loads(body)['files']
        }
        self.assertEqual(listed['alpha.txt']['size'], 5)
        self.assertEqual(listed['中文.txt']['size'], 6)
        for name in ('alpha.txt', '中文.txt'):
            expected = (root / name).stat().st_mtime_ns // 1_000_000
            self.assertEqual(listed[name]['modified'], expected)
            self.assertIsInstance(listed[name]['modified'], int)

    def test_download_head_and_range_forms(self):
        """Cover HEAD plus every supported single-byte-range form.

        Valid cases include closed, open-ended, suffix, and oversized-end
        ranges. Syntax errors return 400, while a syntactically valid range
        beyond EOF returns 416 with the RFC-style total-size header.
        """
        payload = b'abcdefghij'
        (Path(self.storage.name) / 'sample.txt').write_bytes(payload)

        status, headers, body = self.request(
            'HEAD', '/download?file=sample.txt'
        )
        self.assertEqual(status, 200)
        self.assertEqual(body, b'')
        self.assertEqual(headers['Content-Length'], str(len(payload)))
        self.assertEqual(headers['Accept-Ranges'], 'bytes')

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

        # Malformed values and unsupported multi-range/unit requests are
        # syntax errors, distinct from a valid but unsatisfiable byte range.
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
        """Stream multiple uploads, overwrite atomically, and clean temp data.

        The second payload crosses two 1 MiB boundaries. Patching
        ``copyfileobj`` records the configured buffer argument, demonstrating
        that application code requests fixed-size copies instead of reading an
        uploaded file into one application-managed bytes object.
        """
        root = Path(self.storage.name)
        (root / 'alpha.txt').write_bytes(b'old')
        large_payload = b'x' * (2 * 1024 * 1024 + 17)
        body, headers = self.multipart([
            ('file', r'C:\fakepath\alpha.txt', b'new-alpha'),
            ('file', 'beta.bin', large_payload),
        ])
        original_copy = file.shutil.copyfileobj
        copy_lengths = []

        def recording_copy(source, destination, length=0):
            """Record each copy buffer size while preserving real I/O."""
            copy_lengths.append(length)
            return original_copy(source, destination, length)

        with mock.patch.object(file.shutil, 'copyfileobj', recording_copy):
            status, response_headers, payload = self.request(
                'POST', '/upload', body=body, headers=headers
            )
        self.assertEqual(status, 200)
        self.assertEqual(payload, b'OK')
        self.assertEqual(response_headers['Content-Length'], '2')
        self.assertEqual((root / 'alpha.txt').read_bytes(), b'new-alpha')
        self.assertEqual((root / 'beta.bin').read_bytes(), large_payload)
        self.assertTrue(copy_lengths)
        self.assertEqual(
            copy_lengths,
            [file.UPLOAD_COPY_CHUNK_SIZE] * len(copy_lengths),
        )
        self.assertFalse(list(root.glob('.sfs-upload-*')))

    def test_upload_rejects_invalid_requests(self):
        """Reject non-multipart bodies and multipart data without ``file``."""
        self.assertEqual(
            self.request(
                'POST',
                '/upload',
                body=b'plain text',
                headers={'Content-Type': 'text/plain'},
            )[0],
            400,
        )
        body, headers = self.multipart([
            ('other', 'ignored.txt', b'ignored'),
        ])
        self.assertEqual(
            self.request('POST', '/upload', body=body, headers=headers)[0],
            400,
        )

    def test_download_rejects_nested_paths_and_external_symlinks(self):
        """Keep downloads and listings inside the configured storage root.

        Nested paths are forbidden even when URL encoded. If the platform can
        create a symbolic link, a link resolving outside storage must be both
        non-downloadable and absent from the file listing.
        """
        root = Path(self.storage.name)
        nested = root / 'nested'
        nested.mkdir()
        (nested / 'secret.txt').write_bytes(b'secret')
        self.assertEqual(
            self.request(
                'GET', '/download?file=nested%2Fsecret.txt'
            )[0],
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
            _, _, body = self.request('GET', '/list')
            self.assertNotIn(b'outside-link.txt', body)

    def test_threaded_server_handles_list_during_download(self):
        """Prove a blocked download does not serialize an unrelated list.

        Events pause only the download request inside ``_stream_file``. A list
        request must still finish within one second; a single-threaded server
        would remain blocked until ``release`` is set or the timeout expires.
        """
        root = Path(self.storage.name)
        (root / 'large.bin').write_bytes(b'x' * 1024)
        started = threading.Event()
        release = threading.Event()
        original_stream = self.handler._stream_file

        def blocking_stream(instance, file_object, start, length):
            """Pause download streaming while leaving other routes untouched."""
            if instance._parsed_url().path == '/download':
                started.set()
                release.wait(timeout=3)
            return original_stream(instance, file_object, start, length)

        self.handler._stream_file = blocking_stream
        result = {}

        def download():
            result['response'] = self.request(
                'GET', '/download?file=large.bin'
            )

        download_thread = threading.Thread(target=download)
        download_thread.start()
        # Wait until the download owns one server request thread before timing
        # the list request on a separate connection.
        self.assertTrue(started.wait(timeout=2))
        began = time.monotonic()
        status, _, _ = self.request('GET', '/list')
        elapsed = time.monotonic() - began
        release.set()
        download_thread.join(timeout=3)
        self.assertEqual(status, 200)
        self.assertLess(elapsed, 1)
        self.assertEqual(result['response'][0], 200)


if __name__ == '__main__':
    unittest.main()
