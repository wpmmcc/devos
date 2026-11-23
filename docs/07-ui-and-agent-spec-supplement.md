整个桌面应用（Tauri 2 + React + TypeScript）采用**固定三段式全局壳 + 6 个核心工作区视图**。下面先给出各页面的空间分区布局与关键控件，再列出 Windows、macOS、Linux 三端桌面 WebView 以及 Agent CLI 终端的界面开发避坑点。

---

## 一、 全局外壳与各核心页面布局

### 1. 全局主框架（Global Shell）

所有业务页共享这套外框，确保小白随时能看到“我在哪个项目、环境健不健康、AI 连上了没”。

| 左侧导航栏（固定 `220px`，可折叠至 `60px`） | 顶部控制条（固定高度 `52px`，全宽自适应） |
| --- | --- |
| **顶部**：应用 Logo + 「+ 新建项目」主按钮<br>

<br>**中部（项目列表）**：<br>

<br>• 项目卡片（项目名 + 绿/灰/红环境圆点）<br>

<br>• 展开当前项目的 4 个子入口：<br>

<br>  1. 看板与进度<br>

<br>  2. 测试与预览台<br>

<br>  3. Issue 反馈中心（带红点数字）<br>

<br>  4. 项目资产（需求/标准/文档/知识）<br>

<br>**底部**：<br>

<br>• 「连接 Agent 工具」入口（带已连接数量）<br>

<br>• 环境体检（Preflight Doctor）状态入口<br>

<br>• 设置 | **左侧**：当前项目名 + 三态模式胶囊标签（`本地开发中` / `验收中` / `发布态`，点击切换）<br>

<br>**中间**：环境状态灯（`Web 运行中` / `脚本就绪`）+ Agent 握手灯（`已连接：Factory Droid`）<br>

<br>**右侧动作组**：<br>

<br>• `[启动 / 停止环境]` 主按钮<br>

<br>• `[保存 / 还原状态]`（快照下拉）<br>

<br>• `[在 Agent 中打开]` 快捷按钮 |
| *（左侧栏底部固定）* | **主工作区（Fluid 自适应，独立滚动，背景浅灰 `#F7F8FA`）** |

---

### 2. 项目创建向导 & 环境体检页（Onboarding / New Project）

采用**居中分步卡片（最大宽度 `760px`）**，把 Docker/DDEV 检测前置，避免建到一半报错。

| 步骤条（顶部居中）：`1. 环境体检` $\rightarrow$ `2. 选择项目形态` $\rightarrow$ `3. 基本信息与初始化` |
| --- |
| **Step 1（环境体检卡片）**：<br>

<br>• 列表逐项展示：Docker 引擎、WSL2（仅 Windows 显示）、DDEV、Dev Container CLI。<br>

<br>• 每项右侧仅 3 种状态：`已就绪（绿勾）` / `未启动（点此一键启动）` / `未安装（白话安装指引）`。 |
| **Step 2（三选一大卡片，3 列等宽）**：<br>

<br>• **Web 站点/应用**（自动配 DDEV：含域名、HTTPS、数据库）<br>

<br>• **后端脚本/自动化**（自动配 Dev Container：Python/Node 隔离运行）<br>

<br>• **Web + 后端混合**（双引擎同时启用）<br>

<br>• 下方附可选预置模板网格（如 WordPress 站点、数据抓取脚本、空白项目）。 |
| **Step 3（初始化进度面板）**：<br>

<br>• 项目名称、一句话简介、存放路径（默认工作区自动生成）。<br>

<br>• 点击「创建」后切换为**分阶段进度条**（`1/3 创建独立目录与标准` $\rightarrow$ `2/3 初始化容器环境` $\rightarrow$ `3/3 生成 AGENTS.md`），底部提供可折叠的「查看底层日志」。<br>

<br>• 完成后主按钮变为：**「在 Agent 中开始开发」** + 次按钮 **「进入项目看板」**。 |

---

### 3. 看板与进度页（Board）

采用 Linear 风格的**紧凑 4 列横向流转视图**，单列固定宽度 `280px–320px`，超出横向滚动；点击卡片从右侧滑出详情抽屉（`420px`）。

| `待开发 (todo)` | `开发中 (doing)` | `待我测试 (testing)`（高亮淡蓝边框） | `已完成 (done)` |
| --- | --- | --- | --- |
| 卡片示例：<br>

<br>• `CARD-015`<br>

<br>• 标题：支持多币种汇总<br>

<br>• 底部：关联需求标签 | 卡片示例：<br>

<br>• `CARD-013`<br>

<br>• 标题：优化 PDF 解析速度<br>

<br>• 底部：`AI 处理中` 微标 | 卡片示例：<br>

<br>• `CARD-012`<br>

<br>• 标题：批量导出 Excel<br>

<br>• **进度条：验收清单 1/4**<br>

<br>• **底部主按钮：`去测试**` | 卡片示例：<br>

<br>• `CARD-001`<br>

<br>• 标题：基础登录页<br>

<br>• 底部：已通过验收 |

* **右侧详情抽屉（点击任意卡片滑出，不跳转页面）：** 顶部展示标题、状态切换与来源标记（`由 AI 更新` / `由我更新`）；中部展示关联的需求描述与 Agent 填写的简明进展；若处于 `待我测试`，底部直接列出白话验收清单和「跳转测试台」按钮。

---

### 4. 测试与预览台（Test & Preview）

顶部提供模式切换标签（`Web 预览` / `脚本测试`，单引擎项目仅显示对应一种）。

#### 4A. Web 预览模式（左预览 + 右验收清单）

| 预览操作条（高度 `44px`，跨左侧预览区）：`[刷新]` `[返回]` `[预览地址：[https://xxx.ddev.site](https://xxx.ddev.site)]` `[浏览器打开]`    **高亮主按钮：`[提问题 / 提 Issue]**` | 右侧验收抽屉（宽度 `320px`，可折叠） |
| --- | --- |
| **内嵌实时预览画布（占剩余宽度的 100%）**<br>

<br>• 渲染本地 DDEV 站点画面。<br>

<br>• 点击顶部「提问题」后，画布进入**框选截图模式**（半透明遮罩，鼠标拖拽框选异常区域）。<br>

<br>• 松手后弹出轻量浮窗：标题、大白话描述、预期效果 + 灰色小字提示「已自动附带截图、当前网址、2 条浏览器报错与后端日志」，点「提交 Issue」直接落盘。 | **当前验收卡片：`CARD-012 批量导出 Excel**`<br>

<br>1. `[x]` 打开列表页确认数据加载<br>

<br>2. `[ ]` 勾选 3 条发票点击右上角导出<br>

