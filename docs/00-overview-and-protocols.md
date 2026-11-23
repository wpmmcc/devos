按你明确的三条核心诉求——**① Agent 插件配置与双向互动、② 应用聚焦“建项目 + 标准/项目管理 + 测试反馈 + Issue 闭环”、③ 兼顾 Web 与后端脚本环境的稳定性与兼容性**——先把最终架构彻底锁死，再逐条拆解核心交互。

---

## 一、 最终确认的架构框架（纯本地、不接管 Agent 会话）

这套架构的核心边界只有一句话：**你的应用是“标准化环境与验收工作台”，Agent 工具是“纯执行引擎”，两者通过“标准化单据（需求/标准/提测单/Issue）”通信，互不越权。**

| 架构层级 | 最终确认技术方案 | 核心职责与解决的问题 |
| --- | --- | --- |
| **1. 桌面工作台（UI 层）** | **Tauri + React + TypeScript** | 面向低开发基础用户：项目创建向导、内嵌轻量看板（4 列状态）、项目标准与文档/知识视图、**Web 预览/脚本测试运行器**、一键提 Issue 面板、环境状态灯。 |
| **2. 本地控制与状态内核** | **Rust 单体核心 + SQLite + 项目目录真源** | 管理多项目独立目录、SQLite 全局索引、端口注册表、本地 IPC/HTTP 服务（`127.0.0.1`）；维护 `requirements/`、`standards/`、`board/`、`issues/`、`docs/`、`knowledge/` 唯一真源。 |
| **3. 环境稳定与兼容层** | **双引擎容器驱动（DDEV + `@devcontainers/cli`）** | **Web/CMS/数据库项目**走 **DDEV**（自动搞定本地域名、HTTPS、数据库与快照）；**后端脚本/API/爬虫/定时任务**走 **Dev Container**（隔离 Python/Node/Go/Rust 等运行时与依赖）；支持同一项目“Web + 后端脚本”混编。 |
| **4. 插件与连接层** | **统一 `devos` CLI + 薄 MCP Server（`stdio`） + 各 Agent 原生 Skill/规则** | 安装到 Claude Code、Factory Droid、Codex、WorkBuddy 等现有 Agent 工具中；不接管对话窗口，只负责自动握手连接本地应用、拉取项目标准/Issue、调用容器执行、回写提测单与进度。 |

### 环境稳定性与跨平台（Win / macOS / Linux）的 4 道底线设计

1. **前置体检（Preflight Doctor）：** 应用启动或新建项目时，自动检测 Docker（Docker Desktop / OrbStack / Colima / Linux Docker）、Windows WSL2、DDEV 及 `@devcontainers/cli` 状态。缺什么直接给白话指引和一键安装/启动入口，不让小白对着终端报错发懵。
2. **双环境清晰分工与兼容：**
* **Web 环境（DDEV）：** 解决多版本 PHP/Node、Nginx/Apache、MySQL/PostgreSQL/Redis 及本地 HTTPS 证书，天然按项目名隔离网络，自带数据库导入与快照回滚。
* **后端脚本环境（Dev Container）：** 解决 Python 虚拟环境冲突、系统级依赖（如 ffmpeg、Playwright 浏览器内核、编译工具链）、后台队列或 CLI 工具隔离；内置非 `root` 用户映射，解决 Linux/macOS 宿主机文件权限锁死问题。


3. **跨端路径与端口防冲突：** Rust 内核统一接管路径规范化与 LF 换行符，消除 Windows 反斜杠和 CRLF 导致的容器脚本报错；维护全局端口分配表，多项目同时启动不撞端口。
4. **快照与安全回滚：** 每次提测或关键改动前支持保存环境/数据快照（代码层结合 Git 轻量存档，数据层走 DDEV 快照或挂载卷备份），测试改坏了能一键回到上一个可用版本。

---

## 二、 核心交互拆解（人、应用、Agent 插件、容器如何联动）

整套产品成败不在技术堆砌，而在下面 **5 条核心交互链路** 是否顺滑、不让小白在工具间迷路。

### 交互 1：插件安装与“零配置”自动握手

用户不需要手改 JSON 配置文件，也不需要记端口号。

