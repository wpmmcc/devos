# 文档 07：Agent 适配器与插件安装规范 (`07-agent-adapter-and-plugin-guide.md`)

## 一、国内外主流 Agent 工具适配矩阵

适配器层（`crates/devos-core/src/adapters/`）按声明式配置维护下表，支持随 `agent-adapters.json` 一同热更新，避免工具改路径就必须发桌面端大版本。

### 1. 中国大陆主流 Agent 工具

| 工具名称 | 本机扫描探测信号 | MCP 配置文件路径（全局 / 项目） | Skills / Hooks / 插件目录 | 用户手动安装实现方式 |
| --- | --- | --- | --- | --- |
| **腾讯 CodeBuddy Code / WorkBuddy** | 检测 `codebuddy` 命令、`~/.codebuddy/`（Win: `%USERPROFILE%\.codebuddy`）或环境变量 `CODEBUDDY_CONFIG_DIR` | 全局：`~/.codebuddy/.mcp.json` | `~/.codebuddy/skills/`；支持原生插件与 Hooks | **自动合并写入**：向 `.mcp.json` 注入 `devos` 条目，并将 `devos` Skill 写入 `skills/`；注意兼容 `CODEBUDDY_CONFIG_DIR` 避免与多实例冲突。 |
| **字节 TRAE（国内版 / 国际版）** | 检测安装目录（macOS `/Applications/TRAE.app`、Win 注册表/`%LOCALAPPDATA%`）及 `~/.trae/` | 项目：`.trae/mcp.json`（需用户在设置开启项目级 MCP 开关）<br>全局：通过 IDE 设置页添加 | Skills：`~/.trae/skills/`、`.trae/skills/` 或共享 `.agents/skills/`<br>Hooks：`~/.trae/hooks.json`、`.trae/hooks.json`（亦兼容 Claude Hooks） | **混合模式**：项目级直接写入 `.trae/mcp.json` 与 `.agents/skills/`；全局提供「一键复制配置 JSON + 3 步图文引导」引导用户在 TRAE 设置里粘贴确认。 |
| **阿里 Qoder CLI / IDE** | 检测 `qoder` 命令及 `~/.qoder/` | 全局：`~/.qoder/settings.json`（`mcpServers` 键）<br>项目：`.qoder/settings.json` 或 `.qoder/settings.local.json` | 原生插件目录 `.qoder-plugin/plugin.json`（含 `skills/`、`hooks/`、`mcpServers`） | **优先调原生 CLI / 插件包**：调用 `qoder mcp add` 或合并写入 `settings.json`，并可选写入 `alwaysAllow` 放行只读工具。 |
| **Kimi Code** | 检测 `kimi` / `kimi-code` 命令及 `~/.kimi-code/`（或 `$KIMI_CODE_HOME`） | 全局：`~/.kimi-code/mcp.json`<br>项目：`.kimi-code/mcp.json` | 遵循项目级 `AGENTS.md` 与通用 `.agents/skills/` | **自动合并写入**：标准 JSON `mcpServers` 注入。 |

### 2. 国外主流 Agent 工具

| 工具名称 | 本机扫描探测信号 | MCP 配置文件路径与格式特点 | Skills / Rules / Hooks | 用户手动安装实现方式 |
| --- | --- | --- | --- | --- |
| **Claude Code** | 检测 `claude` 命令及 `~/.claude/`、`~/.claude.json` | 全局：`~/.claude.json`<br>项目：`.mcp.json`（JSON，`mcpServers`） | `CLAUDE.md`、`.claude/skills/*/SKILL.md`、`.claude/settings.local.json`（Hooks & 权限） | **优先调 `claude mcp add-json`** 或无损合并 JSON；同步注册 `SessionStart` 轻 Hook 提醒拉取 Brief。 |
| **OpenAI Codex CLI** | 检测 `codex` 命令及 `~/.codex/` | 全局：`~/.codex/config.toml`<br>项目：`.codex/config.toml`（**TOML 格式**） | `AGENTS.md`、`~/.codex/skills/` / `.codex/skills/` | 使用 Rust **`toml_edit`** 保留原注释无损插入 `[mcp_servers.devos]` 节点，并按需写单工具 `approval_mode`。 |
| **Factory Droid** | 检测 `droid` 命令及 `~/.factory/` | 全局：`~/.factory/mcp.json`<br>项目：`.factory/mcp.json` | `AGENTS.md`、Skills 与 Hooks | **自动合并写入**：向 `mcp.json` 注入 `devos` 服务并同步项目规则。 |
| **OpenCode** | 检测 `opencode` 命令及 `~/.config/opencode/` | 全局：`~/.config/opencode/opencode.json(c)`<br>项目：`opencode.json(c)`（**根键为 `mcp`，命令为数组**） | `AGENTS.md`、`~/.config/opencode/` / `.opencode/` | 专用格式适配器写入 `mcp.devos`（含 `type` 与 `command` 数组），兼容带注释 JSONC。 |
| **Cursor / VS Code / Windsurf** | 检测桌面应用路径及 `~/.cursor/`、`~/.codeium/windsurf/` | Cursor：`~/.cursor/mcp.json`<br>VS Code：`.vscode/mcp.json`（**根键为 `servers`**）<br>Windsurf：`~/.codeium/windsurf/mcp_config.json`（仅全局） | `.cursor/rules/*.mdc`、`.agents/skills/`（VS Code 原生读取） | 自动合并写入对应 JSON，遇到仅支持全局的客户端自动隐藏“项目级安装”开关。 |