<br>3. `[ ]` 确认弹出下载并包含日期列<br>

<br>

<br>**底部固定操作区：**<br>

<br>• `[全部通过，标记完成]`（全部勾选后点亮）<br>

<br>• `[该步有问题，提 Issue]`（自动带上当前步骤编号） |

#### 4B. 后端脚本测试模式（基于 `devos.run.json` 渲染）

| 左侧脚本列表（`220px`） | 中间参数表单与运行区（自适应主区） |
| --- | --- |
| • `批量解析 PDF 发票`（选中）<br>

<br>• `同步商品库存`<br>

<br>• `数据格式自检`<br>

<br>

<br>*底部提示：由 `devos.run.json` 自动生成* | **上半区（自动渲染表单）**：<br>

<br>• 标题 + 一句话功能说明<br>

<br>• 表单项按 `inputs[]` 渲染：目录选择器（`发票所在目录`）、下拉框（`默认币种`）、开关（`严格校验税号`）、文本框（`导出文件名`）<br>

<br>• 主按钮：**`[运行测试]`**（运行中变为 `[停止运行]` + 耗时计时器）<br>

<br>---<br>

<br>**下半区（运行结果与输出）**：<br>

<br>• 状态横幅：`运行成功（耗时 1.4s）` 或 `运行失败（退出码 1）`<br>

<br>• **输出文件卡片**：列出 `expected_outputs`，支持一键打开文件 / 预览表格 / 打开所在文件夹<br>

<br>• **失败或结果不对时高亮按钮：`[一键转为 Issue]**`（弹窗仅需填一句大白话原因，后台自动附带输入参数与完整报错堆栈）<br>

<br>• 折叠区：`查看终端原始输出（stdout / stderr）` |

---

### 5. Issue 反馈中心（Issues）

采用左列表（`340px`）+ 右详情（自适应）双栏邮箱式布局，优先把 `待我复测` 置顶。

| 左侧 Issue 列表（带顶部筛选：`全部` / `待我复测` / `待修复` / `已关闭`） | 右侧 Issue 详情与复测操作区 |
| --- | --- |
| • **[待复测]** `ISS-004` 点击导出按钮没反应<br>

<br>• **[待修复]** `ISS-005` 导出的表格缺日期列<br>

<br>• **[已关闭]** `ISS-001` 首页图片加载变形 | **顶部操作栏**：<br>

<br>• 状态为 `待复测` 时，顶部高亮绿色横幅展示 **Agent 填写的白话修复说明**（`fix_summary_plain`）<br>

<br>• 三个明确按钮：**`[去复测]`** **`[确认已修好]`** **`[还是不行，打回]`**<br>

<br>• 状态为 `待修复` 时，提供 **`[复制处理指令给 AI]`**（如 `请处理 ISS-005`）<br>

<br>**主体内容**：<br>

<br>• 小白描述 + 预期效果<br>

<br>• 截图预览（带红框标注）或脚本输入参数摘要<br>

<br>**底部默认折叠手风琴**：<br>

<br>• `技术排障上下文（Console 报错 / 失败请求 / 容器日志 / 修改文件列表）` |

---

### 6. 项目资产页（Assets）与 Agent 插件连接页（Agent Connect）

* **项目资产页：** 左侧 `220px` 分类树（`项目需求` / `项目标准` / `使用文档` / `避坑知识库`），右侧为干净的 Markdown 阅读与所见即所得编辑区；顶部带「由 AI 最近更新于 XX 分钟前」提示与搜索框。
* **Agent 插件连接页：** 卡片网格列出支持的 Agent 工具（Factory Droid、Claude Code、Codex、WorkBuddy 等），每张卡片显示「检测状态（已安装/未检测到）」、「MCP 与规则配置状态」以及一个 **`[一键配置连接]`** 按钮，点完自动写入配置并跑一次连通性测试。

---

## 二、 各终端界面开发注意事项

### 1. Windows 端（Tauri 2 + WebView2）

* **窗口标题栏与控制按钮：** 使用无边框自定义标题栏（`decorations: false`）时，最小化/最大化/关闭按钮必须放在**右上角**，并预留 `138px` 宽度；顶部拖动区加 `data-tauri-drag-region`，但按钮与输入框必须显式排除拖动事件，否则点击失效。
* **WebView2 运行时与打包：** Win11 默认自带 WebView2，但部分精简版 Win10 缺失；Tauri 打包配置需选用 `embedBootstrapper` 或引导安装，防止小白双击无反应。
* **高分屏 DPI 与字体：** Windows 常见 `125%`、`150%` 缩放，布局避免写死 `px` 截断文字，改用 `rem`/Flex 弹性容器；中文字体栈优先 `"Segoe UI", "Microsoft YaHei UI", sans-serif`，避免退回宋体。
* **滚动条与路径显示：** WebView2 默认滚动条较粗且生硬，前端需统一用 CSS 美化为窄悬浮样式；表单里展示项目路径时可按 Windows 习惯显示反斜杠，但传回 Rust 落盘 `devos.json` / `devos.run.json` 前统一转为 POSIX 正斜杠。

### 2. macOS 端（Tauri 2 + WKWebView）

* **红绿灯交通灯避让：** 推荐配置 `titleBarStyle: "Overlay"` 并隐藏原生标题文本，但**左侧导航栏顶部必须预留至少 `38px` 高度或 `72px` 左侧安全区**，防止新建项目按钮与系统红黄绿关闭按钮重叠。
* **Retina 2x 截图标注坐标坑（极易踩坑）：** macOS Retina 屏 `window.devicePixelRatio` 通常为 `2`。在 Web 预览页框选异常区域保存 `annotated_region` 时，**截图像素与前端 CSS 坐标存在 2 倍差值**；务必统一按逻辑像素存储坐标并附带 `dpr` 字段，或截图前按统一比例缩放，否则回显红框会严重偏移。
* **快捷键与触控板手势：** 界面提示与快捷键监听需根据平台区分 `Cmd`（macOS）与 `Ctrl`（Win/Linux）；在 Web 预览区禁用 WKWebView 默认的「双指左右滑前进/后退」手势，防止小白在预览页横向滚动表格时误触退出当前页面。
* **本地 HTTPS 证书信任：** DDEV 依赖 `mkcert` 信任本地根证书，WKWebView 对未受信任自签名证书会直接白屏拦截；环境体检（Preflight）阶段必须检查 `mkcert -install` 状态。

### 3. Linux 端（Tauri 2 + WebKitGTK）

