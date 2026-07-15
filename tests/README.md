# 测试说明

本目录同时包含后端 HTTP 集成测试和前端纯函数单元测试。测试只使用 Python 与 Node.js 内置能力，不需要安装 pytest、Jest、jsdom 或 npm 依赖。

## 运行环境

- Python 3.8–3.12，用于服务器和 `unittest` 集成测试。
- Node.js 20 或更高版本，用于 `node:test` 单元测试。
- 测试应从仓库根目录执行，以便正确定位 `file.py` 和 `static/`。

运行全部测试：

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/js/*.test.js
```

只运行单个 Python 场景：

```powershell
python -m unittest tests.test_server.ServerTestCase.test_download_head_and_range_forms -v
```

## 后端测试

[`test_server.py`](test_server.py) 为真实 HTTP 集成测试。每个测试都会：

1. 创建独立的临时共享目录。
2. 基于生产处理器创建专用子类，隔离加密、密钥和 classic 配置。
3. 在 `127.0.0.1` 的系统分配端口启动 `ThreadingHTTPServer`。
4. 使用 `http.client` 发送真实请求并完整读取响应。
5. 停止服务器线程并删除临时目录。

当前覆盖范围：

| 场景 | 关键断言 |
| --- | --- |
| 默认、classic、加密首页 | 页面选择、`ENCRYPTED` 注入、`no-store`、响应长度 |
| 访问日志 | 下载 URL 的 `key` 脱敏，非字符串参数保持原值 |
| 静态资源 | MIME/安全头、ETag、304、明文及编码路径越界 |
| 文件列表与认证 | 无密钥、错误密钥、正确密钥、UTF-8 文件名、文件夹、大小与毫秒修改时间 |
| HEAD 与 Range | 固定范围、开放范围、后缀范围、结束位置截断、400、416 |
| 上传 | 多文件、同名覆盖、1 MiB 分块参数、原子替换、临时文件清理 |
| 非法上传 | 错误 Content-Type、缺少 `file` 字段 |
| 目录与路径安全 | 当前层列表、嵌套上传/下载、遍历语法、非法盘符、目录外符号链接、临时目录过滤 |
| 并发 | 下载流被暂停时，列表请求仍由其他请求线程及时完成 |

符号链接测试依赖操作系统权限。Windows 未启用开发者模式或当前账户没有“创建符号链接”权限时，该分支会显示为 `skipped`；这不代表其他路径安全断言未运行。

## JavaScript 测试

[`js/utils.test.js`](js/utils.test.js) 直接加载 `static/utils.js` 的 CommonJS 导出。该测试刻意不创建 DOM，用于保证 `FSUtils` 可以独立运行，并覆盖：

- HTML 特殊字符转义。
- 文件大小单位边界与非法数值归一化。
- 已知和未知扩展名的文件类型标签。
- 主题模式及 7 种主题色白名单。
- 忽略大小写的文件筛选和输入数组不可变性。
- 名称、大小、修改时间排序，稳定兜底顺序和输入数组不可变性。
- 相对路径拼接、面包屑构建和文件夹优先排序。
- 修改时间格式化及已有文件、上传批次内的忽略大小写重名检测。
- 跨筛选选择保留、失效文件剔除、当前结果全选/反选语义。

## 新增测试约定

- 后端路由、响应头或文件系统语义应优先通过真实 HTTP 请求验证，不直接调用 `do_GET`、`do_POST`。
- 每个后端测试必须使用临时目录，不能依赖或修改仓库中的真实文件。
- 并发测试使用 `Event` 等确定性同步手段，不使用固定 `sleep` 猜测请求时序。
- JavaScript 业务纯函数应继续放在无 DOM 依赖的模块中，通过 Node 内置测试运行器验证。
- 新增兼容行为时，同时更新本文件的覆盖矩阵和 CI 测试命令。
