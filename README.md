# Simple File Upload & Download Server

一个仅依赖 Python 标准库的局域网文件服务器，提供浏览器上传、下载和目录浏览，也可打包为独立可执行文件。

## 功能

- 多文件上传、同名覆盖、进度/速度显示与取消上传
- 文件夹导航、搜索排序、文件与文件夹批量选择和下载
- HTTP Range、HEAD 与断点续传支持
- 可选一次性密钥保护，密钥不会写入浏览器持久存储
- 浅色、深色、跟随系统和主题色设置
- `-c` 启用零依赖经典界面，兼容 IE8 标准模式
- 临时目录隔离、路径越界和目录符号链接防护

## 快速开始

需要 Python 3.8–3.12。从希望共享的目录启动服务器：

```powershell
python path/to/file.py -p 8000
```

浏览器访问终端输出的地址。默认端口为 80，也可以使用仓库中的启动脚本：

- `run_server.sh`：Linux/macOS，端口 8000
- `run_server.bat`：Windows，端口 80
- `run_server_classic.bat`：Windows 经典模式，端口 80

命令行参数：

```text
-p, --port PORT   监听端口，默认 80
-e, --encrypted   启用一次性四位密钥
-c, --classic     启用经典界面
```

`--encrypted` 与 `--classic` 互斥。经典模式仅适合无加密的可信局域网。

## 使用方式

现代界面支持进入已有文件夹；上传目标是当前文件夹。文件和文件夹均可通过复选框批量选择。仅下载文件时，浏览器可能询问是否允许连续下载；选择中包含文件夹时，界面会要求选择一个本地目标目录，并按原目录结构逐文件写入（不生成压缩包）。文件夹下载依赖 Chromium 系浏览器的目录访问能力，并要求安全上下文（HTTPS 或 localhost）。

加密模式启动后，终端会显示四位密钥。现代界面首次访问文件接口时会请求密钥，也可以通过 `X-Secret-Key` 请求头或 `key` 查询参数调用 API。密钥出现在访问日志时会被脱敏。

经典界面不加载外部资源，使用 ES3、同源 XHR 和基础 CSS。它只显示根目录文件，不支持加密、文件夹导航、上传进度、多文件上传、主题或批量操作；上传成功后返回首页并显示提示。

## HTTP API

所有路径参数均使用相对共享目录的 `/` 分隔路径，不允许绝对路径、反斜杠、空路径段、`.`、`..` 或盘符。

- `GET /`：现代或经典首页
- `GET /static/<name>`：现代界面静态资源，支持 ETag
- `GET /list?path=<directory>`：返回目录内容；省略 `path` 表示根目录
- `GET /download?file=<path>`：下载文件，支持单段 `Range`
- `HEAD /download?file=<path>`：返回下载元数据而不发送文件体
- `POST /upload?path=<directory>`：上传到已有目录，表单字段名为 `file`

`/list` 的响应结构：

```json
{
  "path": "docs",
  "directories": [{"name": "images", "modified": 1700000000000}],
  "files": [{"name": "readme.txt", "size": 12, "modified": 1700000000000}]
}
```

## 测试

测试只使用 Python 和 Node.js 内置能力。从仓库根目录运行：

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/js/*.test.js
```

检查所有现代前端脚本语法：

```bash
for script in static/*.js; do node --check "$script"; done
```

打包产物的 HTTP 冒烟测试由 CI 调用，也可手动运行：

```powershell
python tests/smoke_executable.py path/to/SFS
```

后端测试使用真实 HTTP 服务和临时共享目录。符号链接断言在没有创建权限的 Windows 环境中会跳过。新增测试应优先验证公开行为，避免锁定内部辅助函数或实现参数。

## 构建与发布

GitHub Actions 在 Ubuntu/Python 3.8 和 Windows/Python 3.12 上运行后端测试，并运行前端单元测试与语法检查。PR 不构建可执行文件；主分支、版本标签和手动工作流会构建 Linux/Windows 的目录版与单文件版产物，并执行真实 HTTP 冒烟测试。

本地构建需要 PyInstaller，可选安装 `qrcode` 以在终端显示二维码：

```powershell
python -m pip install pyinstaller qrcode
pyinstaller -D file.py -n SFS --add-data "static;static"
pyinstaller -F file.py -n SFS-onefile --add-data "static;static"
```

Linux/macOS 将 `--add-data` 的分隔符改为 `:`。

## 安全边界

本项目面向临时、可信局域网共享，不是公网文件托管服务：

- 一次性密钥只提供轻量访问限制，不替代 TLS、账户系统或审计
- 上传会覆盖同名文件；现代界面会在上传前确认，API 调用方需自行确认
- 服务器共享启动时的当前工作目录，请避免在敏感目录启动
- 不跟随目录符号链接，也不允许访问共享目录外的目标

## 许可证

[MIT](LICENSE)
