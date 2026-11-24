use devos_core::{
    ensure_within_root, fs_utils::read_json, AgentConfigManager, BoardManager, Checkpoint,
    CheckpointManager, Database, DevosError, Guardrails, IssueManager, PortOccupant, PortRegistry,
    ProjectChangeEvent, ProjectManager, ProjectWatcher, ReleaseBuildResult, ReleaseManager, Result,
    StorageCleaner, StorageReport,
};
use devos_env::{
    DdevDriver, DevcontainerDriver, DiagnosticItem, EnvDriver, EnvStatus, PreflightDoctor,
};
use devos_schema::{
    AgentDetection, ApiResponse, BoardCard, BoardColumn, DevosProject, Issue, IssueSeverity,
    LogEntry, LogFilter, LogLevel, LogSource, ProjectType, RunManifest, SourceType,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};

struct ActiveWatcherState(Mutex<Option<ProjectWatcher>>);
struct ActiveEnvLocks(Mutex<HashSet<PathBuf>>);

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentProjectDto {
    pub path: String,
    pub name: String,
    pub project_type: String,
}

fn to_api_resp<T>(res: Result<T>) -> ApiResponse<T> {
    match res {
        Ok(data) => ApiResponse::success(data),
        Err(e) => ApiResponse::error(
            e.error_code(),
            e.to_string(),
            e.hint(),
            Some(e.plain_message()),
        ),
    }
}

#[tauri::command]
fn run_preflight_doctor() -> ApiResponse<Vec<DiagnosticItem>> {
    let diags = PreflightDoctor::diagnose_all();
    ApiResponse::success(diags)
}

#[tauri::command]
fn auto_fix_environment() -> ApiResponse<Vec<DiagnosticItem>> {
    let diags = PreflightDoctor::auto_fix_all();
    ApiResponse::success(diags)
}

#[tauri::command]
fn get_recent_projects() -> ApiResponse<Vec<RecentProjectDto>> {
    let res = (|| -> Result<Vec<RecentProjectDto>> {
        let db = Database::open_global()?;
        let mut list = db.list_recent_projects()?;

        // Auto-discover projects in ~/DevOSProjects if list is empty
        if list.is_empty() {
            if let Some(home) = dirs::home_dir() {
                let projects_dir = home.join("DevOSProjects");
                if projects_dir.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
                        for entry in entries.flatten() {
                            let sub = entry.path();
                            if sub.join("devos.json").exists() {
                                if let Ok((_, p)) = ProjectManager::find_and_load(&sub) {
                                    let p_type = match p.project_type {
                                        ProjectType::Web => "web",
                                        ProjectType::Script => "script",
                                        ProjectType::Hybrid => "hybrid",
                                    };
                                    let _ = db.add_recent_project(
                                        &sub.display().to_string(),
                                        &p.name,
                                        p_type,
                                    );
                                }
                            }
                        }
                    }
                    list = db.list_recent_projects()?;
                }
            }
        }

        Ok(list
            .into_iter()
            .map(|(path, name, project_type)| RecentProjectDto {
                path,
                name,
                project_type,
            })
            .collect())
    })();
    to_api_resp(res)
}

#[tauri::command]
fn init_project(
    app: AppHandle,
    state: State<'_, ActiveWatcherState>,
    target_path: String,
    slug: String,
    name: String,
    description: String,
    project_type: String,
) -> ApiResponse<DevosProject> {
    let p_type = match project_type.as_str() {
        "web" => ProjectType::Web,
        "script" => ProjectType::Script,
        _ => ProjectType::Hybrid,
    };

    let resolved_path = if target_path.is_empty() || target_path == "." {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join("devos-projects").join(&slug)
    } else {
        let p = PathBuf::from(&target_path);
        if p.file_name().and_then(|s| s.to_str()) == Some(&slug) {
            p
        } else {
            p.join(&slug)
        }
    };

    let db = Database::open_global().ok();
    let res = ProjectManager::init_project(
        &resolved_path,
        &slug,
        &name,
        &description,
        p_type,
        db.as_ref(),
    );

    if let Ok(ref proj) = res {
        if let Some(ref database) = db {
            let _ = database.add_recent_project(
                &resolved_path.display().to_string(),
                &proj.name,
                match proj.project_type {
                    ProjectType::Web => "web",
                    ProjectType::Script => "script",
                    ProjectType::Hybrid => "hybrid",
                },
            );
        }

        // Setup real-time file watcher
        setup_watcher(&app, &state, &resolved_path);
    }

    to_api_resp(res)
}

