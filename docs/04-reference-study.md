## 文档 4：参考项目学习清单与拆解指南（`04-reference-study.md`）

拉取开源项目学习时，**只学对应的局部设计，坚决不照搬整套定位**（尤其是避开“接管 Agent 会话”的重型逻辑）：

| 参考项目 | 优先学习的模块与代码设计 | 明确不学的部分（避坑） |
| --- | --- | --- |
| **`klaviyo/vibe-kanban-local`** | 1. Rust + SQLite + TypeScript 工程组织<br>

<br>2. 本地端口握手发现机制<br>

<br>3. `vibe-kanban-tools.json` 把本地脚本挂成可视化工具按钮的思路 | 不学它的多 Agent 终端进程托管与 Worktree 调度器 |
| **`emanuele-em/kanzo`** | 1. 极简 Rust + SQLite 看板表结构与低内存占用设计<br>

<br>2. MCP 工具如何极简地认领/流转看板卡片 | 它的看板偏纯任务，需自行补齐需求/文档/知识与提测验收单 |
| **`aniongithub/devcontainer-mcp`** | 1. 驱动 `@devcontainers/cli` 的生命周期封装与错误自愈回环<br>

<br>2. 通过 `SessionStart` / `PreToolUse` Hook 注入 `SKILL.md` 引导 Agent 走容器执行 | 不把容器逻辑直接写死在 MCP 进程里，而是下沉到你的 `devos-env` |
| **`AkibaAT/ddev-mcp` & `trebormc/ddev-opencode**` | 1. DDEV 常用命令（启停、状态、快照、日志）的结构化解析<br>

<br>2. 配合 Playwright 做提测前基础页面健康检查的思路 | 不学它把 Agent 塞进 Drupal/服务端重容器套件的做法 |
| **`coleam00/Archon` & `OpenSpec**` | 1. 项目需求 $\rightarrow$ 标准规范 $\rightarrow$ 验收清单的结构化 Markdown 组织方式<br>

<br>2. 关键节点暂停等待人类确认的审批流状态机 | 不引入它较重的向量检索/独立后端服务栈，初期用本地 SQLite FTS 足够 |

---
