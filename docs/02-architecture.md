## 文档 2：系统架构设计文档（`02-architecture.md`）

### 2.1 核心模块职责与通信边界

* **单一权威真源（Single Source of Truth）：** 项目目录内的结构化文件（`devos.json`、`board/`、`issues/`、`requirements/`、`docs/`、`knowledge/`）是持久化真源；SQLite 仅作高速本地索引与跨项目查询缓存。任何时候删掉 SQLite 索引库，扫描项目目录都能 100% 无损重建。
* **本地守护与握手（Local Daemon）：** Tauri 桌面端启动时在 `127.0.0.1` 随机空闲端口拉起轻量 HTTP/IPC 内部服务，并写入 `~/.devos/daemon.json`（含 `port`、`pid`、`session_token`）。若桌面端未启动，`devos` CLI 与 `devos-mcp` 自动降级为**直连 `devos-core` 读写文件与 SQLite**，确保终端随时可用。
* **端口注册表（Port Registry）：** 在全局 SQLite 中维护 `project_id <-> allocated_ports` 映射，启动新项目容器前自动探测宿主机端口占用，防止多项目并行冲突。

### 2.2 双引擎环境驱动设计（`devos-env`）

在 Rust 中定义统一 Trait `EnvDriver`，屏蔽 DDEV 与 Dev Container 的底层命令差异：

* **`check_prereqs()`**：检测 Docker 引擎存活、WSL2 状态（Windows）、DDEV / `@devcontainers/cli` 版本，返回结构化诊断项（缺失项 + 修复建议）。
* **`up()` / `down()` / `status()**`：拉起、停止与心跳探测；Web 引擎额外返回本地域名与 HTTPS 预览地址。
* **`exec(cmd, timeout, env_vars)`**：在目标容器内以非 `root` 用户执行命令，实时流式采集 `stdout/stderr`，超时强制终止并截断超长输出（防撑爆 Agent 上下文）。
* **`snapshot(name)` / `restore(name)**`：DDEV 走原生 `ddev snapshot` + Git 轻量存档；Dev Container 走 Git 存档 + 指定数据卷备份。

### 2.3 Web 预览报错抓取机制（轻量零依赖方案）

无需在用户项目代码里入侵式装 SDK。当用户在 Tauri 内嵌 WebView（或经由本地回环代理）打开项目预览页时，由桌面端注入一段约 100 行的极简探针脚本：

1. 拦截 `window.onerror`、`unhandledrejection` 与 `console.error`，维护最近 30 秒的环形缓冲区。
2. 包装 `fetch` / `XMLHttpRequest`，记录状态码大于等于 400 的请求方法、URL 与响应片段。
3. 用户点击预览窗顶部的「提问题 / 提 Issue」时，Tauri 截取当前窗口画面，同时向探针拉取报错缓冲区 + 向 `devos-env` 拉取容器最后 50 行日志，自动组装成 `issues/ISS-xxx.json`。

---