* **GPU 合成器黑屏与闪烁兜底：** 在部分 Ubuntu 24.04 + NVIDIA 显卡或 Wayland 环境下，WebKitGTK 开启 DMABUF 硬件加速极易出现窗口白屏、黑屏或闪烁。Rust 启动入口（`main.rs`）应在创建窗口前检测 Linux/NVIDIA 环境，必要时自动注入 `WEBKIT_DISABLE_DMABUF_RENDERER=1` 兜底。
* **Wayland 与 X11 差异：** Wayland 下部分原生窗口位置记忆、全局快捷键、窗口截图接口受限；内嵌预览页的「框选截图」建议优先在 WebView 内通过 Canvas/DOM 或 Tauri 内置截屏能力实现，不要强依赖 X11 专属截屏命令。
* **字体与系统托盘：** Linux 发行版默认中文字体不一，CSS 字体栈需包含 `"Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif`；系统托盘依赖 `libayatana-appindicator3`，打包 `.deb` / `.AppImage` 时需在依赖清单中声明，且不要把核心功能藏在托盘菜单里。

### 4. 内嵌 Web 预览与探针注入的跨端关键点

* **不要用 `<iframe>` 嵌本地 DDEV 站点：** 很多 Web 框架（WordPress、Django、Rails、Laravel 等）默认响应头带有 `X-Frame-Options: SAMEORIGIN` 或严格 `CSP`，会导致 `<iframe>` 直接拒绝加载。
* **推荐做法：** 使用 **Tauri 2 的多 WebView（Child WebView）** 贴合在主窗口预览区矩形坐标内，并通过本地轻量反向代理（Rust `hyper`/`axum` 转发到 DDEV）在 HTML 响应末尾无侵入注入那段 100 行报错采集探针；这样既不受 `X-Frame-Options` 限制，又能跨 Win/macOS/Linux 一致地抓到浏览器 `console.error` 和 `500` 网络请求。

### 5. Agent CLI 终端侧交互注意事项

虽然不接管 Agent 会话，但你的 `devos` CLI 和 MCP 输出会直接出现在各家 Agent CLI 的终端界面里：

* **严格区分人读与机读输出：** 只要传入 `--json` 或检测到 `stdout` 不是交互式 TTY（管道/MCP 调用），必须**关闭所有 ANSI 彩色转义码、进度条动画和多余提示语**，只吐合法单行/标准 JSON，防止破坏 Agent 解析。
* **Windows 终端编码防乱码：** `devos` CLI 在 Windows PowerShell / CMD 运行时，显式强制输出 UTF-8，避免中文项目名或白话报错在 Agent 工具里变成乱码。
* **日志截断护栏：** `env_control` 和 `list_issues` 返回的 `stdout_tail` / `stderr_tail` / `backend_logs_tail` 必须做行数与字节数硬上限（例如最多最后 50 行或 4KB，并提示完整日志文件路径），防止一次构建报错吐出几万字把 Agent 的上下文窗口直接打爆。



在跨平台桌面端解决“环境缺失检测 + 自动安装 + 中国大陆网络适配”，最稳妥的工程策略是：**轻量工具私有化直下（不依赖 Homebrew/Chocolatey）、重型底座向导式半自动安装、下载源走“热更镜像清单 + 自动测速 + 代理透传”**。

---

### 一、 最值得参考的开源项目（环境体检与自动安装）

| 开源项目 | 技术栈 | 最值得借鉴的实现机制 |
| --- | --- | --- |
| **`podman-desktop/podman-desktop`** | TypeScript + Electron | **跨端 Preflight 与 Onboarding 引擎标杆**。把“检测 WSL2 / 虚拟化开关 / 容器引擎 / 提权安装 / 进度条回报”抽象成声明式步骤（Check $\rightarrow$ Fix $\rightarrow$ Verify），一步步带小白完成安装与重启检测。 |
| **`rancher-sandbox/rancher-desktop`** | TypeScript + Go | **Windows WSL2 与 macOS Lima/QEMU 托管范本**。重点看它如何在 Windows 上检测/启用 WSL2 特性、导入独立发行版，以及在 macOS/Linux 上优雅管理底层虚拟机和端口转发。 |
| **`moonrepo/proto` 与 `jdx/mise**` | **Rust** | **Rust 私有化工具链管理器标杆**。展示如何用 Rust 直接拉取 Node、Python 等官方压缩包、做 SHA256 校验、解压到独立目录并自动管理环境变量，完全不污染用户系统全局 `PATH`。 |
| **`ddev/ddev`（安装器与 `ddev debug test`）** | Go + Shell/PS1 | 参考它的跨端前置诊断逻辑（Docker 连通性、端口 80/443 占用、`mkcert` 根证书信任状态检测），可直接翻译为你的 `devos-env` 中的 `Preflight Doctor`。 |

---

### 二、 组件分层安装策略：不要指望“全靠包管理器”

新手电脑里通常没有 Homebrew（macOS）或 Scoop/Winget（Windows），且在中国大陆，Homebrew 首次安装和更新极易卡死。建议将依赖严格分为两层处理：

| 层级 | 包含组件 | 推荐安装实现方式 |
| --- | --- | --- |
| **第一层：轻量工具（DevOS 私有托管）** | `ddev`、`mkcert`、便携版 `Node.js`、`@devcontainers/cli`、便携版 `Git`（Win） | **Rust 直接下载压缩包解压至 `~/.devos/bin/**`。启动容器或命令时，由 `devos-env` 自动把 `~/.devos/bin` 拼到子进程 `PATH` 最前面。完全绕开 Homebrew/Winget，卸载干净、版本锁定、零系统污染。 |
| **第二层：重型系统底座（向导式半自动）** | Windows WSL2、Docker Desktop / OrbStack（macOS）/ Docker Engine（Linux） | 涉及系统内核、虚拟化与管理员提权（UAC / `sudo`），无法完全无感静默。采用 **“检测缺失 $\rightarrow$ 应用内断点续传下载安装包 $\rightarrow$ 唤起系统安装器 $\rightarrow$ 后台轮询直到 `docker info` 返回成功”** 的引导流。 |

*(小技巧：macOS 端检测容器引擎时，可把 **OrbStack** 作为优先推荐选项之一，体积比 Docker Desktop 小得多、冷启动快且内存占用低，对小白更友好。)*

---

### 三、 解决中国大陆网络问题的 4 层灵活架构

中国大陆的痛点不在单一环节，而是“二进制下载 + Docker 镜像拉取 + 容器内依赖安装（npm/PyPI/apt）”三处同时卡顿，且国内免费公共镜像源经常失效。因此绝对不能把某一个镜像 URL 写死在代码里。

#### 1. 远程可热更的镜像清单（`mirrors.json`）+ 2 秒自动测速

应用内置一份默认 `mirrors.json`，同时每次启动时异步从你自己的轻量静态地址（如国内对象存储 OSS/COS + GitHub 备用）拉取最新镜像表。

