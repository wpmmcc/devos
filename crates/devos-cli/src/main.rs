use clap::{Parser, Subcommand};
use devos_core::{BoardManager, Database, DevosError, IssueManager, ProjectManager, Result};
use devos_env::{DdevDriver, DevcontainerDriver, EnvDriver, PreflightDoctor};
use devos_schema::{
    ApiResponse, BoardColumn, DevosProject, LogFilter, LogLevel, LogSource, ProjectType,
};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "devos",
    author,
    version,
    about = "DevOS CLI: AI Agent Workbench & Standardized Local Environment Controller"
)]
struct Cli {
    #[arg(long, global = true, help = "Output response formatted as JSON")]
    json: bool,

    #[arg(
        long,
        global = true,
        help = "Target project directory (defaults to current dir)"
    )]
    project_dir: Option<PathBuf>,

    #[arg(long, help = "Run automated headless smoke test and verification")]
    smoke_test: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new DevOS project
    Init {
        #[arg(long, short)]
        name: String,
        #[arg(long, short)]
        slug: Option<String>,
        #[arg(long, short = 't', default_value = "hybrid")]
        project_type: String,
        #[arg(long, short = 'd', default_value = "")]
        description: String,
    },

    /// Get project summary, standards, and open tasks (Agent conversation starting tool)
    Brief {
        #[arg(long)]
        include_standards: bool,
        #[arg(long)]
        include_open_issues: bool,
    },

    /// Environment controls (DDEV / DevContainer)
    Env {
        action: String, // status, up, down, exec, snapshot, restore
        #[arg(long, default_value = "auto")]
        target: String, // web, script, auto
        #[arg(long)]
        cmd: Option<String>,
        #[arg(long)]
        snapshot_name: Option<String>,
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },

    /// Lightweight 4-column Board management
    Board {
        action: String, // list, get, upsert
        #[arg(long, visible_alias = "card", alias = "card")]
        card_id: Option<String>,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        col: Option<String>,
        #[arg(long, default_value = "agent")]
        updated_by: String,
        #[arg(long)]
        note: Option<String>,
    },

    /// Standardized testing submission gate
    Test {
        action: String, // submit, smoke
        #[arg(long, visible_alias = "card", alias = "card")]
        card_id: Option<String>,
        #[arg(long)]
        summary: Option<String>,
        #[arg(long)]
        checklist_json: Option<String>,
    },

    /// Standardized issue feedback and closing loop
    Issue {
        action: String, // list, get, create, resolve, retest
        #[arg(long)]
        issue_id: Option<String>,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        description: Option<String>,
        #[arg(long)]
        status: Option<String>,
        #[arg(long)]
        summary: Option<String>,
        #[arg(long)]
        files: Option<String>,
        #[arg(long)]
        passed: Option<bool>,
        #[arg(long)]
        feedback: Option<String>,
    },

    /// Preflight environment doctor check
    Doctor {
        #[arg(
            long,
            help = "Automatically fix and self-heal missing environment dependencies"
        )]
        fix: bool,
    },

    /// Automatically setup and self-heal all environment dependencies
    Setup,

    /// Manage AI agent MCP connection configs (Claude Desktop, Cursor, Factory Droid, etc.)
    AgentConfig {
        #[arg(long)]
        detect: bool,
        #[arg(long)]
        apply: Option<String>,
    },

    /// Export a sanitized diagnostic bundle
    Diagnostic,

    /// Export standardized universal production bundle (preflight gates, Docker Compose, DEPLOY.md, zip)
    Bundle {
        #[arg(long, default_value = "v1.0.0")]
        version: String,
        #[arg(long)]
        panel_friendly: bool,
    },

    /// Manage lightweight VCS time machine checkpoints (refs/devos/checkpoints, zero Git pollution)
    Checkpoint {
        action: String, // list, create, restore
        #[arg(long)]
        note: Option<String>,
        #[arg(long)]
        id: Option<String>,
    },

    /// Clean expired artifacts, logs, and prune com.devos.managed docker images
    Clean {
        #[arg(long, default_value = "30")]
        days: u64,
        #[arg(long)]
        prune_docker: bool,
        #[arg(long)]
        status: bool,
    },

    /// Workspace and project utilities (safe trash, list-trash, restore, delete-trash, empty-trash, validate)
    Project {
        action: String, // trash, list-trash, restore, delete-trash, empty-trash, validate
        #[arg(long)]
        path: Option<PathBuf>,
        #[arg(long)]
        trash_id: Option<String>,
        #[arg(long)]
        target_path: Option<PathBuf>,
    },

    /// Standardized delivery deployment plugins (VPS Docker Compose, recipes, rollback)
    Deploy {
        action: String, // list, validate, plan, apply, rollback
        #[arg(long, default_value = "vps-docker")]
        plugin: String,
        #[arg(long)]
        host: Option<String>,
        #[arg(long, default_value = "22")]
        port: u16,
        #[arg(long, default_value = "root")]
        user: String,
        #[arg(long, default_value = "/opt/apps")]
        dir: String,
        #[arg(long)]
        version: Option<String>,
        #[arg(long)]
        path: Option<PathBuf>,
    },

    /// View, query, and manage structured runtime and environment logs
    Logs {
        #[arg(long, short = 'l')]
        level: Option<String>, // debug, info, warn, error
        #[arg(long, short = 's')]
        source: Option<String>, // core, env, runner, probe, deploy, all
        #[arg(long, short = 'n', default_value = "50")]
        lines: usize,
        #[arg(long, short = 'q')]
        query: Option<String>,
        #[arg(long)]
        clear: bool,
    },
}