1. **一键安装/检测：** 在 DevOS 应用的「连接 Agent 工具」页面，自动扫描本机已安装的 Agent 工具（Droid、Claude Code、Codex、WorkBuddy 等），用户点一下「安装/配置连接」，应用自动写入对应的 MCP 配置与 Skill 规则文件。
2. **自动发现握手：** DevOS 启动后在固定本地路径写入运行时握手文件（如 `~/.devos/daemon.json`，含本地服务端口与临时鉴权 Token）。
3. **无感绑定项目：** 用户在 Agent 工具里打开某个项目目录启动会话时，插件读取目录内的 `devos.json` 和全局 `daemon.json`，自动与 DevOS 应用建立连接并拉取当前项目上下文。应用界面右上角亮起「已连接：某 Agent 工具」状态灯。

### 交互 2：项目创建与“项目标准”注入

建项目以 **DevOS 应用为主入口**（保证目录、权限边界和环境一次到位），Agent 负责在标准框架内干活。

1. **向导式建项：** 用户在 DevOS 点「新建项目」，选择项目形态（**Web 站点/应用**、**后端脚本/自动化工具**、或 **Web + 后端混合**），选好预设模板或空白骨架。
2. **环境与标准同步就绪：** 应用在后台独立目录完成容器初始化（显示进度条），同时生成项目标准文件（`standards/`：目录规范、环境变量规范、提测自检要求、错误处理规范）和 `AGENTS.md`。
3. **交接给 Agent：** 界面出现「在 Agent 中开始」按钮（自动以该项目目录为工作目录唤起用户选定的 Agent），Agent 启动后第一动作就是通过插件读取 `get_project_brief`，拿到项目目标、技术栈、运行环境和所有硬性标准，避免自由发挥写乱结构。

### 交互 3：开发推进与“标准化提测交接”

把“Agent 自己认为写完了”变成“机器先过一遍 + 给小白一张能照着点的验收单”。

1. **Agent 内部静默开发：** 用户在 Agent 工具里正常对话、提需求、确认方案；Agent 调插件里的 `env_exec` 在容器内装依赖、写代码、跑单测。这一阶段的所有试错和命令行噪音都留在 Agent 工具里，不污染 DevOS 界面。
2. **机器预检门禁：** Agent 准备交活时，调用插件工具 `submit_for_testing`。DevOS 内核先在容器里自动跑一遍基础烟雾检查（Web 项目检查服务端口存活、首页无 500/白屏；后端脚本检查依赖完整、入口脚本可正常执行无语法崩溃）。预检不通过直接打回给 Agent 自己修，**绝不把明显跑不起来的半成品推给小白**。
3. **推送白话验收单：** 预检通过后，DevOS 自动把看板卡片移到 `待我测试`，并在卡片里挂出 Agent 生成的 **3～5 条白话验收步骤**（例如：“1. 打开预览页点登录；2. 输入测试账号；3. 确认列表加载出数据”），同时桌面端弹出轻量提醒。

### 交互 4：测试反馈与 Issue 解决闭环（核心差异化）

针对 **Web 环境** 和 **后端脚本环境**，测试和提 Issue 的交互必须区别设计，让小白不用懂技术也能把精准的排障上下文交给 Agent。

* **场景 A：Web 环境测试与反馈**
1. 用户在 DevOS 内嵌预览窗（或带轻量插件的本地预览页）按验收单逐条操作并打勾。
2. 发现不对劲，点旁边的 **「反馈问题 / 提 Issue」**：框选或自动截取当前页面画面，用大白话写一句“点保存按钮没反应”。
3. **后台静默打包上下文：** DevOS 自动把 **页面 URL + 截图路径 + 最近 30 秒浏览器 Console 报错 + 失败的 HTTP 请求 + DDEV 容器后端错误日志** 打包成一条标准 Issue（如 `ISS-004`），落盘到 `issues/` 目录并在看板标红。


