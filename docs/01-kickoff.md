## 文档 1：项目启动与仓库工程规划（`01-kickoff.md`）

### 1.1 Monorepo 目录结构

采用 **Cargo Workspace（Rust）+ pnpm Workspace（前端与插件）** 混合仓库，确保协议数据结构只有一份定义，前后端与 CLI 零口径偏差。

```text
devos-workspace/
├── Cargo.toml                  # Rust Workspace 根配置
├── pnpm-workspace.yaml         # 前端与插件 Workspace 根配置
├── crates/
│   ├── devos-schema/           # 核心协议 Struct（devos.json / run / issue / board），配 ts-rs 自动导出 TS 类型
│   ├── devos-core/             # 业务逻辑内核：SQLite 索引、原子读写、文件监听、端口注册表、状态机
│   ├── devos-env/              # 双引擎环境驱动：DDEV Driver + DevContainer Driver + Preflight Doctor
│   ├── devos-cli/              # `devos` 单一二进制入口（全命令支持 --json）
│   └── devos-mcp/              # 薄壳 MCP Server（stdio 传输，直接调用 devos-core / 本地 IPC）
├── apps/
│   └── desktop/                # Tauri 2 + React + TypeScript 桌面端应用
│       ├── src-tauri/          # Tauri 桥接层（直接依赖 devos-core + devos-env）
│       └── src/                # 前端页面（项目向导、看板、Web预览/脚本测试台、Issue 中心、文档知识库）
├── plugins/                    # 各 Agent 工具的轻量化插件与配置模板生成器
│   ├── skills/                 # 通用 SKILL.md 与 AGENTS.md 模板
│   ├── claude-code/            # MCP 配置 + Hooks 模板
│   ├── factory-droid/          # Droid Skill + MCP 配置模板
│   └── workbuddy/              # 国内工具连接器/MCP 与最小权限配置模板
├── scripts/                    # Python 辅助脚本（项目模板渲染、环境初始化校验、文档导出）
├── templates/                  # 预置项目模板（web-ddev / script-python / hybrid-starter）
└── docs/                       # 架构、协议、开发规范与 UI 指南

```

### 1.2 研发里程碑（4 个阶段）

| 阶段 | 核心交付物 | 验收标准（Definition of Done） |
| --- | --- | --- |
| **Phase 0：基建与协议落盘** | `devos-schema`、`devos-core`（SQLite + 原子读写）、`devos-cli` 基础命令 | 命令行可创建独立项目目录、写入 `devos.json` 与 `ISS-001.json`，并自动同步生成前端 TypeScript 类型文件。 |
| **Phase 1：单项目闭环（MVP）** | `devos-env`（先通 DDEV 或 DevContainer 之一）、`devos-mcp`、Tauri 基础壳（建项 + 4 列看板 + Issue 列表） | 在桌面端新建项目 $\rightarrow$ Agent 通过 MCP 读 Brief、改代码并 `submit_for_testing` $\rightarrow$ 桌面端展示白话验收单并能提 Issue 回流给 Agent 修复。 |
| **Phase 2：双环境与测试台补全** | 补齐 DDEV + `@devcontainers/cli` 双驱动、`devos.run.json` 可视化脚本表单、Web 预览页报错抓取注入脚本 | Web 站点能一键截图抓 Console/500 日志提 Issue；Python 后端脚本能填表单点按钮运行，报错一键转 Issue。 |
| **Phase 3：多 Agent 插件与三端打磨** | 一键写入 Claude Code / Droid / WorkBuddy 配置、Preflight 环境体检向导、Win/macOS/Linux 三端打包与签名 | 零开发基础用户在干净的 Windows/macOS 上装完安装包，按体检向导启动 Docker 后 5 分钟内跑通首个模板项目。 |

---
