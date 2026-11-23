# 文档 11：环境体检、工具私有化下载与网络加速规范 (`11-preflight-mirror-network-guide.md`)

## 一、组件分层安装策略

| 层级 | 包含组件 | 安装与托管方式 |
| --- | --- | --- |
| **第一层：轻量工具（DevOS 私有托管）** | `ddev`、`mkcert`、便携版 `Node.js`、`@devcontainers/cli`、便携版 `Git` | Rust 直接下载压缩包解压至 `~/.devos/bin/`。执行时自动前置到子进程 `PATH` 最前，不污染系统全局 PATH。 |
| **第二层：重型系统底座（向导式半自动）** | Windows WSL2、Docker Desktop / OrbStack / Linux Docker | 向导式引导：检测缺失 -> 断点续传下载安装包 -> 唤起系统安装器 -> 轮询直到 `docker info` 成功。macOS 优先推荐 OrbStack。 |

---

## 二、中国大陆网络 4 层加速架构

1. **远程可热更镜像清单（`mirrors.json`）+ 2 秒并发测速 (Race)**：
   - 提供 4 种预设：`自动测速择优` / `中国大陆加速` / `官方直连` / `自定义代理或镜像`。
   - 候选源并发 2 秒 HEAD 测速，自动挑选返回 200 且最快的源；中途掉速自动切备用源。
2. **代理自动读取与透传**：
   - 读取系统代理（`HTTP_PROXY` / `HTTPS_PROXY` / `sysproxy`）。
   - 一键透传给容器引擎（容器内转换为 `host.docker.internal:<port>`）。
3. **三处源联动切换**：
   - 二进制下载源（淘宝/清华/中科大/OSS）。
   - Docker 镜像源（引导配置可用加速器与 `hello-world` 校验）。
   - 容器内包管理器源（自动注入 `NPM_CONFIG_REGISTRY`、`PIP_INDEX_URL`、`GOPROXY`）。
4. **防劫持与断点续传**：
   - 始终以官方 SHA256 校验清单为准，校验失败丢弃换源。
   - HTTP Range 断点续传大文件。
   - 提供「已有本地安装包？点此导入」离线逃生门。