* **提供 4 种网络预设：** `自动测速择优（默认）` / `中国大陆加速` / `官方直连` / `使用自定义代理或镜像`。
* **并发测速（Race）：** 下载前对候选源发一个 2 秒超时的 HTTP `HEAD` 探测，自动挑最快且返回 `200` 的源；下载中途如果断连或速度低于阈值（如 `< 50KB/s` 持续 10 秒），自动无缝切换到下一个备用源。

#### 2. 代理自动继承与透传（最稳的终极解）

很多大陆用户本机其实开着代理工具，但命令行和 Docker 容器默认吃不到系统代理。

* **自动读取系统代理：** Rust 端使用 `sysproxy` 或读取环境变量（`HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`），自动应用到组件下载器。
* **一键透传给容器引擎：** 在 DevOS 设置里提供「为容器环境启用代理」开关，自动把本机代理地址（注意容器内需转换为 `host.docker.internal:<port>`）注入到容器构建参数和 Docker 配置中，解决 `docker pull` 和容器内拉代码超时。

#### 3. 三处源配置联动（一次切换，全链路生效）

当用户选择「中国大陆加速」模式时，`devos-env` 自动联动配置三处：

1. **组件二进制源：** Node 走淘宝/清华/中科大镜像；`ddev`/`mkcert` 走你的国内 OSS 镜像或可配置的 GitHub 加速前缀。
2. **Docker 镜像源：** 体检阶段检测 Docker 的 `daemon.json`；若直连 `hub.docker.com` 超时，引导用户填入可用的国内镜像加速器地址（或开启代理透传），并提供「一键测试拉取 `hello-world`」验证连通性。
3. **容器内部包管理器源：** 生成 `.devcontainer/devcontainer.json` 或 `.ddev/config.yaml` 时，自动注入对应环境变量（如 `NPM_CONFIG_REGISTRY`、`PIP_INDEX_URL`、`GOPROXY`），让 Agent 在容器里装依赖不再卡死。

#### 4. 断点续传、SHA256 校验与离线导入兜底

* **防劫持校验：** 无论从哪个第三方镜像或加速站下载二进制，**SHA256 校验清单始终以官方/签名清单为准**，校验不通过立即丢弃并换源，防止镜像站投毒或下载残缺包。
* **断点续传：** Rust 使用 `reqwest` 配合 HTTP `Range` 头支持断点续传，大安装包（如 Docker Desktop 数百 MB）断网重连不用从头下。
* **离线包逃生门：** 体检界面底部留一个低调入口「已有本地安装包？点此导入」，兼容弱网或企业内网环境。

---

### 四、 可直接落地的配置与体检模型参考

在 `devos-env` 中，可以把镜像源清单设计为如下结构，方便后续热更新与用户自定义覆盖：

```json
{
  "manifest_version": "2026.11",
  "profiles": {
    "cn_accelerated": {
      "label": "中国大陆加速",
      "github_release_prefixes": [
        "https://cdn.your-devos-mirror.cn/github/",
        "https://ghfast.top/https://github.com/"
      ],
      "node_dist_mirror": "https://npmmirror.com/mirrors/node/",
      "container_env_vars": {
        "NPM_CONFIG_REGISTRY": "https://registry.npmmirror.com",
        "PIP_INDEX_URL": "https://pypi.tuna.tsinghua.edu.cn/simple",
        "GOPROXY": "https://goproxy.cn,direct"
      }
    },
    "official_direct": {
      "label": "官方直连",
      "github_release_prefixes": ["https://github.com/"],
      "node_dist_mirror": "https://nodejs.org/dist/",
      "container_env_vars": {}
    }
  },
  "artifacts": {
    "ddev": {
      "version": "v1.24.x",
      "urls_by_target": {
        "windows-x86_64": "ddev/ddev/releases/download/{{version}}/ddev_windows-amd64.{{version}}.zip",
        "macos-aarch64": "ddev/ddev/releases/download/{{version}}/ddev_macos-arm64.{{version}}.tar.gz",
        "linux-x86_64": "ddev/ddev/releases/download/{{version}}/ddev_linux-amd64.{{version}}.tar.gz"
      },
      "sha256_by_target": {
        "windows-x86_64": "...",
        "macos-aarch64": "...",
        "linux-x86_64": "..."
      }
    }
  }
}

```

**体检与安装状态机（集成在首次启动向导中）：**

1. **探测网络画像**：并发 Ping 官方源与国内镜像（超时 2 秒），自动推荐「官方直连」或「中国大陆加速」，同时允许用户手动切源或填代理。
2. **分层检测组件**：并行执行 `Preflight Check`，区分 `Ready`、`FixableAuto`（第一层轻量工具，点一下自动下到 `~/.devos/bin`）、`FixableGuided`（第二层 Docker/WSL2，提供下载+引导+轮询验证）。
3. **验证闭环**：所有项变绿后，自动跑一次极轻量的环境连通性验证（检查 `docker info` + `mkcert` 证书状态），通过即进入新建项目主流程。




这套系统横跨**三端安装包生命周期、Tauri 桌面 UI、Rust 内核、容器环境（DDEV / DevContainer）以及外部 Agent 插件**，绝不能把所有东西塞进一个巨大的端到端测试里跑——那样不仅慢，而且极易因为 Docker 拉镜像或 LLM 波动导致 CI 天天爆红。

针对**公开仓库 + GitHub Actions 免费 Runner**，最稳妥的落地方式是“分层解耦 + 双驱动切换（Mock 驱动与真实容器分离）+ 三端 Runner 扬长避短”。

---

## 一、 先说清 GitHub 免费 Runner 的真实能力边界（避坑前提）

公开仓库可以免费使用 `ubuntu-latest`、`windows-latest`、`macos-latest`，但它们对容器的支持差别很大，方案必须顺着这个物理限制来设计：

| GitHub Runner | 原生能力 | 明确限制 | 承担的测试职责 |
| --- | --- | --- | --- |
| **`ubuntu-latest`** (24.04) | 原生 Linux Docker、Xvfb 虚拟桌面、速度快 | 无 | **主力全栈战场**：真实 DDEV + 真实 `@devcontainers/cli` + 真实 MCP 闭环 + Tauri WebDriver UI 测试 + `.deb`/`.AppImage` 安装卸载 |
| **`windows-latest`** (Server 2022/2025) | 原生 WebView2、NSIS/WiX 打包 | **不支持嵌套虚拟化**，无法在标准免费 Runner 上跑 WSL2 + Linux Docker Desktop | `.exe`/`.msi` 静默安装/升级/卸载、Windows 路径/CRLF/UTF-8 兼容、WebView2 UI 测试（配合 Mock 环境驱动） |
| **`macos-latest`** (Apple Silicon) | 原生 `.dmg` 打包、代码签名校验 | 免费虚拟化节点跑完整 Linux Docker 极不稳定且慢；WKWebView 无官方 `tauri-driver` | `.dmg` 挂载安装/卸载/热更新验证、Rust 核心与插件配置测试、前端 Vitest/Playwright（配合 Mock 环境驱动） |

