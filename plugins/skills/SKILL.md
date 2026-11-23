---
name: devos-agent-skill
description: DevOS Agent Collaboration & Quality Control Skill. Instructs AI Agents on how to interact with DevOS local environments, board workflows, automated test gates, and issue resolution loops.
---

# DevOS Agent 协作与质量交付技能

作为参与本项目的 AI 助手，你的角色是**“纯执行引擎”**，而 DevOS 是**“标准化环境与验收工作台”**。两者通过标准化单据与 MCP 工具进行通信。

## 核心交互铁律与行为护栏

1. **会话启动第一动作：** 必须调用 MCP 工具 `get_project_brief`，一次性获取项目形态、环境状态、当前项目硬性标准以及未解决的 Issue 列表。
2. **所有代码与命令在容器内执行：** 严禁直接在宿主机执行重依赖或编译构建命令。统一调用 `env_control(action: "exec", command: "...")` 在 DDEV 或 Dev Container 隔离沙盒中运行。
3. **保持声明文件最新：** 针对后端脚本、数据处理或批处理任务，每新增一个入口或接口，必须在项目根目录同步维护 `devos.run.json`，为低开发基础用户提供可视化点选表单。
4. **禁止跨过提测直接完成任务：** 护栏强制规定：Agent 严禁直接将看板卡片从 `todo` 或 `doing` 修改为 `done`。必须调用 `submit_for_testing`。
5. **机器预检与白话验收单：**
   - 准备交活前，必须先在容器内做基础健康或冒烟自检（确保无 500、白屏或语法崩溃）。
   - 提测清单必须提供 3~5 条“小白照着就能点”的白话验收步骤（例如：“1. 打开预览页；2. 输入测试账号；3. 确认列表加载出数据”）。
6. **Issue 排障与解决闭环：**
   - 用户测试遇到问题时，调用 `list_issues` 即可一次性拿到用户的白话描述、截图路径、最近 30 秒浏览器 Console 报错及后端堆栈。
   - 修复完成后调用 `resolve_issue`，附带简明清晰的白话修复说明，并可选择沉淀经验到 `knowledge/` 避坑库。

## MCP 8 大核心工具速查

- `get_project_brief`: 获取项目元数据、环境与规范上下文
- `env_control`: 容器启停、状态查询、容器内命令执行、快照与还原
- `sync_project_assets`: 资产读写（需求、文档、避坑知识、run.json）
- `update_board_card`: 看板任务流转（禁止直接移至 done）
- `submit_for_testing`: 标准化提测（附带白话验收单，触发机器预检）
- `list_issues`: 拉取标准化技术排障上下文
- `resolve_issue`: 提交白话修复说明并标记待复测
- `request_user_decision`: 方案二选一或需求拍板询问
