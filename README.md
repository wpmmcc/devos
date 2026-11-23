# DevOS: AI Agent 本地标准化环境与验收工作台

> 面向低代码/非技术用户与 AI Agent 工具（Claude Code、Factory Droid、Codex、WorkBuddy 等）的**本地标准化环境、项目管理、测试反馈与 Issue 闭环工作台**。

---

## 🌟 核心理念与职责边界

> **DevOS 是“标准化环境与验收工作台”，AI Agent 工具是“纯执行引擎”，两者通过“标准化单据（需求/标准/提测单/Issue）”与 MCP 通信，互不越权。**

```
┌──────────────────────────────────────────────────────────────────┐
│                   DevOS 桌面端 (Tauri + React)                   │
│  [项目创建向导]  [4列极简看板]  [Web预览/脚本测试台]  [一键提Issue]    │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ 本地 IPC / SQLite
┌─────────────────────────────────▼────────────────────────────────┐
│               Rust 本地单体核心 (devos-core)                      │
│      [单一权威真源文件系统]  [原子读写]  [端口防冲突]  [预检门禁]    │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                │
┌────────────────▼──────────────┐  ┌──────────────▼────────────────┐
│    双引擎环境驱动 (devos-env)   │  │   插件与连接层 (devos-mcp/cli)   │
│  - Web/DB: DDEV (域名/HTTPS)  │  │  - thin MCP stdio (8大核心工具) │
│  - 后端脚本: Dev Container      │  │  - 零配置 daemon.json 自动握手 │
└───────────────────────────────┘  └───────────────────────────────┘
```

---

## 📂 仓库工程结构 (Monorepo)

```text
devos/
├── Cargo.toml                  # Rust Workspace 根配置
├── pnpm-workspace.yaml         # 前端与插件 Workspace 根配置
├── package.json                # 全局脚本管理与依赖配置
├── crates/
│   ├── devos-schema/           # 核心协议 Struct (devos.json, run, issue, board)
│   ├── devos-core/             # 业务逻辑内核：SQLite 索引、原子读写、端口分配、提测门禁
│   ├── devos-env/              # 双引擎环境驱动：DDEV + DevContainer + Preflight Doctor
│   ├── devos-cli/              # devos 单一命令行工具 (全命令支持 --json)
│   └── devos-mcp/              # 薄壳本地 MCP Server (stdio 传输，实现 8 个标准工具)
├── apps/
│   └── desktop/                # Tauri 2 + React 18 + TypeScript + Tailwind 桌面应用
│       ├── src-tauri/          # Tauri Rust 桥接层
│       └── src/                # 4 个核心工作区 Tab (看板/测试预览/Issue中心/资产)
├── plugins/                    # 各外部 Agent 工具的插件配置与 Skill 规则
│   ├── skills/                 # SKILL.md 与 AGENTS.md 规范模板
│   ├── claude-code/            # Claude Code MCP 配置
│   ├── factory-droid/          # Factory Droid Skill 配置
│   └── workbuddy/              # WorkBuddy 连接器
├── scripts/                    # 自动化脚本 (脚手架创建、环境体检)
├── templates/                  # 预置开箱即用模板 (web-ddev / script-python / hybrid-starter)
└── docs/                       # 系统架构、协议、研发规范与 UI 指南全套文档
```

---

## 🛠️ MCP 8 大核心工具协议

本地 MCP Server（`devos-mcp`）采用 `stdio` 传输，通过 `~/.devos/daemon.json` 自动完成握手：

| 序号 | MCP Tool | CLI 映射 | 核心职责 |
|:---:|---|---|---|
| **1** | `get_project_brief` | `devos brief --json` | 会话起步调用，一次性拿全项目元数据、环境状态、硬性规范与待处理任务 |
| **2** | `env_control` | `devos env <action> --json` | 统一控制容器状态、在沙盒内执行命令 (`exec`)、打快照与还原 |
| **3** | `sync_project_assets` | `devos asset upsert --json` | 写入或更新需求文档、规范、使用文档、避坑知识库与 `run.json` |
| **4** | `update_board_card` | `devos board upsert --json` | 流转看板卡片（**护栏机制：禁止 Agent 跳过提测直接完成**） |
| **5** | `submit_for_testing` | `devos test submit --json` | 提测交接：自动运行冒烟检查，推送 3~5 条白话验收单给用户 |
| **6** | `list_issues` | `devos issue list --json` | 一次性获取用户白话描述、截图、最近 30 秒控制台报错与容器堆栈 |
| **7** | `resolve_issue` | `devos issue resolve --json` | 提交白话修复说明，将 Issue 置为 `ready_for_retest` 并沉淀避坑库 |
| **8** | `request_user_decision` | `devos decision create --json`| 遇到架构二选一或需求歧义时，发起结构化确认 |

---

## 🚀 快速上手与验证

### 1. 运行环境体检
```bash
python3 scripts/preflight_check.py
# 或
cargo run -p devos-cli -- doctor
```

### 2. 初始化一个混合型模板项目
```bash
python3 scripts/scaffold_template.py \
  --template hybrid-starter \
  --dest ./my-first-app \
  --slug my-first-app \
  --name "我的第一个 DevOS 应用"
```

### 3. 查看项目摘要 (CLI JSON 模式)
```bash
cargo run -p devos-cli -- --project-dir ./my-first-app brief --json
```

### 4. 运行桌面工作台
```bash
# 网页开发模式
pnpm dev

# Tauri 桌面端运行
pnpm tauri:dev
```

### 5. 连接外部 Agent 工具
将 `plugins/claude-code/mcp-config.json` 或 `plugins/factory-droid/skill.json` 中的 MCP 命令配置到相应 Agent 工具中即可实现零配置通信。

---

## 📚 详细设计文档索引

- [00-overview-and-protocols.md](docs/00-overview-and-protocols.md): 5 条核心交互链路、三大协议定义与 MCP 8 工具规范
- [01-kickoff.md](docs/01-kickoff.md): Monorepo 工程规划与研发里程碑 DoD
- [02-architecture.md](docs/02-architecture.md): 单体权威真源、本地守护握手、双引擎驱动架构与 Web 报错抓取探针
- [03-dev-standards.md](docs/03-dev-standards.md): Rust/TypeScript/Python 规范与双语隔离设计法则
- [04-reference-study.md](docs/04-reference-study.md): 标杆开源项目（vibe-kanban, kanzo, devcontainer-mcp 等）学习与避坑清单
- [05-flows-and-diagrams.md](docs/05-flows-and-diagrams.md): Mermaid 架构时序图与状态机
- [06-ui-design-guide.md](docs/06-ui-design-guide.md): 4 个核心主视图排版及非开发用户交互底线