> 如果后续需要验证 **Windows WSL2 / macOS OrbStack 下的真实 Docker**，只需在发版前用你自己的本地电脑或 1 台低配自托管 Runner（Self-hosted Runner）跑一次发布前验收即可，日常 CI 不必和免费 Runner 的虚拟化限制死磕。

---

## 二、 五层自动化模拟测试架构

### 第 1 层：协议与内核单元测试（三端必跑，每次 PR 触发，约 3 分钟）

不启动 UI、不启动 Docker，专门把最容易出低级 Bug 的底层逻辑锁死：

* **Schema 与类型同步校验**：运行 `devos-schema` 的 `ts-rs` 导出命令后执行 `git diff --exit-code`，确保 Rust 结构体与前端 TypeScript 类型 100% 一致。
* **文件原子读写与索引重建**：并发写入 `devos.json` 和 `ISS-xxx.json`，删掉 SQLite 后验证全量重建无损。
* **三态门禁与路径安全**：专门构造 Windows 反斜杠路径、CRLF 换行符、路径穿越（`../../etc/passwd`）和 `DEPLOY_PROD` 下的危险命令，验证全部被拦截。
* **中国大陆网络与镜像降级模拟（重点）**：在 CI 里起一个本地极简 HTTP 服务（Rust `wiremock`），模拟 3 种故障场景并断言下载器行为：
1. 镜像源 1 故意延迟 3 秒超时 $\rightarrow$ 验证自动切换镜像源 2；
2. 镜像源返回被篡改的文件 $\rightarrow$ 验证 SHA256 校验失败并丢弃重试；
3. 下载到 50% 断开连接 $\rightarrow$ 验证 HTTP `Range` 断点续传成功。



---

### 第 2 层：插件与 Agent 交互模拟（无 LLM 费用、100% 确定性）

不要在每次提交时去调真实的 Claude / GPT API（贵且输出不稳定）。做法是写一个 **确定性 Mock Agent 测试桩（Test Harness）**，它本身就是一个标准 MCP Client，完全模拟外部 Agent CLI 的真实行为：

1. **插件一键配置测试（幂等性验证）**：
* 在临时隔离目录（覆盖 `HOME` / `USERPROFILE`）中预置空的或已有内容的伪造配置文件（模拟 Claude Code、Factory Droid、WorkBuddy 的配置路径）。
* 调用你的「一键安装插件」逻辑，断言 MCP 配置与 `SKILL.md` 写入正确、JSON 格式合法、**连续运行两次不会把用户原有配置写坏或重复追加**。


2. **完整 MCP 协议与 Issue 闭环回放**：
* Mock Agent 启动你的 `devos-mcp`（`stdio` 传输），读取 `daemon.json` 完成握手，按固定剧本走完一整套流程：
1. 调 `get_project_brief` $\rightarrow$ 校验返回的项目标准和环境状态；
2. 调 `submit_for_testing`（故意让脚本报错） $\rightarrow$ 断言被提测门禁**打回**，看板卡片**没有**进入 `待我测试`；
3. 修复测试桩文件后再次 `submit_for_testing` $\rightarrow$ 断言门禁通过，卡片进入 `testing` 且白话验收单落盘；
4. 模拟小白提交 `ISS-001.json` $\rightarrow$ Mock Agent 调 `list_issues` 拿到报错日志 $\rightarrow$ 调 `resolve_issue` 写白话修复说明与知识库条目 $\rightarrow$ 断言状态变为 `ready_for_retest` 且 `knowledge/` 新增文件。





*(可选补充：每周或发版前单独跑一个 `workflow_dispatch` / Nightly 任务，用 Secrets 里的低成本模型 Key 跑 1 次真实 Agent CLI，专门验证 `AGENTS.md` 和 `SKILL.md` 提示词有没有因为模型更新而失效。)*

---

### 第 3 层：真实容器环境 E2E（在 `ubuntu-latest` 上跑真 Docker）

在 `ubuntu-latest` 中利用原生 Docker，把真实环境打通测试：

* **环境准备**：CI 缓存 DDEV 和 `@devcontainers/cli` 二进制以及基础镜像层（利用 `actions/cache` 缩短耗时）。
* **Web 环境闭环（DDEV）**：用 `devos-cli` 创建极简 Web 模板（如单文件 PHP/Node 路由，带 `/health` 和一个故意报 500 的 `/fail` 接口） $\rightarrow$ `devos env up` $\rightarrow$ 验证健康检查 200 $\rightarrow$ 请求 `/fail` $\rightarrow$ 验证日志抓取拿到 500 堆栈 $\rightarrow$ 执行 `snapshot` 与 `restore` 验证回滚。
* **后端脚本环境闭环（DevContainer）**：拉起轻量 `python:3.11-slim` Dev Container $\rightarrow$ 按 `devos.run.json` 传参运行正常脚本，断言输出文件生成在 `.devos/artifacts/` $\rightarrow$ 传入非法参数触发 `exit_code: 1`，断言自动生成的 Issue 包含 `stderr_tail` 和完整入参。

---

### 第 4 层：桌面端 UI 与 Web 预览探针测试

为了兼顾速度与覆盖率，UI 测试拆成两半：

* **前端交互与状态流（Playwright，极快）**：在浏览器中运行 React 前端，Mock 掉 Tauri `invoke` 接口，全覆盖测试：新手建项向导、4 列看板拖拽与详情抽屉、`devos.run.json` 动态表单渲染、Issue 复测与打回、双语文案检查（断言主界面不出现 `stderr` / `SQLite` 等技术词）。
* **真实 Tauri 窗口 + 预览探针 E2E（`tauri-driver` + WebdriverIO，在 Linux `xvfb-run` 与 Windows 上跑）**：
* 启动编译好的真实 Tauri 应用（开启 `DEVOS_ENV_DRIVER=mock` 或指向本地轻量测试 HTTP Server）。
* 打开内嵌 Web 预览页，点击页面里故意抛 `console.error` 和 `fetch 500` 的按钮 $\rightarrow$ 点击桌面端「提问题 / 提 Issue」 $\rightarrow$ 断言 `issues/ISS-xxx.json` 里**同时存在截图文件、页面 URL、Console 报错和 500 响应片段**。