* **场景 B：后端脚本环境测试与反馈**
1. 后端脚本（如数据抓取、Excel 处理、定时同步、API 服务）没有网页界面，小白最怕敲命令行。因此约定 Agent 在开发脚本时同步维护一份极简的 **运行声明文件（`devos.run.json`）**，声明脚本名称、需要的几个输入参数（如“目标网址”、“输入文件”）和预期输出物。
2. DevOS 将其渲染为 **可视化测试表单**：小白填好参数、点「运行测试」，应用在 Dev Container 里执行脚本，界面直接展示执行状态（成功/失败）、耗时、生成的结果文件预览或清晰的输出摘要。
3. 一旦执行失败或结果不对，小白只需点 **「一键转为 Issue」** 并补充一句“导出的表格少了日期列”。应用自动把 **输入参数 + 退出码 + 完整 `stdout/stderr` 报错堆栈 + 容器环境信息** 打包成标准 Issue。


* **Issue 回流与解决闭环（Web 与脚本统一）**
1. DevOS 生成 Issue 后，界面给一个「复制指令 / 通知 Agent 处理」（或 Agent 插件在下一轮自动探测到有未处理 Issue）。
2. 用户在 Agent 工具里说一句“处理最新 Issue”，Agent 调用插件 `list_issues`，**一次性拿到用户的白话描述 + 截图/参数 + 精准报错日志**，直接定位修复并在容器内复测。
3. 修复完成后，Agent 调用 `resolve_issue` 附上简短修复说明（例如“已修复保存接口参数校验，并补充日期字段”）并重新触发提测；DevOS 把该 Issue 置为 `待复测`，小白再次点一下确认通过，Issue 自动关闭，经验沉淀进 `knowledge/`，防止后续再犯同类错误。



### 交互 5：环境异常自愈与状态兜底

1. **容器挂了/端口占了：** DevOS 心跳检测发现容器异常，状态灯变红，界面不直接扔出几百行 Docker 日志，而是翻译成具体原因（如“数据库容器意外退出”）+ **「一键重启」** / **「让 Agent 诊断修复」** 两个按钮。
2. **点「让 Agent 诊断修复」：** 应用自动生成一条环境故障诊断单（含容器日志与配置摘要），Agent 通过插件读取后直接修复 `.ddev/` 或 `.devcontainer/` 配置并重新拉起。

---

## 三、 让这套交互真正落地的 3 个设计原则

1. **双语隔离（对人说人话，对 Agent 给结构化数据）：** DevOS 界面上只出现“预览、运行测试、提问题、一键还原、待复测”；落盘到 `issues/`、`board/`、`standards/` 和返回给插件的 JSON 里，则保留完整的路径、堆栈、HTTP 状态码、容器名和命令退出码。
2. **单向事件同步，杜绝状态打架：** 看板状态、Issue 列表、项目标准统一由 Rust 内核读写 SQLite 与项目目录文件；桌面 UI 和 Agent 插件都只通过内核接口（或本地 IPC/CLI）操作数据，避免一边改文件一边改数据库导致状态错乱。
3. **测试脚本声明化（`devos.run.json`）：** 这是把“后端脚本环境”也能做成小白友好测试台的关键支点——只要在项目标准（`standards/`）里规定 Agent 每写一个后端脚本/接口都要顺手更新运行声明，DevOS 就能自动把枯燥的命令行脚本变成小白点得动的测试按钮。

框架与核心交互已经全部对齐。下一步如果要进入工程落地，最核心的切入点是把 **“人机交接的三份核心协议”** 写实——即 **`devos.json` + `devos.run.json`（项目与脚本运行声明）**、**`Issue / Feedback` 标准化 JSON Schema**，以及 **MCP 插件的 8 个核心工具定义**。你可以告诉我先从哪一份协议开始细化。


## 一、项目与脚本运行声明协议（`devos.json` + `devos.run.json`）

所有路径字段在文件内统一使用**相对项目根目录的 POSIX 路径（`/` 分隔）**，由 Rust 内核在 Windows / macOS / Linux 上做本地路径规范化，彻底规避跨平台路径与换行符问题。

### 1. `devos.json`（项目清单与环境声明）

存放在 `<project-root>/devos.json`，作为单项目独立沙盒的唯一入口元数据。

