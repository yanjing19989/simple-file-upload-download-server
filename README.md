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
- 增强型现代界面（卡片式布局、毛玻璃效果）
- 拖拽上传支持
- 手动主题切换（浅色/深色/自动）
- 文件搜索与批量操作
- 实时速度与预计完成时间显示
- 响应式设计，支持移动设备
- 可选加密模式：一次性 4 位密钥（请求头 `X-Secret-Key`）
- 经典界面模式（通过 `-c` 参数启用）

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

### 前端使用
**新界面（默认）：**
- 上传：拖拽文件到上传区域或点击"浏览选择"，支持多文件上传，实时显示上传进度、速度和预计完成时间
- 列表：自动加载文件列表，支持搜索过滤、全选/反选、批量下载
- 主题：点击右上角主题按钮切换浅色/深色/自动模式
- 下载：选中文件后点击"下载所选"，支持批量下载

**经典界面（`-c` 启用）：**
- 上传：选择文件后点击"上传"，如启用加密模式会弹窗输入密钥
- 列表：点击"刷新列表"获取服务器当前目录文件
- 下载：选中文件后点击"下载所选"

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

### 安全与注意事项
- 仅用于局域网/临时传输，无权限隔离和传输加密
- Python `cgi` 模块已废弃，未来可能移除。

### 故障排查
- 权限/端口占用：用 `-p 8000` 或管理员权限。
- 上传 400：确认 Content-Type 和字段名。

### 预编译可执行文件

Windows 和 Linux 平台的预编译可执行文件可从 [发布页面](https://github.com/yanjing19989/simple-file-upload-download-server/releases) 下载。提供两种构建类型：

**目录构建**（推荐开发使用）：
- Linux：`simple-file-server-linux-directory.tar.gz`
- Windows：`simple-file-server-windows-directory.zip`

解压后从文件夹中运行可执行文件。静态文件包含在 `_internal` 目录中。

**独立构建**（单个可执行文件）：
- Linux：`simple-file-server-linux-standalone.tar.gz`  
- Windows：`simple-file-server-windows-standalone.zip`

单个可执行文件，内嵌所有资源。启动可能稍慢但更易分发。

解压后使用：
```bash
# Linux
./simple-file-server -p 8000

# Windows  
simple-file-server.exe -p 8000
```

### 从源码构建

项目包含 GitHub Actions CI/CD，使用 PyInstaller 构建可执行文件：

1. **自动构建**：在推送到 `main` 分支和拉取请求时触发
2. **发布构建**：创建 git 标签（如 `v1.0.0`）触发发布并提供下载资源
3. **本地构建**：安装 PyInstaller 并运行：
   ```bash
   pip install pyinstaller
   pyinstaller file.py --add-data "static:static" --add-data "classic.html:." --name simple-file-server
   ```

CI/CD 流水线为 Windows 和 Linux 平台创建 `--onefile`（独立）和 `--onedir`（目录）两种构建。

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
- Enhanced modern interface (card layout with glassmorphism effects)
- Drag and drop file upload support
- Manual theme switching (light/dark/auto)
- File search and bulk operations
- Real-time speed and ETA display
- Responsive design for mobile devices
- Optional encrypted mode: one-time 4-digit key (via `X-Secret-Key` header)
- Classic interface mode (enabled via `-c` flag)

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

### Frontend Usage
**Enhanced Interface (Default):**
- Upload: Drag files to upload area or click "Browse" button. Supports multi-file upload with real-time progress, speed, and ETA display
- List: Auto-loads file list with search filtering, select all/invert selection, and bulk download support
- Theme: Click theme button in top-right corner to switch between light/dark/auto modes
- Download: Select files and click "Download Selected" for bulk downloads

**Classic Interface (`-c` enabled):**
- Upload: Select files, click Upload. If encrypted mode is on, the page prompts for the key
- List: Click Refresh to fetch all files in the server's current directory
- Download: Select files and click Download Selected to open downloads in new windows

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

**Workarounds:**
- Temporarily avoid encrypted mode for downloads; or
- Use a CLI tool that can add headers, e.g.:

### Security Notes
- Intended for LAN/temporary use; no auth roles or auditing.
- Python's `cgi` module is deprecated since 3.11 and may be removed in future.

### Troubleshooting
- Permission/port issues: use `-p 8000` or run as admin.
- Upload 400: ensure `multipart/form-data` with field name `file`.

### Pre-built Binaries

Pre-built executables are available for Windows and Linux from the [releases page](https://github.com/yanjing19989/simple-file-upload-download-server/releases). Two build types are provided:

**Directory builds** (recommended for development):
- Linux: `simple-file-server-linux-directory.tar.gz`
- Windows: `simple-file-server-windows-directory.zip`

Extract and run the executable from the folder. Static files are included in the `_internal` directory.

**Standalone builds** (single executable):
- Linux: `simple-file-server-linux-standalone.tar.gz`  
- Windows: `simple-file-server-windows-standalone.zip`

Single executable file with embedded assets. May take longer to start but easier to distribute.

Usage after extraction:
```bash
# Linux
./simple-file-server -p 8000

# Windows  
simple-file-server.exe -p 8000
```

### Building from Source

The project includes GitHub Actions CI/CD that builds binaries using PyInstaller:

1. **Automatic builds**: Triggered on push to `main` branch and pull requests
2. **Release builds**: Create a git tag (e.g., `v1.0.0`) to trigger a release with downloadable assets
3. **Local builds**: Install PyInstaller and run:
   ```bash
   pip install pyinstaller
   pyinstaller file.py --add-data "static:static" --add-data "classic.html:." --name simple-file-server
   ```

The CI/CD pipeline creates both `--onefile` (standalone) and `--onedir` (directory) builds for Windows and Linux platforms.