---

### 第 5 层：客户端安装、更新、卸载全生命周期测试（三端实测）

这是桌面软件最容易发版翻车的环节，必须在 GitHub Runner 上直接测**真实打出来的安装包**，而不是 `cargo run`。

#### 核心前置设计：给客户端加一个 `--smoke-test` 冒烟参数

在 Tauri 的 `main.rs` 里留一个测试入口：当以 `devos-app --smoke-test`（或环境变量 `DEVOS_SMOKE_TEST=1`）启动时，应用正常初始化窗口/WebView、初始化 SQLite、拉起本地守护进程并写入 `daemon.json`，完成自检后自动打印版本号并以退出码 `0` 退出。这样在无头 CI 里就能 100% 验证**装完的真实二进制能正常启动不崩溃**。

#### 三端安装 / 卸载测试实现

* **Windows (`windows-latest`)**：
1. **静默安装**：运行 `DevOS-Setup.exe /S`（NSIS）或 `msiexec /i DevOS.msi /qn /l*v install.log`。
2. **安装断言**：检查安装目录主程序、`devos.exe` CLI、桌面/开始菜单快捷方式是否存在；运行 `devos-app.exe --smoke-test` 确认启动正常。
3. **静默卸载**：运行 `uninstall.exe /S` 或 `msiexec /x DevOS.msi /qn`。
4. **卸载断言**：确认程序文件与快捷方式已清空，同时**断言用户创建的测试项目目录（如 `%USERPROFILE%\DevOS-Projects`）被安全保留，没有被卸载程序误删**。


* **macOS (`macos-latest`)**：
1. 挂载 `.dmg`：`hdiutil attach DevOS.dmg -nobrowse -mountpoint /Volumes/DevOS`。
2. 拷贝 `/Volumes/DevOS/DevOS.app` 到 `/Applications/`，校验 bundle 结构与可执行权限，执行 `/Applications/DevOS.app/Contents/MacOS/devos-app --smoke-test`。
3. 卸载镜像并删除 `.app`，验证清理干净。


* **Linux (`ubuntu-latest`)**：
1. `.deb` 测试：`sudo dpkg -i devos_*.deb`（如有缺失依赖则测 `apt-get install -f`） $\rightarrow$ `xvfb-run devos-app --smoke-test` $\rightarrow$ `sudo apt-get remove -y devos`。
2. `.AppImage` 测试：`chmod +x` 后配合 `--appimage-extract-and-run` 在 `xvfb-run` 下跑冒烟验证。



#### 自动更新（Auto-Update）全链路模拟测试

Tauri 2 内置 `tauri-plugin-updater`，在 CI 里可以 100% 离线闭环测试“旧版本 $\rightarrow$ 新版本”升级，且不污染线上发布：

1. 在 CI 中生成一对临时测试用签名密钥（`tauri signer generate`）。
2. 编译两个极简测试包：**`v0.0.1`**（旧版）和 **`v0.0.2`**（新版，并用测试私钥签名）。
3. 在 CI 本地起一个静态 HTTP 服务（`[http://127.0.0.1:18080/latest.json](http://127.0.0.1:18080/latest.json)`），托管 `v0.0.2` 的更新清单与安装包。
4. 安装并启动 `v0.0.1`，在 `~/.devos` 写入一份旧版 SQLite/项目数据，通过环境变量 `DEVOS_UPDATER_ENDPOINT=[http://127.0.0.1:18080/latest.json](http://127.0.0.1:18080/latest.json)` 触发自动检查并执行更新。
5. 更新完成后重新运行 `--smoke-test`，断言：
* 输出版本号已变为 `0.0.2`；
* 之前写入的旧版项目数据与 SQLite 索引完好无损且完成了自动迁移。



---

## 三、 GitHub Actions 流水线触发编排（兼顾效率与全面性）

| Workflow 文件 | 触发时机 | 运行内容 | 预计耗时 |
| --- | --- | --- | --- |
| `ci-fast.yml` | 每次 Push / PR | **第 1 层**（三端 Rust 单测 + Schema/TS 同步 + 网络镜像降级模拟）+ **第 2 层**（Mock Agent MCP 闭环 + 插件注入）+ 前端 Playwright | 5～8 分钟 |
| `ci-env-e2e.yml` | 合并到 `main` / 涉及 `devos-env` 改动 | **第 3 层**（`ubuntu-latest` 真实 DDEV + DevContainer 闭环）+ **第 4 层**（Linux/Win `tauri-driver` 预览探针 E2E） | 12～18 分钟 |
| `ci-release-lifecycle.yml` | 打 Tag（`v*`）/ 手动触发 / 每晚定时 | **第 5 层**（Win/macOS/Linux 三端真实打包装包 $\rightarrow$ 静默安装 $\rightarrow$ 冒烟启动 $\rightarrow$ `v0.0.1` 到 `v0.0.2` 自动更新 $\rightarrow$ 卸载保留用户数据） | 20～30 分钟 |
| `ci-real-agent-nightly.yml` | 手动触发 / 每周定时 | 使用真实 Agent CLI 跑 1 次最小项目梳理与修 Issue，验证 `SKILL.md` / `AGENTS.md` 提示词有效性 | 5 分钟 |

---

## 四、 架构上只需预留 3 个小口子，就能让上述测试极易实现

为了避免后期为了写测试大改代码，从写第一行代码开始就在 Rust 内核里留好这 3 个依赖注入点：

1. **`EnvDriver` 可切换**：支持通过环境变量 `DEVOS_ENV_DRIVER=mock` 切到内存模拟驱动，让 Windows/macOS 免费 Runner 也能流畅跑完整套 UI 和 MCP 流程。
2. **所有外部端点可覆盖**：镜像清单地址（`DEVOS_MIRROR_MANIFEST_URL`）、自动更新地址（`DEVOS_UPDATER_ENDPOINT`）、用户数据根目录（`DEVOS_HOME`）全部支持环境变量覆盖，CI 里永远指向本地 Mock Server 和临时目录，互不干扰。
3. **内置 `--smoke-test` 探针模式**：让安装、更新测试在没有显示器、没有人工点击的 GitHub Runner 里，也能确凿地证明客户端二进制、SQLite、WebView 和守护进程全部健康启动。


**完全可以实现，而且“应用自动扫描本机已安装的 Agent 工具 $\rightarrow$ 列表展示状态 $\rightarrow$ 由用户手动点击安装/更新插件”是目前最稳妥、最符合安全合规与小白体验的做法。**