```json
{
  "schema_version": "1.0",
  "project_id": "proj_01JXYZ8K9M2N",
  "slug": "invoice-helper",
  "name": "发票自动整理工具",
  "description": "上传 PDF 发票，自动提取金额与日期并导出 Excel，附带简单网页查看。",
  "project_type": "hybrid",
  "mode": "DEV_LOCAL",
  "created_at": "2026-11-23T06:00:00Z",
  "environments": {
    "web": {
      "enabled": true,
      "driver": "ddev",
      "config_dir": ".ddev",
      "primary_url": "https://invoice-helper.ddev.site",
      "health_check": {
        "url": "https://invoice-helper.ddev.site/health",
        "expect_status": 200,
        "timeout_sec": 10
      },
      "snapshot_supported": true
    },
    "script": {
      "enabled": true,
      "driver": "devcontainer",
      "config_dir": ".devcontainer",
      "service_name": "app",
      "workdir": "/workspace",
      "non_root_user": "vscode",
      "run_manifest": "devos.run.json"
    }
  },
  "workspace_paths": {
    "requirements": "requirements/",
    "standards": "standards/",
    "board": "board/",
    "issues": "issues/",
    "docs": "docs/",
    "knowledge": "knowledge/",
    "artifacts": ".devos/artifacts/"
  },
  "guardrails": {
    "allow_destructive_in_modes": ["DEV_LOCAL"],
    "require_smoke_check_before_testing": true,
    "protected_paths": [".env", ".env.production", ".ddev/config.yaml"]
  }
}

```

**关键字段约束：**

* `project_type`：枚举值 `web`（仅 DDEV）、`script`（仅 Dev Container）、`hybrid`（DDEV 管网页与数据库 + Dev Container 管后端脚本/工具链）。
* `mode`：枚举值 `DEV_LOCAL`、`CONTENT_LOCAL`、`DEPLOY_PROD`，用于控制环境写权限与发布门禁。
* `environments.web.health_check`：用于桌面端红绿灯心跳检测与提测前自动烟雾校验。

---

### 2. `devos.run.json`（后端脚本可视化测试声明）

存放在 `<project-root>/devos.run.json`。Agent 每写完一个后端脚本、爬虫、批处理或 API 任务，需按项目标准同步更新此文件；**DevOS 桌面端据此自动渲染可视化表单**，小白填参数点按钮即可在容器内运行并看结果。

```json
{
  "schema_version": "1.0",
  "targets": [
    {
      "id": "parse_invoices",
      "label": "批量解析 PDF 发票",
      "description": "从指定文件夹读取 PDF，提取抬头、税号、金额并输出 Excel。",
      "env": "script",
      "command": "python scripts/parse_invoices.py --input {{input_dir}} --currency {{currency}} --strict {{strict_mode}} --out {{output_file}}",
      "timeout_sec": 120,
      "inputs": [
        {
          "name": "input_dir",
          "label": "发票所在目录",
          "type": "directory",
          "required": true,
          "default": "sample_data/invoices"
        },
        {
          "name": "currency",
          "label": "默认币种",
          "type": "select",
          "options": ["CNY", "USD", "SGD"],
          "default": "CNY"
        },
        {
          "name": "strict_mode",
          "label": "严格校验税号格式",
          "type": "boolean",
          "default": true
        },
        {
          "name": "output_file",
          "label": "导出文件名",
          "type": "string",
          "default": ".devos/artifacts/invoices_result.xlsx"
        }
      ],
      "expected_outputs": [
        {
          "path": "{{output_file}}",
          "label": "生成的 Excel 报表",
          "preview_type": "table_or_download"
        }
      ],
      "smoke_test": {
        "enabled": true,
        "command": "python scripts/parse_invoices.py --self-check"
      }
    }
  ]
}

```

**关键设计点：**

* `inputs[].type` 支持 `string`、`number`、`boolean`、`select`、`file`、`directory`，Rust 内核执行命令前做参数转义与路径白名单校验，防止命令注入或越出项目目录。
* `smoke_test` 供提测门禁自动调用，确保脚本至少能通过依赖与语法自检。

---

## 二、标准化测试反馈与 Issue 协议（`issues/ISS-xxx.json`）