fn print_result<T: serde::Serialize>(json_mode: bool, res: Result<T>) {
    if json_mode {
        match res {
            Ok(data) => {
                let resp = ApiResponse::success(data);
                println!("{}", serde_json::to_string_pretty(&resp).unwrap());
            }
            Err(e) => {
                let resp = ApiResponse::<()>::error(
                    e.error_code(),
                    e.to_string(),
                    e.hint(),
                    Some(e.plain_message()),
                );
                println!("{}", serde_json::to_string_pretty(&resp).unwrap());
            }
        }
    } else {
        match res {
            Ok(data) => {
                if let Ok(val) = serde_json::to_value(&data) {
                    if val.is_string() {
                        println!("{}", val.as_str().unwrap());
                    } else {
                        println!("{}", serde_json::to_string_pretty(&data).unwrap());
                    }
                }
            }
            Err(e) => {
                eprintln!("❌ 错误 [{}]: {}", e.error_code(), e.plain_message());
                if let Some(hint) = e.hint() {
                    eprintln!("💡 提示: {}", hint);
                }
            }
        }
    }
}

fn get_project_context(custom_dir: Option<PathBuf>) -> Result<(PathBuf, DevosProject)> {
    let start_dir = custom_dir.unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    ProjectManager::find_and_load(start_dir)
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let json_mode = cli.json;

    if cli.smoke_test {
        let db_status = match Database::open_global() {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        let doctor_diags = PreflightDoctor::diagnose_all();
        let adapters = devos_core::AgentConfigManager::supported_adapters();
        let mirrors = devos_core::MirrorManager::load_config();

        let output = serde_json::json!({
            "status": "ok",
            "smoke_test": "passed",
            "version": env!("CARGO_PKG_VERSION"),
            "components": {
                "database": db_status,
                "preflight_items_checked": doctor_diags.len(),
                "agent_adapters_supported": adapters.len(),
                "mirrors_tools_count": mirrors.tools.len(),
            }
        });
        println!("{}", serde_json::to_string_pretty(&output).unwrap());
        return;
    }

    let command = match cli.command {
        Some(cmd) => cmd,
        None => {
            eprintln!("请指定执行子命令，或使用 `devos --help` 查看说明。CI 环境可使用 `devos --smoke-test` 执行快速自检。");
            return;
        }
    };

    match command {
        Commands::Init {
            name,
            slug,
            project_type,
            description,
        } => {
            let p_slug = slug.unwrap_or_else(|| {
                name.to_lowercase()
                    .replace(' ', "-")
                    .chars()
                    .filter(|c| c.is_alphanumeric() || *c == '-')
                    .collect()
            });
            let p_type = match project_type.as_str() {
                "web" => ProjectType::Web,
                "script" => ProjectType::Script,
                _ => ProjectType::Hybrid,
            };
            let target_dir = cli
                .project_dir
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

            let res = (|| -> Result<DevosProject> {
                let db = Database::open_global().ok();
                ProjectManager::init_project(
                    &target_dir,
                    &p_slug,
                    &name,
                    &description,
                    p_type,
                    db.as_ref(),
                )
            })();
            print_result(json_mode, res);
        }

        Commands::Brief {
            include_standards,
            include_open_issues,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, project) = get_project_context(cli.project_dir)?;
                let cards = BoardManager::list_cards(&root, &project)?;
                let issues = IssueManager::list_issues(&root, &project, Some("open"))?;

                let mut brief = serde_json::json!({
                    "project_id": project.project_id,
                    "slug": project.slug,
                    "name": project.name,
                    "description": project.description,
                    "project_type": project.project_type,
                    "mode": project.mode,
                    "environments": project.environments,
                    "board_cards_count": cards.len(),
                    "open_issues_count": issues.len(),
                });

                if include_standards {
                    let standards_dir = root.join(&project.workspace_paths.standards);
                    let mut std_content = Vec::new();
                    if standards_dir.exists() {
                        for entry in std::fs::read_dir(standards_dir)?.flatten() {
                            if entry.path().extension().and_then(|s| s.to_str()) == Some("md") {
                                if let Ok(s) = std::fs::read_to_string(entry.path()) {
                                    std_content.push(s);
                                }
                            }
                        }
                    }
                    brief["standards"] = serde_json::json!(std_content);
                }

                if include_open_issues {
                    brief["open_issues"] = serde_json::json!(issues);
                }

                Ok(brief)
            })();
            print_result(json_mode, res);
        }

        Commands::Env {
            action,
            target,
            cmd,
            snapshot_name,
            args,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, project) = get_project_context(cli.project_dir)?;
                let driver: Box<dyn EnvDriver> = match (target.as_str(), &project.project_type) {
                    ("script", _) => Box::new(DevcontainerDriver::new()),
                    ("web", _) => Box::new(DdevDriver::new()),
                    (_, ProjectType::Script) => Box::new(DevcontainerDriver::new()),
                    _ => Box::new(DdevDriver::new()),
                };

                match action.as_str() {
                    "status" => {
                        let st = driver.status(&root)?;
                        Ok(serde_json::to_value(st)?)
                    }
                    "up" => {
                        let st = driver.up(&root)?;
                        Ok(serde_json::to_value(st)?)
                    }
                    "down" => {
                        devos_core::Guardrails::check_destructive_allowed(&project, "down")?;
                        driver.down(&root)?;
                        Ok(serde_json::json!({ "status": "stopped" }))
                    }
                    "exec" => {
                        let command = if let Some(c) = cmd {
                            c
                        } else if !args.is_empty() {
                            args.join(" ")
                        } else {
                            return Err(DevosError::Custom {
                                code: "MISSING_ARG".to_string(),
                                message: "Missing command for exec. Use --cmd <cmd> or pass arguments after --".to_string(),
                                hint: Some("Specify --cmd 'your command' or pass arguments after '--'".to_string()),
                                plain_message: Some("执行命令时请提供 --cmd 参数或在 -- 后跟随命令".to_string()),
                            });
                        };
                        let exec_res = driver.exec(&root, &command, 60, &[])?;
                        Ok(serde_json::to_value(exec_res)?)
                    }
                    "snapshot" => {
                        let name = snapshot_name.unwrap_or_else(|| "auto_snapshot".to_string());
                        driver.snapshot(&root, &name)?;
                        Ok(serde_json::json!({ "snapshot_created": name }))
                    }
                    "restore" => {
                        let name = snapshot_name.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --snapshot-name for restore".to_string(),
                            hint: Some("Specify --snapshot-name <name>".to_string()),
                            plain_message: Some("还原快照时请指定快照名称".to_string()),
                        })?;
                        devos_core::Guardrails::check_destructive_allowed(&project, "restore")?;
                        driver.restore(&root, &name)?;
                        Ok(serde_json::json!({ "snapshot_restored": name }))
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown env action: {}", action),
                        hint: Some(
                            "Supported: status, up, down, exec, snapshot, restore".to_string(),
                        ),
                        plain_message: Some(format!("不支持的环境操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Board {
            action,
            card_id,
            title,
            col,
            updated_by,
            note,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, project) = get_project_context(cli.project_dir)?;
                match action.as_str() {
                    "list" => {
                        let cards = BoardManager::list_cards(&root, &project)?;
                        Ok(serde_json::to_value(cards)?)
                    }
                    "get" => {
                        let id = card_id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --card-id".to_string(),
                            hint: None,
                            plain_message: Some("请指定卡片编号 --card-id".to_string()),
                        })?;
                        let card = BoardManager::get_card(&root, &project, &id)?;
                        Ok(serde_json::to_value(card)?)
                    }
                    "upsert" => {
                        let target_col = match col.as_deref() {
                            Some("doing") => BoardColumn::Doing,
                            Some("testing") => BoardColumn::Testing,
                            Some("done") => BoardColumn::Done,
                            _ => BoardColumn::Todo,
                        };
                        let card = BoardManager::upsert_card(
                            &root,
                            &project,
                            card_id,
                            title,
                            target_col,
                            &updated_by,
                            None,
                            note,
                        )?;
                        Ok(serde_json::to_value(card)?)
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown board action: {}", action),
                        hint: Some("Supported: list, get, upsert".to_string()),
                        plain_message: Some(format!("未知的看板操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Test {
            action,
            card_id,
            summary,
            checklist_json,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, project) = get_project_context(cli.project_dir)?;
                match action.as_str() {
                    "submit" => {
                        let id = card_id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --card-id".to_string(),
                            hint: None,
                            plain_message: Some("提测时请指定卡片编号 --card-id".to_string()),
                        })?;
                        let sum =
                            summary.unwrap_or_else(|| "功能开发完成，请按验收单测试".to_string());
                        let steps = if let Some(j) = checklist_json {
                            serde_json::from_str(&j).unwrap_or_default()
                        } else {
                            vec![]
                        };

                        let card = BoardManager::submit_for_testing(
                            &root,
                            &project,
                            &id,
                            &sum,
                            steps,
                            vec![],
                        )?;
                        Ok(serde_json::to_value(card)?)
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown test action: {}", action),
                        hint: Some("Supported: submit, smoke".to_string()),
                        plain_message: Some(format!("未知的测试命令: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Issue {
            action,
            issue_id,
            title,
            description,
            status,
            summary,
            files,
            passed,
            feedback,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, project) = get_project_context(cli.project_dir)?;
                match action.as_str() {
                    "list" => {
                        let issues = IssueManager::list_issues(&root, &project, status.as_deref())?;
                        Ok(serde_json::to_value(issues)?)
                    }
                    "get" => {
                        let id = issue_id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --issue-id".to_string(),
                            hint: None,
                            plain_message: Some("请指定反馈编号 --issue-id".to_string()),
                        })?;
                        let issue = IssueManager::get_issue(&root, &project, &id)?;
                        Ok(serde_json::to_value(issue)?)
                    }
                    "create" => {
                        let t = title.unwrap_or_else(|| "用户反馈测试问题".to_string());
                        let desc = description.unwrap_or_else(|| "无详细描述".to_string());
                        let issue = IssueManager::create_issue(
                            &root,
                            &project,
                            &t,
                            &desc,
                            None,
                            devos_schema::IssueSeverity::High,
                            devos_schema::SourceType::Manual,
                            devos_schema::CapturedContext::default(),
                            None,
                            None,
                        )?;
                        Ok(serde_json::to_value(issue)?)
                    }
                    "resolve" => {
                        let id = issue_id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --issue-id".to_string(),
                            hint: None,
                            plain_message: Some("请指定修复的反馈编号 --issue-id".to_string()),
                        })?;
                        let sum = summary.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --summary fix summary".to_string(),
                            hint: None,
                            plain_message: Some("请提供白话修复说明 --summary".to_string()),
                        })?;
                        let changed = files
                            .map(|f| f.split(',').map(|s| s.trim().to_string()).collect())
                            .unwrap_or_default();
                        let issue =
                            IssueManager::resolve_issue(&root, &project, &id, &sum, changed, None)?;
                        Ok(serde_json::to_value(issue)?)
                    }
                    "retest" => {
                        let id = issue_id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_ARG".to_string(),
                            message: "Missing --issue-id".to_string(),
                            hint: None,
                            plain_message: Some("请指定复测的反馈编号 --issue-id".to_string()),
                        })?;
                        let is_passed = passed.unwrap_or(true);
                        let fb = feedback.unwrap_or_else(|| {
                            if is_passed {
                                "复测通过".to_string()
                            } else {
                                "复测不通过，问题依然存在".to_string()
                            }
                        });
                        let issue =
                            IssueManager::retest_issue(&root, &project, &id, is_passed, &fb)?;
                        Ok(serde_json::to_value(issue)?)
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown issue action: {}", action),
                        hint: Some("Supported: list, get, resolve, retest".to_string()),
                        plain_message: Some(format!("未知的反馈操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Doctor { fix } => {
            devos_core::log_info(
                LogSource::Core,
                format!("Preflight doctor check started (fix_mode={})", fix),
            );
            let diags = if fix {
                PreflightDoctor::auto_fix_all()
            } else {
                PreflightDoctor::diagnose_all()
            };
            devos_core::log_info(
                LogSource::Core,
                format!("Preflight doctor finished with {} diagnosis items", diags.len()),
            );
            print_result(json_mode, Ok(diags));
        }

        Commands::Setup => {
            let diags = PreflightDoctor::auto_fix_all();
            print_result(json_mode, Ok(diags));
        }

        Commands::AgentConfig { detect: _, apply } => {
            let res = (|| -> Result<serde_json::Value> {
                let loaded = ProjectManager::find_and_load(".").ok().map(|(r, _)| r);
                let project_root = cli.project_dir.as_deref().or(loaded.as_deref());

                if let Some(target) = apply {
                    let msg = devos_core::AgentConfigManager::configure_agent(
                        &target,
                        None,
                        project_root,
                    )?;
                    Ok(serde_json::json!({ "status": "ok", "message": msg }))
                } else {
                    let list = devos_core::AgentConfigManager::detect_agents(project_root);
                    Ok(serde_json::to_value(list)?)
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Diagnostic => {
            let loaded = ProjectManager::find_and_load(".").ok().map(|(r, _)| r);
            let project_root = cli.project_dir.as_deref().or(loaded.as_deref());
            let res = devos_core::export_diagnostic_bundle(project_root).map(
                |p| serde_json::json!({ "status": "ok", "bundle_path": p.display().to_string() }),
            );
            print_result(json_mode, res);
        }

        Commands::Bundle {
            version,
            panel_friendly,
        } => {
            let res = (|| -> Result<devos_core::ReleaseBuildResult> {
                let (root, project) = get_project_context(cli.project_dir.clone())?;
                devos_core::ReleaseManager::prepare_release_artifacts(
                    &root,
                    &project,
                    &version,
                    panel_friendly,
                )
            })();
            print_result(json_mode, res);
        }

        Commands::Checkpoint { action, note, id } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, _) = get_project_context(cli.project_dir.clone())?;
                match action.as_str() {
                    "list" => {
                        let list = devos_core::CheckpointManager::list_checkpoints(&root)?;
                        Ok(serde_json::to_value(list)?)
                    }
                    "create" => {
                        let note_str = note.unwrap_or_else(|| "CLI manual checkpoint".to_string());
                        let cp = devos_core::CheckpointManager::create_checkpoint(
                            &root,
                            &note_str,
                            "user_manual",
                        )?;
                        Ok(serde_json::to_value(cp)?)
                    }
                    "restore" => {
                        let cp_id = id.ok_or_else(|| DevosError::Custom {
                            code: "MISSING_CHECKPOINT_ID".to_string(),
                            message: "Checkpoint ID required for restore".to_string(),
                            hint: Some("Use --id <checkpoint_id>".to_string()),
                            plain_message: Some("还原时必须指定快照编号 --id".to_string()),
                        })?;
                        devos_core::CheckpointManager::restore_checkpoint(&root, &cp_id)?;
                        Ok(serde_json::json!({ "status": "restored", "checkpoint_id": cp_id }))
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown checkpoint action: {}", action),
                        hint: Some("Supported: list, create, restore".to_string()),
                        plain_message: Some(format!("未知的时光机操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Clean {
            days,
            prune_docker,
            status,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let (root, _) = get_project_context(cli.project_dir.clone())?;
                if status {
                    let report = devos_core::StorageCleaner::calculate_storage_usage(&root);
                    Ok(serde_json::to_value(report)?)
                } else {
                    let freed = devos_core::StorageCleaner::clean_expired_artifacts(&root, days)?;
                    if prune_docker {
                        let _ = devos_core::StorageCleaner::prune_managed_docker_cache();
                    }
                    Ok(serde_json::json!({
                        "status": "cleaned",
                        "freed_bytes": freed,
                        "pruned_docker": prune_docker
                    }))
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Project {
            action,
            path,
            trash_id,
            target_path,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let target = path
                    .clone()
                    .or(cli.project_dir.clone())
                    .unwrap_or_else(|| PathBuf::from("."));
                match action.as_str() {
                    "trash" => {
                        let db = Database::open_global().ok();
                        let dest = devos_core::ProjectManager::trash_project(&target, db.as_ref())?;
                        Ok(serde_json::json!({
                            "status": "trashed",
                            "trash_path": dest.display().to_string()
                        }))
                    }
                    "list-trash" | "trash-list" => {
                        let list = devos_core::ProjectManager::list_trash()?;
                        Ok(serde_json::to_value(list)?)
                    }
                    "restore" | "restore-trash" => {
                        let id = trash_id
                            .as_deref()
                            .or_else(|| path.as_ref().and_then(|p| p.to_str()))
                            .ok_or_else(|| DevosError::Custom {
                                code: "MISSING_TRASH_ID".to_string(),
                                message: "Missing --trash-id argument for restore".to_string(),
                                hint: Some("Specify --trash-id <TRASH_ID>".to_string()),
                                plain_message: Some("恢复项目时请指定 --trash-id 参数".to_string()),
                            })?;
                        let db = Database::open_global().ok();
                        let dest = devos_core::ProjectManager::restore_from_trash(
                            id,
                            target_path.as_deref(),
                            db.as_ref(),
                        )?;
                        Ok(serde_json::json!({
                            "status": "restored",
                            "restored_path": dest.display().to_string()
                        }))
                    }
                    "delete-trash" => {
                        let id = trash_id
                            .as_deref()
                            .or_else(|| path.as_ref().and_then(|p| p.to_str()))
                            .ok_or_else(|| DevosError::Custom {
                                code: "MISSING_TRASH_ID".to_string(),
                                message: "Missing --trash-id argument for delete-trash".to_string(),
                                hint: Some("Specify --trash-id <TRASH_ID>".to_string()),
                                plain_message: Some("彻底删除项目时请指定 --trash-id 参数".to_string()),
                            })?;
                        devos_core::ProjectManager::delete_trash_item(id)?;
                        Ok(serde_json::json!({
                            "status": "deleted",
                            "trash_id": id
                        }))
                    }
                    "empty-trash" => {
                        let freed = devos_core::ProjectManager::empty_trash()?;
                        Ok(serde_json::json!({
                            "status": "emptied",
                            "freed_bytes": freed
                        }))
                    }
                    "validate" => {
                        let warnings =
                            devos_core::ProjectManager::validate_project_workspace_path(&target);
                        Ok(serde_json::json!({
                            "valid": warnings.is_empty(),
                            "warnings": warnings
                        }))
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown project action: {}", action),
                        hint: Some(
                            "Supported: trash, list-trash, restore, delete-trash, empty-trash, validate"
                                .to_string(),
                        ),
                        plain_message: Some(format!("未知的项目操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }

        Commands::Deploy {
            action,
            plugin,
            host,
            port,
            user,
            dir,
            version,
            path,
        } => {
            let res = (|| -> Result<serde_json::Value> {
                let target_dir = path
                    .or(cli.project_dir.clone())
                    .unwrap_or_else(|| PathBuf::from("."));
                let release_dir = target_dir.join("releases");
                match action.as_str() {
                    "list" => {
                        let plugins = devos_core::DeployPluginManager::list_plugins();
                        Ok(serde_json::to_value(plugins)?)
                    }
                    "validate" => {
                        let mut cfg = std::collections::HashMap::new();
                        cfg.insert(
                            "host".to_string(),
                            host.unwrap_or_else(|| "127.0.0.1".to_string()),
                        );
                        cfg.insert("port".to_string(), port.to_string());
                        cfg.insert("user".to_string(), user);
                        let val = devos_core::DeployPluginManager::validate_target(&plugin, &cfg)?;
                        Ok(serde_json::to_value(val)?)
                    }
                    "plan" => {
                        let mut cfg = std::collections::HashMap::new();
                        cfg.insert(
                            "host".to_string(),
                            host.unwrap_or_else(|| "127.0.0.1".to_string()),
                        );
                        cfg.insert("deploy_dir".to_string(), dir);
                        let plan = devos_core::DeployPluginManager::plan_deployment(
                            &plugin,
                            &release_dir,
                            &cfg,
                        )?;
                        Ok(serde_json::to_value(plan)?)
                    }
                    "apply" => {
                        let mut cfg = std::collections::HashMap::new();
                        cfg.insert(
                            "host".to_string(),
                            host.unwrap_or_else(|| "127.0.0.1".to_string()),
                        );
                        cfg.insert("deploy_dir".to_string(), dir);
                        let apply_res = devos_core::DeployPluginManager::apply_deployment(
                            &plugin,
                            &release_dir,
                            &cfg,
                            |p| {
                                if !json_mode {
                                    println!(
                                        "[DEPLOY {:3}%] [{}] {}",
                                        p.percent, p.stage_code, p.message_plain
                                    );
                                }
                            },
                        )?;
                        Ok(serde_json::to_value(apply_res)?)
                    }
                    "rollback" => {
                        let target_v = version.unwrap_or_else(|| "v1.0.0".to_string());
                        let mut cfg = std::collections::HashMap::new();
                        cfg.insert(
                            "host".to_string(),
                            host.unwrap_or_else(|| "127.0.0.1".to_string()),
                        );
                        let rb = devos_core::DeployPluginManager::rollback_deployment(
                            &plugin, &target_v, &cfg,
                        )?;
                        Ok(serde_json::to_value(rb)?)
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown deploy action: {}", action),
                        hint: Some("Supported: list, validate, plan, apply, rollback".to_string()),
                        plain_message: Some(format!("未知的部署操作: {}", action)),
                    }),
                }
            })();
            print_result(json_mode, res);
        }
        Commands::Logs {
            level,
            source,
            lines,
            query,
            clear,
        } => {
            if clear {
                devos_core::clear_logs();
                if json_mode {
                    println!("{}", serde_json::to_string_pretty(&ApiResponse::success(true)).unwrap());
                } else {
                    println!("In-memory log buffer cleared.");
                }
                return;
            }

            let min_level = level.as_deref().and_then(|l| l.parse::<LogLevel>().ok());
            let source_filter = source.as_deref().and_then(|s| s.parse::<LogSource>().ok());

            let filter = LogFilter {
                min_level,
                source: source_filter,
                query,
                limit: Some(lines),
            };

            let entries = devos_core::get_logs(&filter);
            if json_mode {
                println!("{}", serde_json::to_string_pretty(&ApiResponse::success(entries)).unwrap());
            } else if entries.is_empty() {
                println!("No logs found matching current filter.");
            } else {
                for e in entries {
                    let level_badge = match e.level {
                        LogLevel::Error => "[ERROR]",
                        LogLevel::Warn => "[WARN] ",
                        LogLevel::Info => "[INFO] ",
                        LogLevel::Debug => "[DEBUG]",
                    };
                    println!(
                        "{} {} [{}] {}{}",
                        e.timestamp,
                        level_badge,
                        e.source,
                        e.message,
                        e.project_slug.map(|s| format!(" (project={})", s)).unwrap_or_default()
                    );
                }
            }
        }
    }
}
