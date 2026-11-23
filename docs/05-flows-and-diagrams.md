## 文档 5：核心流程图与状态机图例（`05-flows-and-diagrams.md`）

以下 Mermaid 图表可直接粘贴到 GitHub、Notion、Obsidian 或静态文档站中渲染。

### 图 1：系统分层与数据流总图

```mermaid
flowchart TB
    subgraph Desktop["1. Tauri 桌面工作台 (React + TS)"]
        UI_Wizard["项目向导 & 体检"]
        UI_Board["4列轻量看板"]
        UI_Test["Web预览 / 脚本表单测试台"]
        UI_Issue["一键提 Issue 抽屉"]
    end

    subgraph Core["2. Rust 本地内核 (devos-core + SQLite)"]
        API["本地 IPC / 回环服务"]
        Store["原子文件读写 + SQLite 索引"]
        Watcher["文件监听器 & 事件推送"]
        PortMgr["端口注册表 & 三态门禁"]
    end

    subgraph Env["3. 双引擎环境层 (devos-env)"]
        DDEV["DDEV Driver (Web/DB/HTTPS)"]
        DC["DevContainer Driver (后端脚本/工具链)"]
    end

    subgraph Agent["4. 外部 Agent 工具 (Droid / Claude / WorkBuddy)"]
        Session["原生终端对话与内部试错"]
        Plugin["薄 MCP Server + devos CLI + SKILL.md"]
    end

    Desktop <-->|"Tauri IPC / Event"| API
    Agent <-->|"stdio MCP / --json"| Plugin
    Plugin <-->|"读取 daemon.json 握手"| API
    API --> Store
    Watcher -->|"增量刷新 UI"| Desktop
    API --> PortMgr
    PortMgr --> DDEV
    PortMgr --> DC

```

### 图 2：Agent 插件零配置握手与双端联动时序图

```mermaid
sequenceDiagram
    actor User as 小白用户
    participant App as DevOS 桌面端
    participant Core as Rust 内核 (devos-core)
    participant Agent as 外部 Agent 工具 + 插件
    participant Env as 容器环境 (DDEV / DevContainer)

    User->>App: 1. 新建项目（选模板 + 填名称）
    App->>Core: 初始化独立目录、devos.json、AGENTS.md
    Core->>Env: 后台拉起容器并做健康体检
    Env-->>App: 状态灯变绿（可预览）

    User->>App: 2. 点击「在 Agent 中开始」
    App->>Agent: 以项目目录为 cwd 唤起 Agent 会话
    Agent->>Core: 插件读取 daemon.json 自动握手
    Agent->>Core: 调用 get_project_brief()
    Core-->>Agent: 返回需求、项目标准、环境状态与看板摘要

    User->>Agent: 3. 终端内对话提需求、回答追问
    Agent->>Env: 通过 env_control 在容器内写代码/跑单测
    Agent->>Core: 调用 submit_for_testing(白话验收清单)
    Core->>Env: 自动执行 Smoke Check（健康检查/脚本自检）
    Env-->>Core: 预检通过
    Core-->>App: 推送事件：卡片进入「待我测试」并提醒用户

```

### 图 3：提测门禁与 Issue 解决闭环（Web + 后端脚本双通道）

```mermaid
flowchart TD
    A["Agent 调用 submit_for_testing"] --> B{"机器自动预检<br/>(Web健康检查 / 脚本自检)"}
    B -->|"失败（白屏/500/语法错）"| C["直接打回给 Agent<br/>附完整错误日志（不打扰用户）"]
    C --> A
    B -->|"通过"| D["卡片进入「待我测试」<br/>桌面端展示白话验收清单"]

    D --> E{"项目测试类型"}
    E -->|"Web 环境"| F1["内嵌预览窗按清单操作<br/>点击「提问题」截图标注"]
    E -->|"后端脚本环境"| F2["devos.run.json 表单填参运行<br/>结果异常点「一键转 Issue」"]

    F1 --> G1["后台静默打包：<br/>截图 + URL + Console/HTTP报错 + 容器日志"]
    F2 --> G2["后台静默打包：<br/>输入参数 + 退出码 + stdout/stderr堆栈"]

    G1 --> H["落盘 issues/ISS-xxx.json<br/>状态：open"]
    G2 --> H

    H --> I["Agent 拉取 list_issues<br/>定位根因并容器内修复"]
    I --> J["Agent 调用 resolve_issue<br/>写白话修复说明 + 沉淀知识"]
    J --> K["Issue 状态：ready_for_retest<br/>桌面端提醒用户复测"]
    K --> L{"用户复测结果"}
    L -->|"确认已修好"| M["Issue 关闭 (closed)<br/>全部通过后卡片进「已完成」"]
    L -->|"还是不行"| N["追加复测记录 (reopened)<br/>再次回流 Agent"]
    N --> I

```

### 图 4：三态模式权限与安全门禁状态图

```mermaid
stateDiagram-v2
    [*] --> DEV_LOCAL: 新建项目默认进入
    DEV_LOCAL: 本地开发态 (DEV_LOCAL)
    DEV_LOCAL: 允许改代码、装依赖、重置/快照环境

    CONTENT_LOCAL: 内容与验收态 (CONTENT_LOCAL)
    CONTENT_LOCAL: 锁定核心代码架构，专注内容录入与测试反馈

    DEPLOY_PROD: 发布交付态 (DEPLOY_PROD)
    DEPLOY_PROD: 禁止破坏性本地调试动作，强制发布前配置与密钥检查

    DEV_LOCAL --> CONTENT_LOCAL: 基础功能提测通过
    CONTENT_LOCAL --> DEV_LOCAL: 需修改代码结构 / 修深层 Bug
    CONTENT_LOCAL --> DEPLOY_PROD: 验收清单全部通过
    DEV_LOCAL --> DEPLOY_PROD: 跳过内容态直接预检发布
    DEPLOY_PROD --> DEV_LOCAL: 发布回退 / 开启下一轮迭代

```

---
