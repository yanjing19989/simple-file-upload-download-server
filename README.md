# 📁 简易文件上传与下载服务 / Simple File Upload & Download Server

- [中文说明](#中文说明) | [English Guide](#english-guide)

---

## 中文说明

### 简介
一个基于 Python 内置 `http.server` 的极简文件上传/下载小服务，单文件运行，带前端页面（进度条、深色模式自适应）与可选的一次性密钥访问控制。

- 入口文件：`file.py`
- 运行环境：Python 3.8+
- 平台：Windows / macOS / Linux

### 功能
- 上传多个文件（multipart/form-data）
- 下载文件（浏览器或命令行）
- 文件列表（名称 + 大小）
- 进度条与上传速度显示
- 自动适配深色模式
- 可选加密模式：一次性 4 位密钥（请求头 `X-Secret-Key`）

### 快速开始
1. 安装 Python 3.8+ 并确保命令行可用 `python`。
2. 启动服务：
   - 默认 80 端口（Windows 可能需要管理员权限）：
     ```powershell
     python file.py
     ```
   - 自定义端口（推荐 8000）：
     ```powershell
     python file.py -p 8000
     ```
   - 启用加密模式：
     ```powershell
     python file.py -p 8000 -e
     ```
3. 浏览器访问：
   ```
   http://localhost:PORT/
   ```
   上传的文件保存到启动目录。

### 命令行参数
- `-p, --port` 指定服务端口（默认 80）
- `-e, --encrypted` 启用一次性密钥模式

加密模式下，控制台会显示 4 位密钥，客户端需在请求头携带 `X-Secret-Key`。

### 前端使用
- 上传：选择文件后点击“上传”，如启用加密模式会弹窗输入密钥。
- 列表：点击“刷新列表”获取服务器当前目录文件。
- 下载：选中文件后点击“下载所选”。

> 端口 80 通常需管理员权限，推荐 `-p 8000`。
> 当前目录所有普通文件都会出现在列表中。

### 接口说明
- `GET /` 返回前端页面
- `GET /list` 列出当前目录文件（JSON），可选 `X-Secret-Key`
- `GET /download?file=<name>` 下载指定文件，可选 `X-Secret-Key`
- `POST /upload` 上传文件（multipart/form-data，字段名 `file`），可选 `X-Secret-Key`

### 加密模式说明
- 启用 `-e` 后，所有接口校验 `X-Secret-Key`。
- 前端上传/刷新会弹窗输入密钥。
- ⚠️ 浏览器下载无法自定义 header，启用加密模式时“下载所选”会失败。

**解决方案：**
- 不启用加密模式下载；或
- 用命令行工具下载：
  
  ```powershell
  $headers = @{ 'X-Secret-Key' = '1234' }
  Invoke-WebRequest "http://localhost:8000/download?file=test.txt" -Headers $headers -OutFile "test.txt"
  ```

- 进阶：将密钥改为查询参数/Cookie，或用 fetch+blob 下载。

### 安全与注意事项
- 仅用于局域网/临时传输，无权限隔离。
- Python `cgi` 模块已废弃，未来可能移除。

### 故障排查
- 权限/端口占用：用 `-p 8000` 或管理员权限。
- 下载失败（加密模式）：见上文“加密模式说明”。
- 上传 400：确认 Content-Type 和字段名。

### 开发建议
- 下载路径白名单/基目录限制。
- 移除 `cgi` 依赖，可用 `email.parser` 或三方库。
- 密钥可用 Cookie/查询参数（建议 HTTPS）。

### 许可
未声明，可按需要添加（如 MIT）。

---

## English Guide

### Introduction
A tiny file upload/download server built on Python's built-in `http.server`. Single-file runnable, includes a minimal frontend (progress bar, auto dark mode) and an optional one-time key access control.

- Entry: `file.py`
- Runtime: Python 3.8+
- Platforms: Windows / macOS / Linux

### Features
- Multi-file upload (multipart/form-data)
- File download (browser or CLI)
- File listing (name + size)
- Upload progress and speed display
- Auto dark-mode support
- Optional encrypted mode: one-time 4-digit key (via `X-Secret-Key` header)

### Quick Start
1. Install Python 3.8+ and ensure `python` is available in your shell.
2. Start the server:
   - Default port 80 (may require admin privileges on Windows):
     ```powershell
     python file.py
     ```
   - Custom port (recommend 8000):
     ```powershell
     python file.py -p 8000
     ```
   - Enable encrypted mode:
     ```powershell
     python file.py -p 8000 -e
     ```
3. Visit in browser:
   ```
   http://localhost:PORT/
   ```
   Uploaded files are saved to the process working directory.

### CLI Options
- `-p, --port` Specify the server port (default 80)
- `-e, --encrypted` Enable one-time key mode

When encrypted mode is enabled, the program prints a one-time 4-digit key and requires clients to include it in the `X-Secret-Key` request header.

### Frontend Usage
- Upload: Select files, click Upload. If encrypted mode is on, the page prompts for the key.
- List: Click Refresh to fetch all files in the server's current directory.
- Download: Select files and click Download Selected to open downloads in new windows.

> Port 80 often requires admin privileges on Windows; prefer `-p 8000`.
> All regular files in the current working directory appear in the list.

### API
- `GET /` Returns the built-in HTML frontend.
- `GET /list` List files in current dir (JSON), optional `X-Secret-Key`
- `GET /download?file=<name>` Download a specific file, optional `X-Secret-Key`
- `POST /upload` Upload one or more files in multipart/form-data under the `file` field, optional `X-Secret-Key`

### Encrypted Mode Notes
- With `-e`, the server validates `X-Secret-Key` for all endpoints.
- The frontend prompts for the key for Upload and List.
- ⚠️ Browsers cannot add custom headers to `window.open`, so Download Selected usually fails when encryption is enabled.

**Workarounds:**
- Temporarily avoid encrypted mode for downloads; or
- Use a CLI tool that can add headers, e.g.:

  ```powershell
  $headers = @{ 'X-Secret-Key' = '1234' }
  Invoke-WebRequest "http://localhost:8000/download?file=test.txt" -Headers $headers -OutFile "test.txt"
  ```
- Advanced: Move the key to a query param or cookie, or use fetch+blob for download.

### Security Notes
- Intended for LAN/temporary use; no auth roles or auditing.
- Python's `cgi` module is deprecated since 3.11 and may be removed in future.

### Troubleshooting
- Permission/port issues: use `-p 8000` or run as admin.
- Download fails with encryption: see Encrypted Mode Notes above.
- Upload 400: ensure `multipart/form-data` with field name `file`.

### Development Notes
- Safer download: restrict to a base dir and validate `file`.
- Remove `cgi` dependency: use `email.parser` or a framework (`Werkzeug`/`aiohttp`).
- Better key transport: use cookies or query params (deploy behind HTTPS).

### License
No license declared. Add one as needed (e.g., MIT).
