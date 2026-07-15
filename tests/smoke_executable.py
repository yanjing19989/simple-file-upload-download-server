"""Smoke-test a packaged file-server executable over real HTTP."""

import http.client
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def available_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def request(port, target):
    connection = http.client.HTTPConnection(
        '127.0.0.1', port, timeout=2
    )
    try:
        connection.request('GET', target)
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def wait_until_ready(process, port):
    deadline = time.monotonic() + 30
    last_error = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f'Executable exited early with code {process.returncode}'
            )
        try:
            status, _, _ = request(port, '/')
            if status == 200:
                return
        except (OSError, http.client.HTTPException) as error:
            last_error = error
        time.sleep(0.1)
    raise RuntimeError(f'Server did not become ready: {last_error}')


def stop_process_tree(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(
            [
                'taskkill',
                '/PID',
                str(process.pid),
                '/T',
                '/F',
            ],
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if os.name == 'nt':
            process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait(timeout=5)


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Expected one executable path')
    executable = Path(sys.argv[1]).resolve()
    if not executable.is_file():
        raise SystemExit(f'Executable not found: {executable}')

    port = available_port()
    with tempfile.TemporaryDirectory() as storage, \
            tempfile.TemporaryDirectory() as runtime:
        root = Path(storage)
        (root / 'root.txt').write_text('root', encoding='utf-8')

        process_options = {}
        if os.name == 'nt':
            process_options['creationflags'] = (
                subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            process_options['start_new_session'] = True
        process = subprocess.Popen(
            [str(executable), '-p', str(port)],
            cwd=root,
            env={
                **os.environ,
                'TEMP': runtime,
                'TMP': runtime,
                'TMPDIR': runtime,
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            **process_options,
        )
        try:
            wait_until_ready(process, port)

            status, headers, body = request(port, '/')
            assert status == 200
            assert headers['Content-Type'].startswith('text/html')
            assert b'id="workspace"' in body

            status, _, body = request(port, '/list')
            assert status == 200
            listing = json.loads(body)
            assert listing['path'] == ''
            assert listing['directories'] == []
            assert [item['name'] for item in listing['files']] == [
                'root.txt'
            ]
        finally:
            stop_process_tree(process)


if __name__ == '__main__':
    main()
