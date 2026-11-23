use std::path::{Path, PathBuf};
use std::fs;
use devos_schema::{
    BoardCard, DevosProject, Issue, ProjectMode, ProjectType, RunManifest,
};
use crate::board::BoardManager;
use crate::db::Database;
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write, atomic_write_json, read_json};
use crate::issue::IssueManager;

pub const DEVOS_MANAGED_LABEL: &str = "com.devos.managed=true";

pub struct ProjectManager;

impl ProjectManager {
    /// Generate standardized container name: devos-<slug>-<4_char_hash>
    pub fn get_container_name(slug: &str, project_id: &str) -> String {
        let clean_slug = slug.to_lowercase().replace('_', "-");
        let hash = if let Some(stripped) = project_id.strip_prefix("proj_") {
            stripped.chars().take(4).collect::<String>()
        } else {
            project_id.chars().take(4).collect::<String>()
        };
        let short_hash = if hash.len() >= 4 { hash } else { "0001".to_string() };
        format!("devos-{}-{}", clean_slug, short_hash)
    }

    /// Load `devos.json` from the given directory (or search parent directories)
    pub fn find_and_load<P: AsRef<Path>>(start_path: P) -> Result<(PathBuf, DevosProject)> {
        let mut curr = start_path.as_ref().to_path_buf();
        loop {
            let manifest_path = curr.join("devos.json");
            if manifest_path.exists() {
                let project: DevosProject = read_json(&manifest_path)?;
                return Ok((curr, project));
            }
            if !curr.pop() {
                break;
            }
        }
        Err(DevosError::ProjectNotFound {
            path: start_path.as_ref().display().to_string(),
        })
    }

    /// Initialize a new DevOS project workspace
    pub fn init_project<P: AsRef<Path>>(
        target_dir: P,
        slug: &str,
        name: &str,
        description: &str,
        project_type: ProjectType,
        db: Option<&Database>,
    ) -> Result<DevosProject> {
        let root = target_dir.as_ref();
        fs::create_dir_all(root)?;

        let project = DevosProject::new(
            slug.to_string(),
            name.to_string(),
            description.to_string(),
            project_type.clone(),
        );

        // 1. Write devos.json and devos.json.bak
        let manifest_path = root.join("devos.json");
        atomic_write_json(&manifest_path, &project)?;
        let backup_path = root.join("devos.json.bak");
        let _ = atomic_write_json(&backup_path, &project);

        // 2. Create standard workspace directories
        fs::create_dir_all(root.join(&project.workspace_paths.requirements))?;
        fs::create_dir_all(root.join(&project.workspace_paths.standards))?;
        fs::create_dir_all(root.join(&project.workspace_paths.board))?;
        fs::create_dir_all(root.join(&project.workspace_paths.issues))?;
        fs::create_dir_all(root.join(&project.workspace_paths.docs))?;
        fs::create_dir_all(root.join(&project.workspace_paths.knowledge))?;
        fs::create_dir_all(root.join(&project.workspace_paths.artifacts))?;

        // 3. Write default standards/01-general-standards.md
        let general_standards = format!(
            r#"# {name} 项目开发硬性规范

## 1. 目录与分层约定
- 本项目属于 `{project_type:?}` 架构。
- 业务代码请放在标准源码目录，测试产物与临时文件输出到 `.devos/artifacts/`。
- 严禁擅自修改 `.ddev/config.yaml` 或根目录核心环境配置。

## 2. 换行符与跨平台规范
- 必须强制使用 LF (\n) 换行符。
- 所有落盘路径与配置统一使用相对 POSIX 路径 (`/`)。

## 3. 提测与自检规范
- Agent 在调用 `submit_for_testing` 提交前，必须先在容器内执行本地冒烟自检。
- 提测清单必须包含 3~5 条面向低技术用户的白话验收步骤。
"#,
            name = name,
            project_type = project_type,
        );
        atomic_write(
            root.join(&project.workspace_paths.standards).join("01-general-standards.md"),
            general_standards,
        )?;

        // 4. Write AGENTS.md
        let agents_md = format!(
            r#"# AI Agent 协作须知 ({name})

你是参与本项目研发的 AI 助手。DevOS 是本地标准化环境与验收工作台。

## 核心工作流
1. **获取上下文：** 会话启动第一件事是调用 MCP 工具 `get_project_brief`。
2. **在容器中开发：** 所有依赖安装、测试与构建必须调用 `env_control(action: "exec")` 在隔离容器内执行。
3. **维护运行清单：** 若新增后端脚本，必须同步更新 `devos.run.json`。
4. **标准化提测：** 开发完毕后调用 `submit_for_testing`，附带清晰的白话验收步骤。机器将先执行预检，通过后推送给用户测试。
5. **处理反馈与 Issue：** 当用户提测发现问题，调用 `list_issues` 获取完整排障上下文并修复，使用 `resolve_issue` 提请用户复测。
6. **多语言与白话交付：** 根据 `get_project_brief` 返回的 `user_locale` 使用对应语言编写交付说明，避免使用难以理解的技术黑话。
"#,
            name = name
        );
        atomic_write(root.join("AGENTS.md"), agents_md)?;

        // 5. If script or hybrid, create initial devos.run.json
        if matches!(project_type, ProjectType::Script | ProjectType::Hybrid) {
            let run_manifest_path = root.join("devos.run.json");
            if !run_manifest_path.exists() {
                let default_manifest = RunManifest::default();
                atomic_write_json(&run_manifest_path, &default_manifest)?;
            }
        }

        // 6. Index into DB if available
        if let Some(database) = db {
            database.upsert_project(
                &project.project_id,
                &project.slug,
                &project.name,
                &root.display().to_string(),
                match project.project_type {
                    ProjectType::Web => "web",
                    ProjectType::Script => "script",
                    ProjectType::Hybrid => "hybrid",
                },
                match project.mode {
                    ProjectMode::DevLocal => "DEV_LOCAL",
                    ProjectMode::ContentLocal => "CONTENT_LOCAL",
                    ProjectMode::DeployProd => "DEPLOY_PROD",
                },
                &project.created_at,
            )?;
        }

        Ok(project)
    }

