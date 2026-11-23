use devos_core::{
    ensure_within_root, fs_utils::read_json, AgentConfigManager, BoardManager, Database, DevosError,
    Guardrails, IssueManager, PortOccupant, PortRegistry, ProjectChangeEvent, ProjectManager,
    ProjectWatcher, Result,
};
use devos_env::{
    DdevDriver, DevcontainerDriver, DiagnosticItem, EnvDriver, EnvStatus, PreflightDoctor,
};
use devos_schema::{
    AgentDetection, ApiResponse, BoardCard, BoardColumn, DevosProject, Issue, IssueSeverity,
    ProjectType, RunManifest, SourceType,
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
        let list = db.list_recent_projects()?;
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
        let mut context = devos_schema::CapturedContext::default();
        context.web = Some(devos_schema::WebContext {
            url,
            viewport: "1440x900".to_string(),
            screenshot_path,
            annotated_region: None,
            console_errors,
            failed_requests,
            backend_logs_tail: vec![],
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

fn with_env_lock<F, R>(locks_state: &State<'_, ActiveEnvLocks>, project_root: &Path, f: F) -> Result<R>
where
    F: FnOnce() -> Result<R>,
{
    let canonical = project_root.canonicalize().unwrap_or_else(|_| project_root.to_path_buf());
    {
        let mut locks = locks_state.0.lock().unwrap();
        if locks.contains(&canonical) {
            return Err(DevosError::Custom {
                code: "ENV_BUSY".to_string(),
                message: "An environment operation is already in progress for this project".to_string(),
                hint: Some("Please wait for the current environment operation to complete.".to_string()),
                plain_message: Some("该项目环境正在执行其他操作（启动/停止/快照），请稍候...".to_string()),
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

        Ok(format!("端口已切换并更新至 HTTP: {}, HTTPS: {}", http_port, https_port))
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
    let res = devos_core::export_diagnostic_bundle(p_root)
        .map(|p| p.display().to_string());
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
            export_diagnostic_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