#[tauri::command]
fn load_project(
    app: AppHandle,
    state: State<'_, ActiveWatcherState>,
    project_path: String,
) -> ApiResponse<DevosProject> {
    let res = (|| -> Result<DevosProject> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        if let Ok(db) = Database::open_global() {
            let _ = ProjectManager::sync_to_db(&root, &project, &db);
            let _ = db.add_recent_project(
                &root.display().to_string(),
                &project.name,
                match project.project_type {
                    ProjectType::Web => "web",
                    ProjectType::Script => "script",
                    ProjectType::Hybrid => "hybrid",
                },
            );
        }

        // Setup real-time file watcher
        setup_watcher(&app, &state, &root);

        Ok(project)
    })();
    to_api_resp(res)
}

fn setup_watcher(app: &AppHandle, state: &State<'_, ActiveWatcherState>, root: &Path) {
    let app_handle = app.clone();
    let root_buf = root.to_path_buf();

    let watcher_res = ProjectWatcher::watch(root, move |event, _path| {
        // Automatically sync to sqlite and broadcast Tauri event
        if let Ok(db) = Database::open_global() {
            if let Ok((r, p)) = ProjectManager::find_and_load(&root_buf) {
                let _ = ProjectManager::sync_to_db(&r, &p, &db);
            }
        }

        match event {
            ProjectChangeEvent::BoardUpdated { card_id } => {
                let _ = app_handle.emit("devos://board-updated", card_id);
            }
            ProjectChangeEvent::IssueUpdated { issue_id } => {
                let _ = app_handle.emit("devos://issues-updated", issue_id);
            }
            ProjectChangeEvent::ManifestUpdated | ProjectChangeEvent::StandardUpdated => {
                let _ = app_handle.emit("devos://project-updated", ());
            }
            _ => {}
        }
    });

    if let Ok(w) = watcher_res {
        let mut lock = state.0.lock().unwrap();
        *lock = Some(w);
    }
}