---

## 二、本机扫描探测引擎设计（Agent Scanner）

在 DevOS 桌面端的「连接 Agent 工具」页面，扫描过程必须**只读、毫秒级、零侵入**：

1. **三层探测策略（按优先级）：**
   - **CLI 探测**：在用户登录 Shell 的 `PATH` 以及常见私有安装路径（如 `~/.local/bin`、`%LOCALAPPDATA%\codebuddy\bin`、`~/.npm-global/bin`）查找可执行文件，不直接盲目执行未知二进制，仅在命中后轻量调用 `--version`。
   - **配置目录探测**：检查各工具标准配置目录（如 `~/.claude`、`~/.codebuddy`、`~/.qoder`、`~/.trae`、`~/.factory`、`~/.codex`）是否存在。
   - **桌面端探测**：macOS 扫描 `/Applications/*.app`；Windows 扫描卸载注册表与 `%LOCALAPPDATA%\Programs\`；Linux 扫描 `.desktop` 文件。

2. **输出 4 种清晰状态给小白：**
   - `已安装 · 未连接`（显示主按钮：**「安装 DevOS 插件」**）
   - `已连接 · 正常`（检测到配置中已存在 `devos` 且指向当前 `devos-mcp` 路径与最新版本，显示 **「测试连接」/「卸载插件」**）
   - `已连接 · 需更新`（插件版本低于当前 DevOS 版本，或 `devos-mcp` 路径已失效，显示 **「一键更新」**）
   - `未检测到`（折叠在页面底部，附带“如果装在自定义路径，可手动指定目录”入口）

---

## 三、用户手动安装与卸载的安全机制（绝不弄坏用户原有配置）

由用户手动点按钮触发安装时，Rust 适配器层必须严格执行以下 5 步安全流水线：

1. **变更前备份（Backup First）：** 写入任何外部配置文件前，先拷贝一份带时间戳的备份到 `~/.devos/backups/<agent>/<filename>.bak`（每个工具保留最近 5 份），出问题可一键还原。
2. **非破坏性局部合并（Surgical Merge）：**
   - 绝不整文件覆盖！只读取原文件并精准增删/更新名为 `devos` 的 MCP 服务节点。
   - 对 TOML（Codex）使用 `toml_edit` 保留用户原有注释与排版；对 JSONC（OpenCode / VS Code）先做注释保留解析或安全合并，严禁破坏用户已配好的其他 MCP。
3. **全局 vs. 项目级作用域分工（最佳实践）：**
   - **全局安装（推荐默认）**：把 `devos-mcp` 注册到工具的全局配置中。这样用户在 DevOS 里建 10 个项目，都不需要重复装插件；`devos-mcp` 启动时自动按当前工作目录（`cwd`）向上查找 `devos.json` 动态绑定项目。
   - **项目级资产（自动生成）**：建项目时，DevOS 在项目根目录同步生成 `AGENTS.md` 以及通用 `.agents/skills/devos/SKILL.md`（VS Code、TRAE、Codex、OpenCode 等工具共用 `.agents/skills/` 约定）。
4. **安装后即时自检（Post-Install Verify）：** 写入完成后，DevOS 后台直接拉起一次 `devos-mcp --self-check`，验证二进制可执行权限、握手文件可读性以及目标配置文件语法校验无误，再把卡片状态切为绿色「已连接」。
5. **一键干净卸载：** 用户点「断开/卸载插件」时，精确移除配置文件中的 `devos` 节点以及 `devos` 专属 Skill 文件夹，不动用户的任何其他配置。

---

## 四、权限最小化与“免打扰”配置约定

国内外工具（如 Claude Code、Codex、Qoder、WorkBuddy）对 MCP 工具均有审批策略：

- **只读与常规同步工具默认放行：** 适配器在支持白名单的工具（如 Qoder 的 `alwaysAllow`、Claude Code 的 `settings.local.json`、Codex 的 `approval_mode`）中，可由用户勾选是否自动放行 `get_project_brief`、`list_issues`、`update_board_card`、`sync_project_assets`，减少小白被反复弹窗打断。
- **环境执行与破坏性动作保留门禁：** `env_control` 中的破坏性子动作（`restore`/`down`）和 `DEPLOY_PROD` 相关操作不放进自动白名单，由 Agent 工具审批与 DevOS 本地三态门禁双重兜底。

---

## 五、针对无法直接写全局配置的工具的兜底交互

少数桌面端 IDE（例如部分版本的 TRAE 全局 MCP 或封闭式桌面端）可能把全局配置存放在加密数据库或仅允许 UI 手动添加。针对这类工具，适配器声明 `install_mode: "guided_manual"`，用户点击「安装插件」时弹出一个极简 3 步引导窗：

1. 显示已生成好的标准 JSON 配置块 + 「一键复制配置」按钮（路径已自动填好本机 `devos-mcp` 的绝对路径）；
2. 给出 2 行大白话指引（例如“打开 TRAE $\rightarrow$ 设置 $\rightarrow$ MCP $\rightarrow$ 手动添加 $\rightarrow$ 粘贴确认”）；
3. 底部放一个 「我已粘贴，检测连接」按钮，验证通过即完成接入。
