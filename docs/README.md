# DevOS 文档索引

欢迎查阅 DevOS 系统需求与架构设计全套文档。

## 目录指南

- [00-overview-and-protocols.md](./00-overview-and-protocols.md): 最终确认架构框架、5条核心交互链路拆解、三大核心协议定义（`devos.json`、`devos.run.json`、`issues/ISS-xxx.json`、MCP 8大工具规范）
- [01-kickoff.md](./01-kickoff.md): Monorepo 工程结构、4大研发里程碑与验收标准（DoD）
- [02-architecture.md](./02-architecture.md): 系统架构设计、单体权威真源、本地守护握手、双引擎驱动设计与 Web 报错抓取探针
- [03-dev-standards.md](./03-dev-standards.md): Rust/TypeScript/Python 开发规范、双语隔离准则、原子写入与安全防御
- [04-reference-study.md](./04-reference-study.md): 5大标杆开源项目（vibe-kanban, kanzo, devcontainer-mcp, ddev-mcp, Archon/OpenSpec）取舍与学习清单
- [05-flows-and-diagrams.md](./05-flows-and-diagrams.md): 核心流程图与状态机（系统数据流、握手时序、提测与 Issue 闭环、三态门禁）
- [06-ui-design-guide.md](./06-ui-design-guide.md): 标杆产品 UI 借鉴点、4个核心主视图排版及非开发用户交互底线
- [07-agent-adapter-and-plugin-guide.md](./07-agent-adapter-and-plugin-guide.md): 国内外 9+ 款主流 Agent 工具适配矩阵、5 步安全无损安装、免打扰白名单与引导交互
- [08-ux-logging-update-i18n.md](./08-ux-logging-update-i18n.md): 零登录极简交互、三层日志与脱敏诊断包、GitHub Releases 自动更新、全链路多语言（i18n）
- [09-release-perf-compat.md](./09-release-perf-compat.md): 双轨制更新模式、目录物理三权分立、静默驻留性能红线与三大平台兼容坑规避
- [10-decoupling-and-conflict-isolation.md](./10-decoupling-and-conflict-isolation.md): 六边形防腐层架构、应用内部冲突（容器/端口/写入/回声）与宿主机存量服务零侵入共存治理
- [11-multi-project-multi-agent-model.md](./11-multi-project-multi-agent-model.md): 多项目并行与多 Agent 协同实体关系模型（N:M 映射与绑定规则、5层隔离边界、4大安全防线、防呆交互）
- [12-delivery-and-deploy-plugins.md](./12-delivery-and-deploy-plugins.md): 标准交付打包与部署插件设计（标准交付包 `releases/vX.Y.Z/`、`release-manifest.json`、`DEPLOY.md`、插件生命周期与 AI 生产防火墙）
- [13-engineering-pitfalls-and-production-baselines.md](./13-engineering-pitfalls-and-production-baselines.md): 隐蔽工程坑（孤儿进程清理/非标路径防雷/JSON宽容自愈/Git快照隔离）、极简体验拼图与生产级安全性能稳定性底线
- [14-unified-command-protocol-and-control-plane.md](./14-unified-command-protocol-and-control-plane.md): 统一指令总线、CLI / MCP / UI / 插件协议总规范（单总线四端映射、L0~L3统一权限分级、7大域能力映射总表、统一返回信封与错误码规范）
- [15-preflight-mirror-network-guide.md](./15-preflight-mirror-network-guide.md): 轻量工具私有化托管、重型底座向导安装、中国大陆 4 层网络加速与 2 秒并发测速
- [16-ci-cd-and-e2e-testing-guide.md](./16-ci-cd-and-e2e-testing-guide.md): GitHub Actions 免费 Runner 边界分工与五层自动化测试架构（单元/Mock Agent/容器E2E/UI探针/安装包生命周期）
