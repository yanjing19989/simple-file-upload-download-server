# 📁 简易文件上传与下载服务 / Simple File Upload & Download Server

- [中文说明](#中文说明) | [English Guide](#english-guide)

---

默认界面采用现代极简的双栏工作台，并针对桌面与移动设备提供自适应布局。

## 中文说明

### 简介
一个基于 Python 内置 `http.server` 的极简文件上传/下载小服务，单文件运行，带现代响应式前端、上传进度跟踪与可选的一次性密钥访问控制。

- 入口文件：`file.py`
- 运行环境：Python 3.8+
- 平台：Windows / macOS / Linux

### 功能
- 上传多个文件（multipart/form-data），支持实时速度与 ETA 显示
- 下载文件（浏览器或命令行），支持断点续传与 HTTP Range 请求
- 多线程处理列表、上传和下载请求，传输任务互不阻塞
- 上传采用分块复制、同目录临时文件和原子替换，降低大文件内存占用并避免残留半文件
- 文件与文件夹列表（名称、大小、修改时间），支持当前层目录导航、按列排序和 HEAD 请求获取文件元数据
- 进度条与智能上传速度显示（小文件使用平均速度）
- 现代极简文件工作台（桌面双栏、移动端卡片列表）
- 拖拽上传支持
- 手动主题切换（浅色/深色/自动）
- 主题色彩定制（7种预设颜色和重置选项）
- 文件搜索与批量操作（防弹窗拦截的顺序下载）
- 向当前浏览目录上传文件，支持同名确认与传输中主动取消
- 实时速度与预计完成时间显示
- 响应式设计，支持移动设备
- 可选加密模式：一次性 4 位密钥（请求头 `X-Secret-Key`）
- 零依赖经典界面模式（通过 `-c` 参数启用，兼容 IE8 标准模式）
- 终端显示服务器 URL 和二维码（可选，需要 qrcode 模块）

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
   - 启用经典界面模式：
     ```powershell
     python file.py -p 8000 -c
     ```
3. 浏览器访问：
   ```
   http://localhost:PORT/
   ```
   上传的文件保存到启动目录。

### 命令行参数
- `-p, --port` 指定服务端口（默认 80）
- `-e, --encrypted` 启用一次性密钥模式
- `-c, --classic` 启用经典模式，使用传统界面

加密模式下，控制台会显示 4 位密钥，客户端需在请求头携带 `X-Secret-Key`。
`--encrypted` 与 `--classic` 互斥，不能同时启用；经典模式仅用于无加密的局域网环境。

### 前端使用
**新界面（默认）：**
- 上传：拖拽文件到上传区域或点击“选择文件”，文件会上传到当前浏览目录，并支持多文件、同名覆盖确认、传输取消、进度、速度和预计完成时间
- 列表：通过面包屑浏览共享根目录内的已有文件夹；支持当前层搜索、按名称/大小/修改时间排序，以及文件全选/反选
- 外观：点击右上角调色板按钮，选择浅色、深色或跟随系统模式，并可切换 7 种主题色
- 下载：选中文件后点击“下载所选”，支持顺序批量下载和断点续传
- 密钥：加密模式使用页面内弹窗输入密钥；密钥仅保留在当前页面内存中，可通过右上角按钮重置

**经典界面（`-c` 启用）：**
- 上传：通过浏览器原生表单一次上传一个文件；上传成功后返回经典首页，同名文件会直接覆盖
- 列表：页面打开时自动读取根目录文件，也可点击“刷新列表”重新读取
- 下载：点击文件名直接下载，不使用批量下载或弹窗

经典界面不加载第三方资源或 polyfill，使用 ES3、同源 XHR 和基础 CSS，支持启用 JavaScript 的 IE8 标准模式。它保持根目录扁平文件模式，不显示或进入文件夹，也不提供加密、上传进度、多文件上传、主题或批量操作。

> 文件夹需预先存在于服务器共享目录中；当前不支持上传整个文件夹、新建文件夹或将文件夹打包下载。搜索和批量选择仅作用于当前层。

> 端口 80 通常需管理员权限，推荐 `-p 8000`。
> 当前目录所有普通文件都会出现在列表中。

### 接口说明
- `GET /` 返回前端页面
- `GET /list?path=<relative-directory>` 列出指定目录的当前层内容，返回 `path`、`directories` 和 `files`；省略 `path` 表示根目录，可选 `X-Secret-Key`
- `GET /download?file=<relative-file-path>` 下载共享根目录内的指定文件，支持 HTTP Range 请求断点续传，可选 `X-Secret-Key`
- `HEAD /download?file=<relative-file-path>` 获取文件元数据（大小、类型、Range 支持），不下载文件内容，可选 `X-Secret-Key`
- `POST /upload?path=<relative-directory>` 上传文件到指定已有目录（multipart/form-data，字段名 `file`）；省略 `path` 表示根目录，可选 `X-Secret-Key`。经典表单额外发送 `response=classic`，仅在经典模式上传成功时返回 `303` 到 `/?upload=success`；普通 API 上传仍返回 `200 OK`

### 加密模式说明
- 启用 `-e` 后，所有接口校验 `X-Secret-Key`。
- 前端使用页面内弹窗输入密钥，错误时可直接重试；密钥不会写入本地存储。

### 安全与注意事项
- 仅用于局域网/临时传输，无权限隔离和传输加密
- 静态资源和共享文件均限制在服务目录内，密钥使用恒定时间比较，访问日志会隐藏下载 URL 中的密钥
- 当前 multipart 上传实现使用标准库 `cgi`，支持 Python 3.8–3.12；该模块自 Python 3.11 起已废弃，并在 Python 3.13 中移除

### 故障排查
- 权限/端口占用：用 `-p 8000` 或管理员权限。
- 上传 400：确认 Content-Type 和字段名。

### 测试
后端 HTTP 集成测试和前端纯函数单元测试的运行方式、覆盖矩阵及扩展约定见 [`tests/README.md`](tests/README.md)。测试不需要额外的 Python 或 npm 测试依赖。

### 预编译可执行文件

预编译的可执行文件可从 [发布页面](https://github.com/yanjing19989/simple-file-upload-download-server/releases) 下载。CI 创建两种构建方式：

**目录构建**（推荐，启动更快）：
- Linux: `SFS-linux.tar.gz`
- Windows: `SFS-windows.zip`

**单文件构建**（便携，但启动稍慢）：
- Linux: `SFS-onefile`（包含在 tar.gz 中）
- Windows: `SFS-onefile.exe`（包含在 zip 中）

解压后运行可执行文件。静态资源（`static/`）已通过 `--add-data` 嵌入到可执行文件中。

> 注意：目录构建会在 `dist` 中生成名为 `SFS` 的文件夹，包含可执行文件和 `_internal` 目录（包含依赖和静态资源）。

---

### 从源码构建

项目包含 GitHub Actions CI/CD，使用 PyInstaller 构建可执行文件。CI 通过 `--add-data` 标志将静态资源嵌入到构建中。要在本地构建：

1. 安装 PyInstaller 和 qrcode（可选）：
   ```powershell
   pip install pyinstaller qrcode
   ```
2. 目录构建（推荐）：
   ```powershell
   pyinstaller -D file.py -n SFS --add-data static:static
   ```
   或单文件构建：
   ```powershell
   pyinstaller -F file.py -n SFS-onefile --add-data static:static
   ```

> 提示：`--add-data` 使用 `:` 作为分隔符（在 Windows 上使用 `;`）。格式：`源路径:目标路径`

---

## English Guide

### Introduction
A tiny file upload/download server built on Python's built-in `http.server`. It is single-file runnable and includes a modern responsive frontend, upload progress tracking, and optional one-time key access control.

- Entry: `file.py`
- Runtime: Python 3.8+
- Platforms: Windows / macOS / Linux

### Features
- Multi-file upload (multipart/form-data) with real-time speed and ETA display
- File download (browser or CLI), supports resuming with HTTP Range requests
- Concurrent request handling keeps listing, uploads, and downloads responsive
- Chunked uploads use same-directory temporary files and atomic replacement to reduce large-file memory use and avoid partial destination files
- File and folder listing (name, size, and modified time) with current-level navigation, column sorting, and HEAD metadata requests
- Upload progress with intelligent speed display (average speed for small files)
- Modern minimalist workspace (two columns on desktop, file cards on mobile)
- Drag and drop file upload support
- Manual theme switching (light/dark/auto)
- Theme color customization (7 preset colors and reset option)
- File search and bulk operations (sequential downloads to prevent popup blocking)
- Uploads to the currently browsed directory with same-name confirmation and active transfer cancellation
- Real-time speed and ETA display
- Responsive design for mobile devices
- Optional encrypted mode: one-time 4-digit key (via `X-Secret-Key` header)
- Dependency-free classic interface mode (enabled via `-c`, supports IE8 standards mode)
- Terminal displays server URL and QR code (optional, requires qrcode module)

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
   - Enable classic interface mode:
     ```powershell
     python file.py -p 8000 -c
     ```
3. Visit in browser:
   ```
   http://localhost:PORT/
   ```
   Uploaded files are saved to the process working directory.

### CLI Options
- `-p, --port` Specify the server port (default 80)
- `-e, --encrypted` Enable one-time key mode
- `-c, --classic` Enable classic mode with traditional interface

When encrypted mode is enabled, the program prints a one-time 4-digit key and requires clients to include it in the `X-Secret-Key` request header.
`--encrypted` and `--classic` are mutually exclusive. Classic mode is intended for unencrypted local-network use only.

### Frontend Usage
**Enhanced Interface (Default):**
- Upload: Drag files into the upload area or click "Select Files". Files are uploaded to the currently browsed directory with overwrite confirmation, cancellation, progress, speed, and ETA
- List: Browse existing folders under the shared root with breadcrumbs; search and sort the current level, then select or invert files for download
- Appearance: Use the palette button in the top-right to choose light, dark, or system mode and one of seven accent colors
- Download: Select files and click "Download Selected" for sequential bulk downloads with resume support
- Key: Encrypted mode uses an in-page key dialog. The key stays in memory only and can be reset from the top-right action

**Classic Interface (`-c` enabled):**
- Upload: Use the browser's native form to upload one file at a time. A successful upload returns to the classic homepage, and an existing file with the same name is overwritten
- List: Files in the shared root load when the page opens and can be reloaded with Refresh
- Download: Click a file name to download it directly, without batch downloads or popups

The classic interface loads no third-party resources or polyfills and uses ES3, same-origin XHR, and basic CSS for IE8 standards mode. It remains a flat root-file view and does not provide encryption, folder navigation, progress tracking, multi-file uploads, themes, or batch operations.

> Folders must already exist under the server's shared root. Uploading whole folders, creating folders, and packaged folder downloads are not supported. Search and bulk selection apply only to the current level.

> Port 80 often requires admin privileges on Windows; prefer `-p 8000`.
> All regular files in the current working directory appear in the list.

### API
- `GET /` Returns the built-in HTML frontend
- `GET /list?path=<relative-directory>` List one directory level and return `path`, `directories`, and `files`; omitting `path` selects the root, optional `X-Secret-Key`
- `GET /download?file=<relative-file-path>` Download a file within the shared root with HTTP Range support, optional `X-Secret-Key`
- `HEAD /download?file=<relative-file-path>` Get file metadata without downloading content, optional `X-Secret-Key`
- `POST /upload?path=<relative-directory>` Upload multipart `file` fields to an existing directory; omitting `path` selects the root, optional `X-Secret-Key`. The classic form also sends `response=classic`; only a successful classic-mode form upload returns `303` to `/?upload=success`, while normal API uploads continue to return `200 OK`

### Encrypted Mode Notes
- With `-e`, the server validates `X-Secret-Key` for all endpoints.
- The frontend requests the key in an in-page dialog and allows immediate retry after an invalid key.
- Encrypted mode cannot be combined with classic mode; use the enhanced interface when `-e` is enabled.
- The key is never written to local storage; resetting it requires the next protected action to unlock the page again.

### Security Notes
- Intended for LAN/temporary use; no auth roles or auditing.
- Static and shared-file paths are confined to their service directories, keys use constant-time comparison, and download keys are redacted from access logs.
- The current multipart implementation uses the standard-library `cgi` parser and supports Python 3.8–3.12. `cgi` was deprecated in Python 3.11 and removed in Python 3.13.

### Troubleshooting
- Permission/port issues: use `-p 8000` or run as admin.
- Upload 400: ensure `multipart/form-data` with field name `file`.

### Tests
See [`tests/README.md`](tests/README.md) for commands, coverage, fixtures, platform notes, and conventions. The backend integration tests and frontend utility tests require no additional Python or npm test dependencies.

### Pre-built Binaries

Pre-built executables for Windows and Linux are available from the project's [Releases page](https://github.com/yanjing19989/simple-file-upload-download-server/releases). The CI creates two types of builds:

**Directory builds** (recommended, faster startup):
- Linux: `SFS-linux.tar.gz`
- Windows: `SFS-windows.zip`

**Single-file builds** (portable, slightly slower startup):
- Linux: `SFS-onefile` (included in tar.gz)
- Windows: `SFS-onefile.exe` (included in zip)

After extraction, run the executable. Static assets (`static/`) are embedded in the executables using `--add-data` flag.

> Note: Directory builds generate a `SFS` folder under `dist` containing the executable and `_internal` directory (with dependencies and static assets).

---

### Building from Source

The project includes a GitHub Actions CI that builds binaries using PyInstaller. The CI embeds static assets using the `--add-data` flag. To build locally:

1. Install PyInstaller and qrcode (optional):
   ```powershell
   pip install pyinstaller qrcode
   ```
2. Directory build (recommended):
   ```powershell
   pyinstaller -D file.py -n SFS --add-data static:static
   ```
   Or single-file build:
   ```powershell
   pyinstaller -F file.py -n SFS-onefile --add-data static:static
   ```

> Tip: `--add-data` uses `:` as separator (use `;` on Windows). Format: `source_path:destination_path`