可行性的底层原因很明确：当前国内外主流 Agent CLI 和 IDE 虽然各自路径与格式不同，但几乎都收敛到了“本地配置文件（JSON / JSONC / TOML）+ `skills/*/SKILL.md` + `hooks`”**或**“原生 CLI 注册命令”（如 `claude mcp add`、`qoder mcp add`）。你的 Rust 桌面端只需实现一个轻量适配器层（Adapter Registry），即可完成无损扫描与按需注入。

---

## 一、最值得直接参考的开源项目（扫描 + 跨 Agent 安装）

以下开源项目专门解决“探测本机安装了哪些 Agent 工具，并自动按各自格式写入 MCP / Skills / Hooks”的问题，可直接拆解其适配表与合并写入逻辑：

| 开源项目 | 核心能力 | 最值得你借鉴的设计 |
| --- | --- | --- |
| **`neon-solutions/add-mcp`** (`npx add-mcp`) | 探测本机/项目中的 **25+ 种 Agent 与 IDE**（含 Claude Code、Codex、Factory Droid、OpenCode、Kimi Code、Cursor、VS Code、Windsurf 等）并写入对应 MCP 配置。 | **最直接的格式转换参考**：优雅处理了不同工具的格式差异（JSON / JSONC / TOML）、根键名差异（`mcpServers` vs `servers` vs `mcp`），以及针对不同工具写入审批白名单（`--approve-tool`）的逻辑。 |
| **`dariocurr/shaic`** | 扫描本机所有已装 Agent 的配置（`discover`），将统一的 Skills、Rules、MCP 定义同步到多款 Agent，并支持漂移检测（`status`）与预览（`--dry-run`）。 | **“单一权威源 $\rightarrow$ 多工具分发”架构**：非常适合你的 DevOS 场景——维护一份标准插件包，同步到多款 Agent 时自动检测版本漂移并提示用户“插件有更新”。 |
| **`jkitchin/knowhow`** & **`agentwik-labs/skillhawk`** | 统一安装并管理 Skills、Slash Commands、Hooks 和 MCP Server，支持跨平台目标转换与安全校验。 | 参考它如何把 **MCP + `SKILL.md` + Hooks** 打包成一个逻辑单元同时安装，以及卸载时的干净清理逻辑。 |
| **Agent Plugins 1.0 规范** | VS Code / Copilot CLI 等生态推进的跨工具插件包标准（`plugin.json` + `skills/` + `mcp.json`），国内如 Qoder CLI 也采用了极相似的 `.qoder-plugin/plugin.json` 结构。 | 你的 `plugins/` 目录可直接按此标准布局打包，未来能兼容越来越多支持原生插件目录的 Agent 工具。 |

---

## 二、独立架构文档：`07-agent-adapter-and-plugin-guide.md`

以下内容可直接作为仓库 `docs/07-agent-adapter-and-plugin-guide.md` 落盘，补齐之前缺失的国内外 Agent 插件适配规范。

### 1. 国内外主流 Agent 工具适配矩阵

适配器层（建议放在 `crates/devos-core/src/adapters/`）按声明式配置维护下表，支持随 `mirrors.json` 一同热更新，避免工具改路径就必须发桌面端大版本。

#### A. 中国大陆主流 Agent 工具

| 工具名称 | 本机扫描探测信号 | MCP 配置文件路径（全局 / 项目） | Skills / Hooks / 插件目录 | 用户手动安装实现方式 |
| --- | --- | --- | --- | --- |
| **腾讯 CodeBuddy Code / WorkBuddy** | 检测 `codebuddy` 命令、`~/.codebuddy/`（Win: `%USERPROFILE%\.codebuddy`）或环境变量 `CODEBUDDY_CONFIG_DIR` | 全局：`~/.codebuddy/.mcp.json` | `~/.codebuddy/skills/`；支持原生插件与 Hooks | **自动合并写入**：向 `.mcp.json` 注入 `devos` 条目，并将 `devos` Skill 写入 `skills/`；注意兼容 `CODEBUDDY_CONFIG_DIR` 避免与多实例冲突。 |
| **字节 TRAE（国内版 / 国际版）** | 检测安装目录（macOS `/Applications/TRAE.app`、Win 注册表/`%LOCALAPPDATA%`）及 `~/.trae/` | 项目：`.trae/mcp.json`（需用户在设置开启项目级 MCP 开关）<br>

<br>全局：通过 IDE 设置页添加 | Skills：`~/.trae/skills/`、`.trae/skills/` 或共享 `.agents/skills/`<br>

<br>Hooks：`~/.trae/hooks.json`、`.trae/hooks.json`（亦兼容 Claude Hooks） | **混合模式**：项目级直接写入 `.trae/mcp.json` 与 `.agents/skills/`；全局提供「一键复制配置 JSON + 3 步图文引导」引导用户在 TRAE 设置里粘贴确认。 |
| **阿里 Qoder CLI / IDE** | 检测 `qoder` 命令及 `~/.qoder/` | 全局：`~/.qoder/settings.json`（`mcpServers` 键）<br>

<br>项目：`.qoder/settings.json` 或 `.qoder/settings.local.json` | 原生插件目录 `.qoder-plugin/plugin.json`（含 `skills/`、`hooks/`、`mcpServers`） | **优先调原生 CLI / 插件包**：调用 `qoder mcp add` 或合并写入 `settings.json`，并可选写入 `alwaysAllow` 放行只读工具。 |
| **Kimi Code** | 检测 `kimi` / `kimi-code` 命令及 `~/.kimi-code/`（或 `$KIMI_CODE_HOME`） | 全局：`~/.kimi-code/mcp.json`<br>

<br>项目：`.kimi-code/mcp.json` | 遵循项目级 `AGENTS.md` 与通用 `.agents/skills/` | **自动合并写入**：标准 JSON `mcpServers` 注入。 |

#### B. 国外主流 Agent 工具

| 工具名称 | 本机扫描探测信号 | MCP 配置文件路径与格式特点 | Skills / Rules / Hooks | 用户手动安装实现方式 |
| --- | --- | --- | --- | --- |
| **Claude Code** | 检测 `claude` 命令及 `~/.claude/`、`~/.claude.json` | 全局：`~/.claude.json`<br>

<br>项目：`.mcp.json`（JSON，`mcpServers`） | `CLAUDE.md`、`.claude/skills/*/SKILL.md`、`.claude/settings.local.json`（Hooks & 权限） | **优先调 `claude mcp add-json**` 或无损合并 JSON；同步注册 `SessionStart` 轻 Hook 提醒拉取 Brief。 |
| **OpenAI Codex CLI** | 检测 `codex` 命令及 `~/.codex/` | 全局：`~/.codex/config.toml`<br>