    /// Scan project directory and re-index all board cards and issues into SQLite
    pub fn sync_to_db(root: &Path, project: &DevosProject, db: &Database) -> Result<()> {
        // Upsert project
        db.upsert_project(
            &project.project_id,
            &project.slug,
            &project.name,
            &root.display().to_string(),
            match project.project_type {
                ProjectType::Web => "web",
                ProjectType::Script => "script",
                ProjectType::Hybrid => "hybrid",
            },
            match project.mode {
                ProjectMode::DevLocal => "DEV_LOCAL",
                ProjectMode::ContentLocal => "CONTENT_LOCAL",
                ProjectMode::DeployProd => "DEPLOY_PROD",
            },
            &project.created_at,
        )?;

        // Scan board/
        let board_dir = root.join(&project.workspace_paths.board);
        if board_dir.exists() {
            if let Ok(entries) = fs::read_dir(board_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Ok(card) = read_json::<_, BoardCard>(&path) {
                            let json_str = serde_json::to_string(&card)?;
                            let col_str = match card.column {
                                devos_schema::BoardColumn::Todo => "todo",
                                devos_schema::BoardColumn::Doing => "doing",
                                devos_schema::BoardColumn::Testing => "testing",
                                devos_schema::BoardColumn::Done => "done",
                            };
                            let _ = db.upsert_board_card(
                                &card.card_id,
                                &project.project_id,
                                &card.title,
                                col_str,
                                &card.updated_by,
                                &json_str,
                            );
                        }
                    }
                }
            }
        }

        // Scan issues/
        let issues_dir = root.join(&project.workspace_paths.issues);
        if issues_dir.exists() {
            if let Ok(entries) = fs::read_dir(issues_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Ok(issue) = read_json::<_, Issue>(&path) {
                            let json_str = serde_json::to_string(&issue)?;
                            let status_str = match issue.status {
                                devos_schema::IssueStatus::Open => "open",
                                devos_schema::IssueStatus::InProgress => "in_progress",
                                devos_schema::IssueStatus::ReadyForRetest => "ready_for_retest",
                                devos_schema::IssueStatus::Closed => "closed",
                                devos_schema::IssueStatus::Reopened => "reopened",
                            };
                            let sev_str = match issue.severity {
                                devos_schema::IssueSeverity::Low => "low",
                                devos_schema::IssueSeverity::Medium => "medium",
                                devos_schema::IssueSeverity::High => "high",
                                devos_schema::IssueSeverity::Critical => "critical",
                            };
                            let src_str = match issue.source_type {
                                devos_schema::SourceType::WebPreview => "web_preview",
                                devos_schema::SourceType::ScriptRun => "script_run",
                                devos_schema::SourceType::Manual => "manual",
                                devos_schema::SourceType::DeployFailure => "deploy_failure",
                            };
                            let _ = db.upsert_issue(
                                &issue.issue_id,
                                &project.project_id,
                                status_str,
                                sev_str,
                                src_str,
                                &issue.user_report.title,
                                &json_str,
                                &issue.created_at,
                            );
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Check whether a proposed project directory has path pitfalls (Chinese, spaces, OneDrive/iCloud sync)
    pub fn validate_project_workspace_path<P: AsRef<Path>>(path: P) -> Vec<String> {
        let p = path.as_ref();
        let path_str = p.to_string_lossy();
        let mut warnings = Vec::new();

        // 1. Check for cloud sync directories
        let cloud_patterns = ["OneDrive", "iCloud", "BaiduNetdisk", "Dropbox", "Google Drive"];
        for cp in cloud_patterns {
            if path_str.contains(cp) {
                warnings.push(format!(
                    "路径位于云盘同步目录 ({}) 中。Docker 挂载和 SQLite 数据库在云盘中极易产生写锁冲突与挂载崩溃，强烈建议移至普通本地目录（如 ~/DevOS-Projects）。",
                    cp
                ));
            }
        }

        // 2. Check for spaces
        if path_str.contains(' ') {
            warnings.push("路径包含空格，部分脚本工具链或 Docker 挂载可能解析异常，建议使用连字符 '-' 或下划线 '_'。".to_string());
        }

        // 3. Check for non-ASCII (e.g. Chinese characters)
        if !path_str.is_ascii() {
            warnings.push("路径包含中文字符，非英语字符可能导致部分 CLI 工具和旧版 Docker 解析乱码。".to_string());
        }

        // 4. Check for length (> 200)
        if path_str.len() > 200 {
            warnings.push("路径层级过深（长度超过 200 字符），可能在 Windows 环境下触发 MAX_PATH 限制。".to_string());
        }

        warnings
    }

    /// Create a zero-wait interactive demo project for first-time onboarding
    pub fn init_demo_project<P: AsRef<Path>>(target_dir: P, db: Option<&Database>) -> Result<DevosProject> {
        let root = target_dir.as_ref();
        let project = Self::init_project(
            root,
            "demo-quickstart",
            "演示项目：极简发票工具",
            "这是一个无需拉取重型 Docker 镜像的 1 分钟新手交互演示项目。",
            ProjectType::Script,
            db,
        )?;

        // Seed a demo card
        let _ = BoardManager::upsert_card(
            root,
            &project,
            Some("CARD-001".to_string()),
            Some("体验 1 分钟完成功能验收与提测".to_string()),
            devos_schema::BoardColumn::Doing,
            "system",
            None,
            Some("点击测试台运行脚本并进行打勾验收。".to_string()),
        );

        // Seed a demo issue
        let _ = IssueManager::create_issue(
            root,
            &project,
            "金额汇总小数位精度偏离",
            "测试时发现当金额存在分位时未做四舍五入",
            Some("保留 2 位小数".to_string()),
            devos_schema::IssueSeverity::Medium,
            devos_schema::SourceType::ScriptRun,
            devos_schema::CapturedContext::default(),
            Some("CARD-001".to_string()),
            Some(1),
        );

        Ok(project)
    }
}
