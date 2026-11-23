# AI Agent 开发规范与交互指南

欢迎使用 DevOS 托管环境。本项目采用 DevOS 进行环境隔离、标准规范注入与测试验收。

## 1. 规范边界
- 严禁擅自修改 `.ddev/config.yaml` 或根目录核心容器配置。
- 所有落盘文件一律强制使用 LF (`\n`) 换行符。
- 所有路径配置统一使用相对项目根目录的 POSIX 路径 (`/`)。

## 2. 核心工作流
1. 调用 `get_project_brief` 获取需求、标准和待处理 Issue。
2. 在 DDEV 或 Dev Container 容器沙盒中执行所有测试与依赖安装。
3. 若修改了后端脚本，必须同步更新 `devos.run.json`。
4. 任务开发完成，调用 `submit_for_testing` 并附带 3~5 条白话验收步骤。
5. 用户反馈 Issue 时，调用 `list_issues` 获取完整报错上下文，修复后调用 `resolve_issue` 提请复测。