每条反馈独立落盘在 `<project-root>/issues/ISS-001.json`（同时索引进 SQLite），把**小白的大白话描述**与**应用自动抓取的技术排障包**绑定在一起。

```json
{
  "schema_version": "1.0",
  "issue_id": "ISS-004",
  "status": "open",
  "severity": "high",
  "source_type": "web_preview",
  "linked_card_id": "CARD-012",
  "linked_checklist_step": 2,
  "created_at": "2026-11-23T07:15:20Z",
  "updated_at": "2026-11-23T07:15:20Z",
  "user_report": {
    "title": "点击导出 Excel 按钮没有反应",
    "description": "在发票列表页勾选了 3 条记录，点右上角导出按钮，转了一下圈就没动静，也没下载文件。",
    "expected_behavior": "应该弹出下载框或生成 Excel 文件。"
  },
  "captured_context": {
    "web": {
      "url": "https://invoice-helper.ddev.site/invoices?page=1",
      "viewport": "1440x900",
      "screenshot_path": ".devos/artifacts/ISS-004_screen.png",
      "annotated_region": { "x": 1180, "y": 140, "w": 160, "h": 48 },
      "console_errors": [
        {
          "timestamp": "2026-11-23T07:15:14Z",
          "message": "TypeError: Cannot read properties of undefined (reading 'downloadUrl')"
        }
      ],
      "failed_requests": [
        {
          "method": "POST",
          "url": "/api/invoices/export",
          "status": 500,
          "response_snippet": "{\"error\":\"openpyxl module not found\"}"
        }
      ],
      "backend_logs_tail": [
        "[2026-11-23 07:15:13] ERROR export.py:42 ModuleNotFoundError: No module named 'openpyxl'"
      ]
    },
    "script": null,
    "env_health": null
  },
  "resolution": {
    "resolved_by": null,
    "resolved_at": null,
    "fix_summary_plain": null,
    "changed_files": [],
    "knowledge_entry_id": null
  },
  "retest_history": []
}

```

**当 `source_type` 为 `script_run` 时，`captured_context.script` 填充结构如下：**

```json
{
  "run_target_id": "parse_invoices",
  "command_executed": "python scripts/parse_invoices.py --input sample_data/invoices --currency CNY --strict true --out .devos/artifacts/invoices_result.xlsx",
  "inputs_used": {
    "input_dir": "sample_data/invoices",
    "currency": "CNY",
    "strict_mode": true,
    "output_file": ".devos/artifacts/invoices_result.xlsx"
  },
  "exit_code": 1,
  "duration_ms": 1420,
  "stdout_tail": "Loaded 3 PDF files...",
  "stderr_tail": "KeyError: 'invoice_date' at line 88 in scripts/parse_invoices.py",
  "output_files_generated": []
}

```

**Issue 状态机：**

1. `open`：用户提交，等待 Agent 拉取。
2. `in_progress`：Agent 认领处理中。
3. `ready_for_retest`：Agent 调用 `resolve_issue` 填写白话修复说明（`fix_summary_plain`）并再次通过预检，等待小白复测。
4. `closed` / `reopened`：小白在桌面端点「确认已修好」进入 `closed`；点「还是不行」则追加一条 `retest_history` 并回到 `reopened`。

---

## 三、MCP 插件核心工具协议（8 个标准 Tool 定义）

本地 MCP Server 采用 `stdio` 传输，启动时读取 `~/.devos/daemon.json`（含本地 Rust 守护进程回环端口与一次性会话 Token）和当前工作目录的 `devos.json` 自动完成握手。所有工具本质上是对 `devos <cmd> --json` 的薄封装，**统一返回 `{ "ok": true/false, "data": ..., "error": { "code": "...", "message": "...", "hint": "..." } }**`。

