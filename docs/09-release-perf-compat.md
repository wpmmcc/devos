# 文档 09：版本发布、性能优化与兼容性设计 (`09-release-perf-compat.md`)

## 一、版本发布与更新架构（双轨制与目录三权分立）

### 1. 双轨制更新模式
- **轨道 A：核心本体（完整包原子替换）**：Tauri 桌面端、CLI、MCP、前端 UI，通过 GitHub Releases 发布完整签名安装包，保证 Rust 与前端版本 100% 匹配。
- **轨道 B：易变资产（应用内热更新）**：`mirrors.json`、`agent-adapters.json`、项目模板、托管工具链，通过轻量静态清单仓库/OSS 异步拉取更新，避免频繁发版。

### 2. 目录物理三权分立
| 目录层级 | 典型路径 | 存放内容 | 更新/卸载策略 |
| --- | --- | --- | --- |
| **1. 程序安装目录（无状态）** | `%LOCALAPPDATA%\DevOS\` 或 `/Applications/DevOS.app` | 主程序二进制、内置前端静态资源 | 更新时整包覆盖，卸载时清空。严禁写入用户数据。 |
| **2. 应用数据目录 (`DEVOS_HOME`)** | `~/.devos/` | `settings.json`、`index.sqlite`、`bin/`、`backups/`、`logs/` | 更新时原样保留；卸载时默认保留。 |
| **3. 用户项目工作区** | `~/DevOS-Projects/` | 项目源码、`devos.json`、`board/`、`issues/`、`docs/` | **永久受保护**，全生命周期绝不删除。 |

### 3. 工程关键点
- **稳定路径永久不变**：所有外部 Agent 统一指向固定路径 `~/.devos/bin/devos-mcp`。
- **前向兼容迁移**：`settings.json` 与 `devos.json` 带 `schema_version` 单向迁移；`index.sqlite` 作为可丢弃缓存，结构变化时 1 秒内从真源文件重建。
- **安装器行为统一**：Windows 采用 NSIS 每用户安装避免 UAC 弹窗；macOS 原子替换 `.app`；Linux 主推 `.AppImage`。

---

## 二、应用程序性能优化设计

目标：静默驻留内存 `< 80MB`，CPU `< 1%`。
1. **文件监听白名单与防抖**：仅监听 `devos.json`、`devos.run.json`、`board/`、`issues/` 等元数据目录，彻底忽略 `node_modules/`、`.git/`、`vendor/`，配合 200ms 事件去重合并。
2. **SQLite 并发与 I/O 优化**：强制开启 WAL 模式与 5000ms busy_timeout，桌面端存活时采用单写者收口串行落盘。
3. **WebView 内存按需挂载**：仅在切换至测试预览台时挂载 Child WebView，后台失焦超过 60 秒时释放或隐藏；容器心跳前台 5 秒，失焦自动降频至 30 秒。
4. **虚拟滚动**：大日志采用环形缓冲与虚拟列表（`@tanstack/react-virtual`）渲染。
5. **并发前置体检**：Preflight Doctor 并发探测并在 2-3 秒内完成。

---

## 三、三端兼容性优化设计

1. **容器引擎多样性**：禁止写死 `/var/run/docker.sock`，按优先级探测 `DOCKER_HOST`、docker context 及 OrbStack/Colima socket。
2. **Windows**：DDEV 开启 Mutagen 文件同步加速；代码签名防止杀软误报；内置 WebView2 引导。
3. **macOS**：支持 Apple Silicon 与 Intel 双架构；Gatekeeper 公证；系统休眠唤醒事件监听。
4. **Linux**：固定在较老 LTS（`ubuntu-22.04`）编译发布包；NVIDIA 环境自动回退 `WEBKIT_DISABLE_DMABUF_RENDERER=1`；DevContainer 映射宿主机 UID/GID 防止 root 文件锁死。
5. **登录 Shell 环境变量提取**：macOS/Linux 桌面图标双击启动时，执行非交互式登录 Shell 提取真实 `PATH` 与代理环境变量。