<br>项目：`.codex/config.toml`（**TOML 格式**） | `AGENTS.md`、`~/.codex/skills/` / `.codex/skills/` | 使用 Rust **`toml_edit`** 保留原注释无损插入 `[mcp_servers.devos]` 节点，并按需写单工具 `approval_mode`。 |
| **Factory Droid** | 检测 `droid` 命令及 `~/.factory/` | 全局：`~/.factory/mcp.json`<br>

<br>项目：`.factory/mcp.json` | `AGENTS.md`、Skills 与 Hooks | **自动合并写入**：向 `mcp.json` 注入 `devos` 服务并同步项目规则。 |
| **OpenCode** | 检测 `opencode` 命令及 `~/.config/opencode/` | 全局：`~/.config/opencode/opencode.json(c)`<br>

<br>项目：`opencode.json(c)`（**根键为 `mcp`，命令为数组**） | `AGENTS.md`、`~/.config/opencode/` / `.opencode/` | 专用格式适配器写入 `mcp.devos`（含 `type` 与 `command` 数组），兼容带注释 JSONC。 |
| **Cursor / VS Code / Windsurf** | 检测桌面应用路径及 `~/.cursor/`、`~/.codeium/windsurf/` | Cursor：`~/.cursor/mcp.json`<br>

<br>VS Code：`.vscode/mcp.json`（**根键为 `servers**`）<br>

<br>Windsurf：`~/.codeium/windsurf/mcp_config.json`（仅全局） | `.cursor/rules/*.mdc`、`.agents/skills/`（VS Code 原生读取） | 自动合并写入对应 JSON，遇到仅支持全局的客户端自动隐藏“项目级安装”开关。 |

---

### 2. 本机扫描探测引擎设计（Agent Scanner）

在 DevOS 桌面端的「连接 Agent 工具」页面，扫描过程必须**只读、毫秒级、零侵入**：

1. **三层探测策略（按优先级）：**
* **CLI 探测**：在用户登录 Shell 的 `PATH` 以及常见私有安装路径（如 `~/.local/bin`、`%LOCALAPPDATA%\codebuddy\bin`、`~/.npm-global/bin`）查找可执行文件，不直接盲目执行未知二进制，仅在命中后轻量调用 `--version`。
* **配置目录探测**：检查各工具标准配置目录（如 `~/.claude`、`~/.codebuddy`、`~/.qoder`、`~/.trae`、`~/.factory`、`~/.codex`）是否存在。
* **桌面端探测**：macOS 扫描 `/Applications/*.app`；Windows 扫描卸载注册表与 `%LOCALAPPDATA%\Programs\`；Linux 扫描 `.desktop` 文件。


2. **输出 4 种清晰状态给小白：**
* `已安装 · 未连接`（显示主按钮：**「安装 DevOS 插件」**）
* `已连接 · 正常`（检测到配置中已存在 `devos` 且指向当前 `devos-mcp` 路径与最新版本，显示 **「测试连接」/「卸载插件」**）
* `已连接 · 需更新`（插件版本低于当前 DevOS 版本，或 `devos-mcp` 路径已失效，显示 **「一键更新」**）
* `未检测到`（折叠在页面底部，附带“如果装在自定义路径，可手动指定目录”入口）



---

### 3. 用户手动安装与卸载的安全机制（绝不弄坏用户原有配置）

由用户手动点按钮触发安装时，Rust 适配器层必须严格执行以下 5 步安全流水线：

1. **变更前备份（Backup First）：** 写入任何外部配置文件前，先拷贝一份带时间戳的备份到 `~/.devos/backups/<agent>/<filename>.bak`（每个工具保留最近 5 份），出问题可一键还原。
2. **非破坏性局部合并（Surgical Merge）：**
* 绝不整文件覆盖！只读取原文件并精准增删/更新名为 `devos` 的 MCP 服务节点。
* 对 TOML（Codex）使用 `toml_edit` 保留用户原有注释与排版；对 JSONC（OpenCode / VS Code）先做注释保留解析或安全合并，严禁破坏用户已配好的其他 MCP。


3. **全局 vs. 项目级作用域分工（最佳实践）：**
* **全局安装（推荐默认）**：把 `devos-mcp` 注册到工具的全局配置中。这样用户在 DevOS 里建 10 个项目，都不需要重复装插件；`devos-mcp` 启动时自动按当前工作目录（`cwd`）向上查找 `devos.json` 动态绑定项目。
* **项目级资产（自动生成）**：建项目时，DevOS 在项目根目录同步生成 `AGENTS.md` 以及通用 `.agents/skills/devos/SKILL.md`（VS Code、TRAE、Codex、OpenCode 等越来越多工具已开始共用 `.agents/skills/` 约定）。


4. **安装后即时自检（Post-Install Verify）：** 写入完成后，DevOS 后台直接拉起一次 `devos-mcp --self-check`，验证二进制可执行权限、握手文件可读性以及目标配置文件语法校验无误，再把卡片状态切为绿色「已连接」。
5. **一键干净卸载：** 用户点「断开/卸载插件」时，精确移除配置文件中的 `devos` 节点以及 `devos` 专属 Skill 文件夹，不动用户的任何其他配置。

---

### 4. 权限最小化与“免打扰”配置约定

国内外工具（如 Claude Code、Codex、Qoder、WorkBuddy）对 MCP 工具均有审批策略：

* **只读与常规同步工具默认放行：** 适配器在支持白名单的工具（如 Qoder 的 `alwaysAllow`、Claude Code 的 `settings.local.json`、Codex 的 `approval_mode`）中，可由用户勾选是否自动放行 `get_project_brief`、`list_issues`、`update_board_card`、`sync_project_assets`，减少小白被反复弹窗打断。
* **环境执行与破坏性动作保留门禁：** `env_control` 中的破坏性子动作（`restore`/`down`）和 `DEPLOY_PROD` 相关操作不放进自动白名单，由 Agent 工具审批与 DevOS 本地三态门禁双重兜底。

---

### 5. 针对无法直接写全局配置的工具的兜底交互

少数桌面端 IDE（例如部分版本的 TRAE 全局 MCP 或封闭式桌面端）可能把全局配置存放在加密数据库或仅允许 UI 手动添加。针对这类工具，适配器声明 `install_mode: "guided_manual"`，用户点击「安装插件」时弹出一个极简 3 步引导窗：

1. 显示已生成好的标准 JSON 配置块 + 「一键复制配置」按钮（路径已自动填好本机 `devos-mcp` 的绝对路径）；
2. 给出 2 行大白话指引（例如“打开 TRAE $\rightarrow$ 设置 $\rightarrow$ MCP $\rightarrow$ 手动添加 $\rightarrow$ 粘贴确认”）；
3. 底部放一个 「我已粘贴，检测连接」按钮，验证通过即完成接入。