#[tauri::command]
fn list_board_cards(project_path: String) -> ApiResponse<Vec<BoardCard>> {
    let res = (|| -> Result<Vec<BoardCard>> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        BoardManager::list_cards(&root, &project)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn move_board_card(
    app: AppHandle,
    project_path: String,
    card_id: String,
    column: String,
    updated_by: String,
) -> ApiResponse<BoardCard> {
    let res = (|| -> Result<BoardCard> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let col = match column.as_str() {
            "doing" => BoardColumn::Doing,
            "testing" => BoardColumn::Testing,
            "done" => BoardColumn::Done,
            _ => BoardColumn::Todo,
        };
        let card = BoardManager::upsert_card(
            &root,
            &project,
            Some(card_id),
            None,
            col,
            &updated_by,
            None,
            None,
        )?;
        let _ = app.emit("devos://board-updated", &card.card_id);
        Ok(card)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn create_board_card(
    app: AppHandle,
    project_path: String,
    title: String,
) -> ApiResponse<BoardCard> {
    let res = (|| -> Result<BoardCard> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let card = BoardManager::upsert_card(
            &root,
            &project,
            None,
            Some(title),
            BoardColumn::Todo,
            "user",
            None,
            None,
        )?;
        let _ = app.emit("devos://board-updated", &card.card_id);
        Ok(card)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn list_issues(project_path: String, status: Option<String>) -> ApiResponse<Vec<Issue>> {
    let res = (|| -> Result<Vec<Issue>> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        IssueManager::list_issues(&root, &project, status.as_deref())
    })();
    to_api_resp(res)
}

#[tauri::command]
fn create_web_issue(
    app: AppHandle,
    project_path: String,
    title: String,
    description: String,
    expected_behavior: Option<String>,
    url: String,
    screenshot_path: Option<String>,
    console_errors: Vec<devos_schema::ConsoleErrorRecord>,
    failed_requests: Vec<devos_schema::FailedRequestRecord>,
) -> ApiResponse<Issue> {
    let res = (|| -> Result<Issue> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;

        // Fetch recent container / backend logs for this project (up to 50 lines)
        let mut raw_backend_logs = Vec::new();
        if let Ok(lines) = DdevDriver::new().logs(&root, 50) {
            raw_backend_logs = lines;
        }
        if raw_backend_logs.is_empty() {
            let recent_entries = devos_core::get_logs(&LogFilter {
                min_level: None,
                source: Some(LogSource::Env),
                query: None,
                limit: Some(50),
            });
            raw_backend_logs = recent_entries.into_iter().map(|e| e.message).collect();
        }
        let backend_logs_tail: Vec<String> = raw_backend_logs
            .into_iter()
            .map(|l| devos_core::sanitize_text(&l))
            .collect();

        let mut context = devos_schema::CapturedContext::default();
        context.web = Some(devos_schema::WebContext {
            url,
            viewport: "1440x900".to_string(),
            screenshot_path,
            annotated_region: None,
            console_errors,
            failed_requests,
            backend_logs_tail,
        });

        let issue = IssueManager::create_issue(
            &root,
            &project,
            &title,
            &description,
            expected_behavior,
            IssueSeverity::High,
            SourceType::WebPreview,
            context,
            None,
            None,
        )?;
        let _ = app.emit("devos://issues-updated", &issue.issue_id);
        Ok(issue)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn create_script_issue(
    app: AppHandle,
    project_path: String,
    title: String,
    description: String,
    expected_behavior: Option<String>,
    script_context: devos_schema::ScriptContext,
) -> ApiResponse<Issue> {
    let res = (|| -> Result<Issue> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let mut context = devos_schema::CapturedContext::default();
        context.script = Some(script_context);

        let issue = IssueManager::create_issue(
            &root,
            &project,
            &title,
            &description,
            expected_behavior,
            IssueSeverity::High,
            SourceType::ScriptRun,
            context,
            None,
            None,
        )?;
        let _ = app.emit("devos://issues-updated", &issue.issue_id);
        Ok(issue)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn retest_issue(
    app: AppHandle,
    project_path: String,
    issue_id: String,
    passed: bool,
    feedback: String,
) -> ApiResponse<Issue> {
    let res = (|| -> Result<Issue> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let issue = IssueManager::retest_issue(&root, &project, &issue_id, passed, &feedback)?;
        let _ = app.emit("devos://issues-updated", &issue.issue_id);
        Ok(issue)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn get_run_manifest(project_path: String) -> ApiResponse<RunManifest> {
    let res = (|| -> Result<RunManifest> {
        let manifest_path = Path::new(&project_path).join("devos.run.json");
        if manifest_path.exists() {
            read_json(&manifest_path)
        } else {
            Ok(RunManifest::default())
        }
    })();
    to_api_resp(res)
}

#[tauri::command]
fn execute_script_target(
    project_path: String,
    target_id: String,
    inputs: serde_json::Value,
) -> ApiResponse<devos_schema::ScriptContext> {
    let res = (|| -> Result<devos_schema::ScriptContext> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        let manifest_path = root.join("devos.run.json");
        let manifest: RunManifest = read_json(&manifest_path)?;
        let target = manifest
            .targets
            .into_iter()
            .find(|t| t.id == target_id)
            .ok_or_else(|| DevosError::Custom {
                code: "TARGET_NOT_FOUND".to_string(),
                message: format!("Target {} not found in devos.run.json", target_id),
                hint: None,
                plain_message: Some(format!("未在 devos.run.json 中找到任务 {}", target_id)),
            })?;

        let mut cmd = target.command.clone();
        if let Some(map) = inputs.as_object() {
            for (k, v) in map {
                let v_str = match v {
                    serde_json::Value::String(s) => s.clone(),
                    _ => v.to_string(),
                };

                // Validate inputs that look like file paths against directory traversal
                if v_str.contains('/') || v_str.contains('\\') || v_str.contains("..") {
                    let path = Path::new(&v_str);
                    if path.is_relative() {
                        let _ = ensure_within_root(&root, path)?;
                    }
                }

                cmd = cmd.replace(&format!("{{{{{}}}}}", k), &v_str);
            }
        }

        let driver = DevcontainerDriver::new();
        let start = Instant::now();
        let exec_res = driver.exec(&root, &cmd, target.timeout_sec, &[])?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(devos_schema::ScriptContext {
            run_target_id: target_id,
            command_executed: cmd,
            inputs_used: inputs,
            exit_code: exec_res.exit_code,
            duration_ms,
            stdout_tail: exec_res.stdout,
            stderr_tail: exec_res.stderr,
            output_files_generated: vec![],
        })
    })();
    to_api_resp(res)
}

fn with_env_lock<F, R>(
    locks_state: &State<'_, ActiveEnvLocks>,
    project_root: &Path,
    f: F,
) -> Result<R>
where
    F: FnOnce() -> Result<R>,
{
    let canonical = project_root
        .canonicalize()
        .unwrap_or_else(|_| project_root.to_path_buf());
    {
        let mut locks = locks_state.0.lock().unwrap();
        if locks.contains(&canonical) {
            return Err(DevosError::Custom {
                code: "ENV_BUSY".to_string(),
                message: "An environment operation is already in progress for this project"
                    .to_string(),
                hint: Some(
                    "Please wait for the current environment operation to complete.".to_string(),
                ),
                plain_message: Some(
                    "该项目环境正在执行其他操作（启动/停止/快照），请稍候...".to_string(),
                ),
            });
        }
        locks.insert(canonical.clone());
    }

    let res = f();

    if let Ok(mut locks) = locks_state.0.lock() {
        locks.remove(&canonical);
    }

    res
}

#[tauri::command]
fn get_env_status(project_path: String, target: String) -> ApiResponse<EnvStatus> {
    let res = (|| -> Result<EnvStatus> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let driver: Box<dyn EnvDriver> = match (target.as_str(), &project.project_type) {
            ("script", _) => Box::new(DevcontainerDriver::new()),
            _ => Box::new(DdevDriver::new()),
        };
        driver.status(&root)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn start_environment(
    env_locks: State<'_, ActiveEnvLocks>,
    project_path: String,
    target: String,
) -> ApiResponse<EnvStatus> {
    let res = (|| -> Result<EnvStatus> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        with_env_lock(&env_locks, &root, || {
            let driver: Box<dyn EnvDriver> = match (target.as_str(), &project.project_type) {
                ("script", _) => Box::new(DevcontainerDriver::new()),
                _ => Box::new(DdevDriver::new()),
            };
            driver.up(&root)
        })
    })();
    to_api_resp(res)
}

#[tauri::command]
fn stop_environment(
    env_locks: State<'_, ActiveEnvLocks>,
    project_path: String,
    target: String,
) -> ApiResponse<bool> {
    let res = (|| -> Result<bool> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        Guardrails::check_destructive_allowed(&project, "down")?;
        with_env_lock(&env_locks, &root, || {
            let driver: Box<dyn EnvDriver> = match (target.as_str(), &project.project_type) {
                ("script", _) => Box::new(DevcontainerDriver::new()),
                _ => Box::new(DdevDriver::new()),
            };
            driver.down(&root)?;
            Ok(true)
        })
    })();
    to_api_resp(res)
}

#[tauri::command]
fn create_snapshot(
    env_locks: State<'_, ActiveEnvLocks>,
    project_path: String,
    name: String,
) -> ApiResponse<String> {
    let res = (|| -> Result<String> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let snap_name = if name.trim().is_empty() {
            format!("snap_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S"))
        } else {
            name.trim().to_string()
        };
        with_env_lock(&env_locks, &root, || {
            let driver: Box<dyn EnvDriver> = match project.project_type {
                ProjectType::Script => Box::new(DevcontainerDriver::new()),
                _ => Box::new(DdevDriver::new()),
            };
            driver.snapshot(&root, &snap_name)?;
            Ok(snap_name)
        })
    })();
    to_api_resp(res)
}

#[tauri::command]
fn restore_snapshot(
    env_locks: State<'_, ActiveEnvLocks>,
    project_path: String,
    name: String,
) -> ApiResponse<String> {
    let res = (|| -> Result<String> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        Guardrails::check_destructive_allowed(&project, "restore")?;
        with_env_lock(&env_locks, &root, || {
            let driver: Box<dyn EnvDriver> = match project.project_type {
                ProjectType::Script => Box::new(DevcontainerDriver::new()),
                _ => Box::new(DdevDriver::new()),
            };
            driver.restore(&root, &name)?;
            Ok(name)
        })
    })();
    to_api_resp(res)
}

#[tauri::command]
fn inspect_port_occupant(port: u16) -> ApiResponse<PortOccupant> {
    let occ = PortRegistry::inspect_port_occupant(port);
    ApiResponse::success(occ)
}

#[tauri::command]
fn reconfigure_web_ports(
    project_path: String,
    http_port: u16,
    https_port: u16,
) -> ApiResponse<String> {
    let res = (|| -> Result<String> {
        let (root, mut project) = ProjectManager::find_and_load(&project_path)?;
        let mut cfg_cmd = std::process::Command::new("ddev");
        cfg_cmd
            .args([
                "config",
                &format!("--router-http-port={}", http_port),
                &format!("--router-https-port={}", https_port),
            ])
            .current_dir(&root);
        devos_core::inject_proxy_bypass_env(&mut cfg_cmd);
        let _ = cfg_cmd.output();

        // Update devos.json primary_url
        if let Some(ref mut web) = project.environments.web {
            let scheme = if https_port == 443 { "https" } else { "http" };
            let port_str = if http_port == 80 && scheme == "http" {
                "".to_string()
            } else if https_port == 443 && scheme == "https" {
                "".to_string()
            } else if scheme == "https" {
                format!(":{}", https_port)
            } else {
                format!(":{}", http_port)
            };
            web.primary_url = format!("{}://{}.ddev.site{}", scheme, project.slug, port_str);
            devos_core::atomic_write_json(root.join("devos.json"), &project)?;
        }

        Ok(format!(
            "端口已切换并更新至 HTTP: {}, HTTPS: {}",
            http_port, https_port
        ))
    })();
    to_api_resp(res)
}

#[tauri::command]
fn detect_installed_agents(project_path: Option<String>) -> ApiResponse<Vec<AgentDetection>> {
    let root_path = project_path.as_deref().map(Path::new);
    let list = AgentConfigManager::detect_agents(root_path);
    ApiResponse::success(list)
}

#[tauri::command]
fn apply_agent_config(agent_id: String, project_path: Option<String>) -> ApiResponse<String> {
    let root_path = project_path.as_deref().map(Path::new);
    let res = AgentConfigManager::configure_agent(&agent_id, None, root_path);
    to_api_resp(res)
}

#[tauri::command]
fn uninstall_agent_config(agent_id: String, project_path: Option<String>) -> ApiResponse<String> {
    let root_path = project_path.as_deref().map(Path::new);
    let res = AgentConfigManager::uninstall_agent_config(&agent_id, root_path);
    to_api_resp(res)
}

#[tauri::command]
fn get_manual_config_snippet(agent_id: String) -> ApiResponse<String> {
    let snippet = AgentConfigManager::get_manual_config_snippet(&agent_id, None);
    ApiResponse::success(snippet)
}

#[tauri::command]
fn verify_agent_connection(agent_id: String, project_path: Option<String>) -> ApiResponse<bool> {
    let root_path = project_path.as_deref().map(Path::new);
    let cfg_path = AgentConfigManager::resolve_config_path(&agent_id, root_path);
    let meta = AgentConfigManager::supported_adapters()
        .iter()
        .find(|a| a.id == agent_id);
    if let Some(m) = meta {
        let is_ok = AgentConfigManager::is_mcp_configured(&cfg_path, m.format);
        ApiResponse::success(is_ok)
    } else {
        ApiResponse::success(false)
    }
}

#[tauri::command]
fn get_mirrors_config() -> ApiResponse<devos_core::MirrorsConfig> {
    let cfg = devos_core::MirrorManager::load_config();
    ApiResponse::success(cfg)
}

#[tauri::command]
fn save_mirrors_config(config: devos_core::MirrorsConfig) -> ApiResponse<bool> {
    let res = devos_core::MirrorManager::save_config(&config).map(|_| true);
    to_api_resp(res)
}

#[tauri::command]
async fn race_mirrors_speed(candidates: Vec<String>) -> ApiResponse<devos_core::MirrorRaceResult> {
    let res = devos_core::MirrorManager::race_mirrors(&candidates).await;
    ApiResponse::success(res)
}

#[tauri::command]
fn import_local_tool_package(tool_name: String, source_path: String) -> ApiResponse<String> {
    let res = devos_core::MirrorManager::import_local_archive(&tool_name, &source_path)
        .map(|p| p.display().to_string());
    to_api_resp(res)
}

#[tauri::command]
fn export_diagnostic_bundle(project_path: Option<String>) -> ApiResponse<String> {
    let p_root = project_path.as_deref().map(Path::new);
    let res = devos_core::export_diagnostic_bundle(p_root).map(|p| p.display().to_string());
    to_api_resp(res)
}

#[tauri::command]
fn get_logs(filter: Option<LogFilter>) -> ApiResponse<Vec<LogEntry>> {
    let f = filter.unwrap_or_default();
    let entries = devos_core::get_logs(&f);
    ApiResponse::success(entries)
}

#[tauri::command]
fn clear_logs() -> ApiResponse<bool> {
    devos_core::clear_logs();
    ApiResponse::success(true)
}

#[tauri::command]
fn append_log(
    level: String,
    source: String,
    message: String,
    project_slug: Option<String>,
) -> ApiResponse<bool> {
    let lvl = level.parse::<LogLevel>().unwrap_or(LogLevel::Info);
    let src = source.parse::<LogSource>().unwrap_or(LogSource::Core);
    devos_core::log_entry(lvl, src, message, None, project_slug);
    ApiResponse::success(true)
}

#[tauri::command]
fn get_container_logs(project_path: String, tail: Option<usize>) -> ApiResponse<Vec<String>> {
    let res = (|| -> Result<Vec<String>> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        let t = tail.unwrap_or(100);
        let mut logs = match project.project_type {
            ProjectType::Web => DdevDriver::new().logs(&root, t)?,
            ProjectType::Script => DevcontainerDriver::new().logs(&root, t)?,
            ProjectType::Hybrid => {
                let mut web_logs = DdevDriver::new().logs(&root, t).unwrap_or_default();
                let mut script_logs = DevcontainerDriver::new().logs(&root, t).unwrap_or_default();
                web_logs.append(&mut script_logs);
                web_logs
            }
        };
        if logs.is_empty() {
            let entries = devos_core::get_logs(&LogFilter {
                min_level: None,
                source: Some(LogSource::Env),
                query: None,
                limit: Some(t),
            });
            logs = entries.into_iter().map(|e| e.message).collect();
        }
        Ok(logs)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn export_release_bundle(
    project_path: String,
    version: String,
    panel_friendly: bool,
) -> ApiResponse<ReleaseBuildResult> {
    let res = (|| -> Result<ReleaseBuildResult> {
        let (root, project) = ProjectManager::find_and_load(&project_path)?;
        ReleaseManager::prepare_release_artifacts(&root, &project, &version, panel_friendly)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn list_vcs_checkpoints(project_path: String) -> ApiResponse<Vec<Checkpoint>> {
    let res = (|| -> Result<Vec<Checkpoint>> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        CheckpointManager::list_checkpoints(&root)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn create_vcs_checkpoint(
    project_path: String,
    note: String,
    source: String,
) -> ApiResponse<Checkpoint> {
    let res = (|| -> Result<Checkpoint> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        let src = if source.trim().is_empty() {
            "user_manual"
        } else {
            &source
        };
        CheckpointManager::create_checkpoint(&root, &note, src)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn restore_vcs_checkpoint(project_path: String, checkpoint_id: String) -> ApiResponse<bool> {
    let res = (|| -> Result<bool> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        CheckpointManager::restore_checkpoint(&root, &checkpoint_id).map(|_| true)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn get_storage_report(project_path: String) -> ApiResponse<StorageReport> {
    let res = (|| -> Result<StorageReport> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        Ok(StorageCleaner::calculate_storage_usage(&root))
    })();
    to_api_resp(res)
}

#[tauri::command]
fn clean_storage(
    project_path: String,
    older_than_days: u64,
    prune_docker: bool,
) -> ApiResponse<u64> {
    let res = (|| -> Result<u64> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        let freed = StorageCleaner::clean_expired_artifacts(&root, older_than_days)?;
        if prune_docker {
            let _ = StorageCleaner::prune_managed_docker_cache();
        }
        Ok(freed)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn trash_project(project_path: String) -> ApiResponse<String> {
    let res = (|| -> Result<String> {
        let db = Database::open_global().ok();
        let dest = ProjectManager::trash_project(&project_path, db.as_ref())?;
        Ok(dest.display().to_string())
    })();
    to_api_resp(res)
}

#[tauri::command]
fn open_in_finder(path: String) -> ApiResponse<bool> {
    let res = (|| -> Result<bool> {
        let p = Path::new(&path);
        let target = if p.exists() { p } else { Path::new(".") };
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(target).spawn();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer").arg(target).spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(target).spawn();
        }
        Ok(true)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn open_in_terminal(path: String) -> ApiResponse<bool> {
    let res = (|| -> Result<bool> {
        let p = Path::new(&path);
        let target = if p.exists() { p } else { Path::new(".") };
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .args(["-a", "Terminal"])
                .arg(target)
                .spawn();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("cmd")
                .args(["/c", "start", "cmd"])
                .current_dir(target)
                .spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("x-terminal-emulator")
                .current_dir(target)
                .spawn();
        }
        Ok(true)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn open_in_editor(path: String, editor: Option<String>) -> ApiResponse<bool> {
    let res = (|| -> Result<bool> {
        let p = Path::new(&path);
        let target = if p.exists() { p } else { Path::new(".") };
        let chosen = editor.unwrap_or_else(|| "auto".to_string());
        let mut launched = false;
        if chosen == "cursor" || chosen == "auto" {
            if let Ok(_) = std::process::Command::new("cursor").arg(target).spawn() {
                launched = true;
            }
        }
        if !launched && (chosen == "code" || chosen == "auto") {
            if let Ok(_) = std::process::Command::new("code").arg(target).spawn() {
                launched = true;
            }
        }
        if !launched {
            #[cfg(target_os = "macos")]
            {
                let _ = std::process::Command::new("open").arg(target).spawn();
            }
        }
        Ok(true)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn list_deploy_plugins() -> ApiResponse<Vec<devos_core::DeployPluginMetadata>> {
    ApiResponse::success(devos_core::DeployPluginManager::list_plugins())
}

#[tauri::command]
fn validate_deploy_target(
    plugin_id: String,
    host: String,
    port: u16,
    user: String,
) -> ApiResponse<devos_core::ValidationResult> {
    let mut cfg = std::collections::HashMap::new();
    cfg.insert("host".to_string(), host);
    cfg.insert("port".to_string(), port.to_string());
    cfg.insert("user".to_string(), user);
    let res = devos_core::DeployPluginManager::validate_target(&plugin_id, &cfg);
    to_api_resp(res)
}

#[tauri::command]
fn plan_deployment(
    plugin_id: String,
    project_path: String,
    host: String,
    deploy_dir: String,
) -> ApiResponse<devos_core::DeployPlan> {
    let res = (|| -> Result<devos_core::DeployPlan> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        let release_dir = root.join("releases");
        let mut cfg = std::collections::HashMap::new();
        cfg.insert("host".to_string(), host);
        cfg.insert("deploy_dir".to_string(), deploy_dir);
        devos_core::DeployPluginManager::plan_deployment(&plugin_id, &release_dir, &cfg)
    })();
    to_api_resp(res)
}

#[tauri::command]
fn apply_deployment(
    plugin_id: String,
    project_path: String,
    host: String,
    deploy_dir: String,
) -> ApiResponse<devos_core::DeployResult> {
    let res = (|| -> Result<devos_core::DeployResult> {
        let (root, _) = ProjectManager::find_and_load(&project_path)?;
        let release_dir = root.join("releases");
        let mut cfg = std::collections::HashMap::new();
        cfg.insert("host".to_string(), host);
        cfg.insert("deploy_dir".to_string(), deploy_dir);
        devos_core::DeployPluginManager::apply_deployment(
            &plugin_id,
            &release_dir,
            &cfg,
            |_progress| {},
        )
    })();
    to_api_resp(res)
}

#[tauri::command]
fn rollback_deployment(
    plugin_id: String,
    host: String,
    version: String,
) -> ApiResponse<devos_core::DeployResult> {
    let mut cfg = std::collections::HashMap::new();
    cfg.insert("host".to_string(), host);
    let res = devos_core::DeployPluginManager::rollback_deployment(&plugin_id, &version, &cfg);
    to_api_resp(res)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .manage(ActiveWatcherState(Mutex::new(None)))
        .manage(ActiveEnvLocks(Mutex::new(HashSet::new())))
        .invoke_handler(tauri::generate_handler![
            run_preflight_doctor,
            auto_fix_environment,
            get_recent_projects,
            init_project,
            load_project,
            list_board_cards,
            move_board_card,
            create_board_card,
            list_issues,
            create_web_issue,
            create_script_issue,
            retest_issue,
            get_run_manifest,
            execute_script_target,
            get_env_status,
            start_environment,
            stop_environment,
            create_snapshot,
            restore_snapshot,
            detect_installed_agents,
            apply_agent_config,
            uninstall_agent_config,
            get_manual_config_snippet,
            verify_agent_connection,
            inspect_port_occupant,
            reconfigure_web_ports,
            get_mirrors_config,
            save_mirrors_config,
            race_mirrors_speed,
            import_local_tool_package,
            export_diagnostic_bundle,
            get_logs,
            clear_logs,
            append_log,
            get_container_logs,
            export_release_bundle,
            list_vcs_checkpoints,
            create_vcs_checkpoint,
            restore_vcs_checkpoint,
            get_storage_report,
            clean_storage,
            trash_project,
            open_in_finder,
            open_in_terminal,
            open_in_editor,
            list_deploy_plugins,
            validate_deploy_target,
            plan_deployment,
            apply_deployment,
            rollback_deployment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