| 序号 | MCP Tool 名称 | 对应 `devos` CLI | 核心输入参数（Schema 摘要） | 核心返回值与护栏行为 |
| --- | --- | --- | --- | --- |
| **1** | `get_project_brief` | `devos brief --json` | `{ include_standards?: boolean, include_open_issues?: boolean }` | 返回项目元信息、当前模式、环境状态、项目标准摘要、未完成看板卡片与待处理 Issue 计数。**Agent 会话起步首选调用，一次拿全上下文。** |
| **2** | `env_control` | `devos env <action> --json` | `{ target: "web" | "script", action: "status" | "up" | "down" | "exec" | "snapshot" | "restore", command?: string, snapshot_name?: string }` | 统一操控 DDEV 或 Dev Container；`exec` 强制在容器内执行并截断超长输出；`restore`/`down` 等破坏性操作受 `devos.json` 的 `guardrails` 模式拦截。 |
| **3** | `sync_project_assets` | `devos asset upsert --json` | `{ asset_type: "requirement" | "doc" | "knowledge" | "run_manifest", id?: string, title: string, content: string, tags?: string[] }` | 写入或更新 `requirements/`、`docs/`、`knowledge/` 或校验更新 `devos.run.json`；写入后自动触发 SQLite 索引更新与桌面端刷新。 |
| **4** | `update_board_card` | `devos board upsert --json` | `{ card_id?: string, title?: string, column: "todo" | "doing" | "testing" | "done", linked_req_id?: string, note?: string }` | 创建或推进看板卡片，系统强制写入 `updated_by: "agent"`。**护栏：禁止 Agent 直接将卡片跨过 `testing` 改为 `done**`（除非项目标准显式允许免测任务）。 |
| **5** | `submit_for_testing` | `devos test submit --json` | `{ card_id: string, summary_plain: string, test_checklist: Array<{ step: number, action: string, expected: string }>, run_target_ids?: string[] }` | **提测门禁核心工具：** 先自动执行 `health_check` 或 `smoke_test`；失败直接打回并附报错日志，不通知用户；通过后将卡片移至 `testing` 并推送白话验收清单到桌面端。 |
| **6** | `list_issues` | `devos issue list --json` | `{ status?: "open" | "reopened" | "in_progress" | "all", include_logs?: boolean }` | 返回标准化 Issue 列表，含小白描述、截图路径、浏览器报错/请求堆栈或脚本退出码与 `stderr`，支持 Agent 一步定位根因。 |
| **7** | `resolve_issue` | `devos issue resolve --json` | `{ issue_id: string, fix_summary_plain: string, changed_files: string[], knowledge_note?: { title: string, content: string } }` | 将 Issue 标记为 `ready_for_retest`，写入白话修复说明；若提供 `knowledge_note` 则同步沉淀到 `knowledge/`，随后桌面端提醒用户复测。 |
| **8** | `request_user_decision` | `devos decision create --json` | `{ question_plain: string, context_plain: string, options: Array<{ id: string, label: string, tradeoff?: string }>, linked_card_id?: string }` | 当需求有歧义或方案需拍板时，登记一条待决策记录（支持终端直接互动回复，也同步在桌面端展示），避免 Agent 擅自猜错方向。 |

---

## 四、三份协议的协同防冲突约定

1. **写入单一入口原则：** 桌面 UI 和 MCP 插件都通过本地 Rust 内核（`devos` CLI / 本地 IPC）读写项目目录文件与 SQLite，文件落盘采用**临时文件 + 原子重命名（atomic rename）**，避免并发写入导致 JSON 损坏。
2. **文件监听与增量刷新：** Rust 内核通过文件系统监听器捕获项目目录变化，仅对变更条目重建 SQLite 索引并经由 Tauri Event 推送给前端看板与 Issue 面板，保证终端操作后桌面端毫秒级同步。
3. **版本向后兼容：** 所有配置文件与单据顶部强制携带 `schema_version`，后续升级协议字段时由 Rust 内核自动做静默迁移，避免老项目打不开。

这三份协议可以直接映射为 Rust 的 `serde` 数据结构与前端 TypeScript 类型定义，后续写 `devos` CLI、本地 MCP Server 和 Tauri 前端时共享同一套 Schema，不会出现字段口径不一致的问题。


这套工程蓝图可直接拆分为仓库内 `docs/` 目录下的 6 份核心文档，与前面已敲定的三份协议（`devos.json` / `devos.run.json`、`issues/ISS-xxx.json`、MCP 8 工具）共同构成完整的项目启动包。

---
