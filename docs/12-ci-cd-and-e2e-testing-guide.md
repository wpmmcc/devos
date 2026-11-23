# 文档 12：CI/CD 自动化多层测试流水线规范 (`12-ci-cd-and-e2e-testing-guide.md`)

## 一、GitHub Actions 免费 Runner 边界与测试分工

| Runner | 原生能力 | 限制 | 测试分工 |
| --- | --- | --- | --- |
| **`ubuntu-latest`** | 原生 Linux Docker、Xvfb 虚拟桌面 | 无 | 真实 DDEV + DevContainer 容器闭环、真实 MCP 闭环、Tauri WebDriver 测试、打包测试 |
| **`windows-latest`** | 原生 WebView2、NSIS 打包 | 无嵌套虚拟化，不支持 Docker Desktop | 安装包安装/升级/卸载、CRLF 与路径兼容、UI 测试（配合 Mock 驱动） |
| **`macos-latest`** | 原生 `.dmg` 打包、代码签名校验 | 免费节点跑完整 Linux Docker 慢且不稳定 | `.dmg` 挂载安装/卸载/热更新验证、Rust 单测、前端组件测试 |

---

## 二、五层自动化测试架构

1. **第 1 层：协议与内核单元测试（三端必跑，每次 PR，约 3 分钟）**：
   - Schema 与 TypeScript 类型一致性校验（`ts-rs` + `git diff --exit-code`）。
   - 文件原子读写与 SQLite 全量重建无损校验。
   - 路径穿越与三态门禁拦截测试。
   - 网络镜像源故障降级测试（wiremock 模拟超时、校验失败、断点续传）。
2. **第 2 层：插件与 Agent 交互模拟（确定性 Mock Agent，零 LLM 费用）**：
   - 插件写入幂等性测试（覆盖临时隔离目录，断言原配置不被损坏）。
   - 完整 MCP 协议闭环回放（brief -> submit_for_testing 报错打回 -> 修复后通过 -> 提 Issue -> resolve_issue 沉淀知识库）。
3. **第 3 层：真实容器环境 E2E（在 `ubuntu-latest` 跑真实 Docker）**：
   - DDEV 启动、健康检查、500 日志抓取、snapshot 与 restore。
   - DevContainer 运行 Python 脚本生成产物，异常参数退出码与 stderr 校验。
4. **第 4 层：桌面端 UI 与 Web 预览探针测试**：
   - Playwright 测试前端交互与双语文案（断言主界面不露技术黑话）。
   - `tauri-driver` 真实窗口测试报错探针上报。
5. **第 5 层：客户端安装、更新、卸载全生命周期测试**：
   - 客户端内置 `--smoke-test` 参数进行无头自检。
   - 静默安装、冒烟启动、卸载断言（断言用户测试项目目录绝不被误删）。
   - `tauri-plugin-updater` 离线自建 HTTP 服务模拟 `v0.0.1 -> v0.0.2` 升级与数据继承。

---

## 三、架构上的 3 个预留口子
1. `DEVOS_ENV_DRIVER=mock` 内存模拟驱动。
2. 端点与目录环境变量覆盖（`DEVOS_MIRROR_MANIFEST_URL`, `DEVOS_UPDATER_ENDPOINT`, `DEVOS_HOME`）。
3. 内置 `--smoke-test` 探针模式。
