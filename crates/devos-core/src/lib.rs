pub mod agent_config;
pub mod board;
pub mod checkpoint;
pub mod command_bus;
pub mod daemon;
pub mod db;
pub mod deploy_plugin;
pub mod error;
pub mod fs_utils;
pub mod guardrail;
pub mod issue;
pub mod logging;
pub mod mirror;
pub mod port;
pub mod process_env;
pub mod project;
pub mod release;
pub mod storage_cleaner;
pub mod watcher;

pub use agent_config::{AgentConfigManager, AgentDetection};
pub use board::BoardManager;
pub use checkpoint::{Checkpoint, CheckpointManager};
pub use command_bus::CommandBus;
pub use daemon::DaemonManager;
pub use db::{ActivityEvent, Database};
pub use deploy_plugin::{
    DeployPlan, DeployPluginManager, DeployPluginMetadata, DeployProgressEvent, DeployResult,
    ValidationResult,
};
pub use error::{DevosError, Result};
pub use fs_utils::{
    atomic_write, atomic_write_json, ensure_within_root, read_json, read_to_string, to_posix_path,
};
pub use guardrail::Guardrails;
pub use issue::IssueManager;
pub use logging::{
    export_diagnostic_bundle, get_runtime_logs, log_runtime_line, sanitize_text, DiagnosticBundle,
};
pub use mirror::{DownloadProgress, MirrorManager, MirrorPreset, MirrorRaceResult, MirrorsConfig};
pub use port::{PortAllocation, PortOccupant, PortRegistry};
pub use process_env::{
    configure_child_process_group, diagnose_proxy_env, get_devos_bin_dir, inject_proxy_bypass_env,
    kill_process_tree, ProxyDiagnosticInfo, DEFAULT_NO_PROXY,
};
pub use project::{ProjectManager, DEVOS_MANAGED_LABEL};
pub use release::{
    PreflightGateResult, ReleaseBuildResult, ReleaseHealthCheck, ReleaseManager, ReleaseManifest,
};
pub use storage_cleaner::{StorageCleaner, StorageReport};
pub use watcher::{ProjectChangeEvent, ProjectWatcher};

#[cfg(test)]
mod tests {
    use super::*;
    use devos_schema::{BoardColumn, ProjectType};
    use tempfile::tempdir;

