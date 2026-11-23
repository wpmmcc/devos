## 文档 3：开发规范文档（`03-dev-standards.md`）

### 3.1 Rust 后端规范（`devos-core` / `devos-env` / `devos-cli` / `devos-mcp`）

1. **错误体系：** 库层（`core` / `env`）统一使用 `thiserror` 定义可枚举的错误码（如 `ENV_DOCKER_NOT_RUNNING`、`GUARDRAIL_MODE_BLOCKED`）；每个对外错误必须附带 `hint` 字段（给 Agent 的下一步修复建议）和 `plain_message` 字段（给小白看的人话）。
2. **文件写入原子性：** 严禁直接 `fs::write` 覆盖 JSON/Markdown 文件。统一封装 `atomic_write(path, content)`（先写同目录 `.tmp` 临时文件，再 `rename` 替换），杜绝多进程并发写坏状态文件。
3. **跨平台铁律：**
* 所有落盘路径一律转为相对 POSIX 风格（`/`）；调用系统 API 前再转为本机 `PathBuf`。
* 生成脚本、`.ddev/`、`.devcontainer/`、`AGENTS.md` 时强制使用 **LF（`\n`）** 换行符，禁止在 Windows 下写入 CRLF 导致容器内脚本报错。


4. **命令执行安全：** 执行 `devos.run.json` 里的命令时，禁止直接拼字符串丢给 `sh -c`；优先使用参数数组传参，并对 `file` / `directory` 类型输入做 `canonicalize` 校验，确保路径严格位于 `<project-root>` 内部。

### 3.2 TypeScript / React 前端规范（`apps/desktop`）

1. **类型零手写：** 所有核心数据结构（Project、Card、Issue、RunManifest）全部由 `crates/devos-schema` 通过 `ts-rs` 自动生成到 `apps/desktop/src/types/generated/`，CI 检查生成文件是否同步。
2. **双语文案隔离规范（核心产品规范）：**
* 界面主视图严禁直接暴露 `exit_code`、`stderr`、`devcontainer.json`、`SQLite`、`MCP`、`stdout` 等开发术语。
* 所有技术细节统一折叠进「查看技术详情（给 AI 或开发者排障用）」手风琴面板。
* 按钮文案使用结果导向动词：用「启动预览」替代「ddev start」，用「保存当前状态」替代「创建快照」，用「告诉 AI 修复」替代「导出 Issue JSON」。



### 3.3 Python 辅助脚本规范（`scripts/`）

* **职责严格受限：** Python 仅负责项目模板脚手架渲染、预设知识文档生成、离线校验与批量数据转换，**严禁直接操作 SQLite 或绕过 `devos-core` 修改看板与 Issue 状态**。
* **无第三方重依赖：** 尽量使用 Python 标准库（`pathlib`、`json`、`shutil`），避免给跨平台桌面安装包增加打包体积和环境故障点。

### 3.4 Git 与协议版本规范

* 提交信息遵循 Conventional Commits：`feat(env): ...`、`fix(mcp): ...`、`docs(protocol): ...`。
* 协议字段升级遵循向后兼容原则：新增字段必须提供默认值；破坏性变更必须递增 `schema_version` 并在 `devos-core` 中注册对应的静默迁移函数（`migrate_v1_to_v2`）。

---