    #[test]
    fn test_project_init_and_board_lifecycle() {
        let dir = tempdir().unwrap();
        let project_dir = dir.path().join("my-project");
        let db = Database::open(":memory:").unwrap();

        // 1. Init project
        let project = ProjectManager::init_project(
            &project_dir,
            "my-project",
            "My Project",
            "Description of project",
            ProjectType::Hybrid,
            Some(&db),
        )
        .unwrap();

        assert_eq!(project.slug, "my-project");
        assert!(project_dir.join("devos.json").exists());
        assert!(project_dir.join("AGENTS.md").exists());
        assert!(project_dir.join("devos.run.json").exists());

        // 2. Upsert board card
        let card = BoardManager::upsert_card(
            &project_dir,
            &project,
            None,
            Some("实现数据导出功能".to_string()),
            BoardColumn::Todo,
            "user",
            None,
            None,
        )
        .unwrap();
        assert_eq!(card.card_id, "CARD-001");

        // 3. Agent cannot move to Done directly
        let err = BoardManager::upsert_card(
            &project_dir,
            &project,
            Some("CARD-001".to_string()),
            None,
            BoardColumn::Done,
            "agent",
            None,
            None,
        );
        assert!(err.is_err());

        // 4. Submit for testing
        let submitted = BoardManager::submit_for_testing(
            &project_dir,
            &project,
            "CARD-001",
            "数据导出模块已完成，提供 3 条验收测试",
            vec![devos_schema::ChecklistStep {
                step: 1,
                action: "运行脚本".to_string(),
                expected: "生成 xlsx 文件".to_string(),
                checked: false,
            }],
            vec!["export_task".to_string()],
        )
        .unwrap();
        assert_eq!(submitted.column, BoardColumn::Testing);

        // 5. Create issue
        let issue = IssueManager::create_issue(
            &project_dir,
            &project,
            "导出文件字段缺失",
            "测试时发现导出的 Excel 缺少金额列",
            Some("应包含金额列".to_string()),
            devos_schema::IssueSeverity::High,
            devos_schema::SourceType::ScriptRun,
            devos_schema::CapturedContext::default(),
            Some("CARD-001".to_string()),
            Some(1),
        )
        .unwrap();
        assert_eq!(issue.issue_id, "ISS-001");

        // 6. Resolve issue
        let resolved = IssueManager::resolve_issue(
            &project_dir,
            &project,
            "ISS-001",
            "已在 scripts/export.py 中补充 amount 字段映射",
            vec!["scripts/export.py".to_string()],
            Some((
                "Excel 导出字段映射规范".to_string(),
                "导出字段必须全量包含 schema 字段。".to_string(),
            )),
        )
        .unwrap();
        assert_eq!(resolved.status, devos_schema::IssueStatus::ReadyForRetest);
        assert!(project_dir.join("knowledge/KB-ISS-001.md").exists());

        // 7. Test Claim Lock (Phase 8)
        let claim_res = IssueManager::claim_issue(
            &project_dir,
            &project,
            "ISS-001",
            "Claude Code",
            "sess_12345",
        )
        .unwrap();
        assert_eq!(
            claim_res.claimed_by.as_ref().unwrap().agent_name,
            "Claude Code"
        );

        // Concurrent claim by another session should be rejected
        let conflict_claim = IssueManager::claim_issue(
            &project_dir,
            &project,
            "ISS-001",
            "Factory Droid",
            "sess_99999",
        );
        assert!(conflict_claim.is_err());

        // 8. Test Checkpoint Manager (Phase 8/10)
        let cp = CheckpointManager::create_checkpoint(
            &project_dir,
            "Initial setup checkpoint",
            "user_manual",
        )
        .unwrap();
        assert!(cp.id.starts_with("cp_"));

        let checkpoints = CheckpointManager::list_checkpoints(&project_dir).unwrap();
        assert_eq!(checkpoints.len(), 1);
        assert_eq!(checkpoints[0].note, "Initial setup checkpoint");

        // 9. Test Release Manager (Phase 9)
        let release_res =
            ReleaseManager::prepare_release_artifacts(&project_dir, &project, "1.0.0", true)
                .unwrap();
        assert_eq!(release_res.version, "v1.0.0");
        assert!(project_dir
            .join("releases/v1.0.0/release-manifest.json")
            .exists());
        assert!(project_dir.join("releases/v1.0.0/DEPLOY.md").exists());
        assert!(project_dir
            .join("releases/v1.0.0/deploy/docker-compose.prod.yml")
            .exists());

        // 10. Test Deploy Plugin Manager (Phase 9)
        let plugins = DeployPluginManager::list_plugins();
        assert!(!plugins.is_empty());
        assert_eq!(plugins[0].id, "vps-docker");

        let mut config = std::collections::HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "22".to_string());
        let val = DeployPluginManager::validate_target("vps-docker", &config).unwrap();
        assert!(val.connected);

        // 11. Test Path Validator & Demo Project (Phase 10)
        let warnings = ProjectManager::validate_project_workspace_path(std::path::Path::new(
            "C:\\Users\\张三\\OneDrive\\我的项目",
        ));
        assert!(!warnings.is_empty());
        assert!(warnings.iter().any(|w| w.contains("OneDrive")));
        assert!(warnings.iter().any(|w| w.contains("中文")));

        let demo_dir = dir.path().join("demo-app");
        let demo_proj = ProjectManager::init_demo_project(&demo_dir, Some(&db)).unwrap();
        assert_eq!(demo_proj.slug, "demo-quickstart");
        assert!(demo_dir.join("devos.json.bak").exists());

        // 12. Test Storage Cleaner (Phase 10)
        let storage = StorageCleaner::calculate_storage_usage(&project_dir);
        assert_eq!(storage.low_disk_warning, false);

        // 13. Test Daemon Request Security (CSRF / DNS Rebinding) (Phase 10)
        let csrf_err = DaemonManager::validate_request_security(
            Some("127.0.0.1:18080"),
            Some("http://malicious-site.com"),
            Some("Bearer my_token"),
            "my_token",
        );
        assert!(csrf_err.is_err());

        let dns_err = DaemonManager::validate_request_security(
            Some("attacker.com:18080"),
            None,
            Some("Bearer my_token"),
            "my_token",
        );
        assert!(dns_err.is_err());

        let valid_req = DaemonManager::validate_request_security(
            Some("127.0.0.1:18080"),
            Some("http://127.0.0.1:18080"),
            Some("Bearer my_token"),
            "my_token",
        );
        assert!(valid_req.is_ok());
    }
}
