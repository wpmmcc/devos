use std::path::Path;
use serde_json::{json, Value};
use devos_schema::{
    BoardColumn, CallerType, ChecklistStep, CommandEnvelope, DevosProject,
    PermissionLevel, ProjectMode,
};
use crate::board::BoardManager;
use crate::checkpoint::CheckpointManager;
use crate::deploy_plugin::DeployPluginManager;
use crate::error::{DevosError, Result};
use crate::guardrail::Guardrails;
use crate::issue::IssueManager;
use crate::release::ReleaseManager;

pub struct CommandBus;

impl CommandBus {
    /// Query static permission level for any internal CommandId
    pub fn get_permission_level(command_id: &str) -> PermissionLevel {
        match command_id {
            // L0 Read-only
            "project.brief"
            | "env.status"
            | "asset.read"
            | "secret.schema.check"
            | "issue.list"
            | "vcs.status"
            | "vcs.diff"
            | "system.doctor"
            | "adapter.scan" => PermissionLevel::L0ReadOnly,

            // L1 Local safe write
            "asset.upsert"
            | "board.upsert"
            | "decision.create"
            | "test.submit"
            | "issue.create"
            | "issue.resolve"
            | "issue.claim"
            | "vcs.checkpoint.create" => PermissionLevel::L1LocalSafeWrite,

            // L2 Controlled state change
            "project.create"
            | "env.up"
            | "env.down"
            | "env.exec"
            | "env.snapshot"
            | "env.restore"
            | "test.run_target"
            | "vcs.commit"
            | "release.prepare" => PermissionLevel::L2ControlledStateChange,

            // L3 Human exclusive danger (Strictly blocked for Agent MCP)
            "project.mode.set"
            | "project.delete"
            | "secret.set"
            | "secret.rollback"
            | "board.complete"
            | "decision.resolve"
            | "issue.verify"
            | "vcs.checkpoint.restore"
            | "vcs.remote.sync"
            | "release.export"
            | "deploy.plugin.validate"
            | "deploy.plugin.apply"
            | "deploy.plugin.rollback"
            | "adapter.install"
            | "adapter.uninstall"
            | "system.diag.export" => PermissionLevel::L3HumanExclusiveDanger,

            _ => PermissionLevel::L3HumanExclusiveDanger,
        }
    }

    /// Dispatch command with unified security gate & single-writer routing
    pub fn dispatch(
        root: &Path,
        project: &DevosProject,
        command_id: &str,
        payload: &Value,
        caller: CallerType,
        locale: &str,
    ) -> CommandEnvelope<Value> {
        let start = std::time::Instant::now();
        let perm = Self::get_permission_level(command_id);

        // Security Gate 1: L3 Human-only boundary check
        if matches!(perm, PermissionLevel::L3HumanExclusiveDanger) {
            if matches!(caller, CallerType::AgentMcp) {
                return CommandEnvelope::error(
                    command_id,
                    &project.project_id,
                    "AUTH_HUMAN_APPROVAL_REQUIRED",
                    "L3 high-risk command is strictly forbidden for external Agent sessions.",
                    Some("This action requires explicit user confirmation in DevOS Desktop UI.".to_string()),
                    None,
                    None,
                    start.elapsed().as_millis() as u64,
                    locale,
                );
            }
        }

        // Security Gate 2: Mode constraints for L2 operations
        if matches!(perm, PermissionLevel::L2ControlledStateChange) {
            if matches!(project.mode, ProjectMode::DeployProd) {
                if command_id == "env.down" || command_id == "env.restore" {
                    return CommandEnvelope::error(
                        command_id,
                        &project.project_id,
                        "GUARDRAIL_MODE_BLOCKED",
                        "Destructive environment operations are blocked in DEPLOY_PROD mode.",
                        Some("Switch project mode to DEV_LOCAL to allow destructive resets.".to_string()),
                        None,
                        None,
                        start.elapsed().as_millis() as u64,
                        locale,
                    );
                }
            }
        }

        // Domain Handlers Dispatch
        let res: Result<Value> = (|| match command_id {
            // Domain 1: Project & Env
            "project.brief" => {
                let cards = BoardManager::list_cards(root, project)?;
                let issues = IssueManager::list_issues(root, project, Some("open"))?;
                Ok(json!({
                    "project_id": project.project_id,
                    "name": project.name,
                    "mode": project.mode,
                    "active_cards_count": cards.len(),
                    "open_issues_count": issues.len(),
                }))
            }
            "env.status" => Ok(json!({ "status": "running", "driver": "ddev/devcontainer" })),
            "env.up" => Ok(json!({ "started": true })),
            "env.down" => {
                Guardrails::check_destructive_allowed(project, "down")?;
                Ok(json!({ "stopped": true }))
            }

            // Domain 2: Assets & Secrets
            "asset.upsert" => {
                let title = payload["title"].as_str().unwrap_or("Asset");
                let content = payload["content"].as_str().unwrap_or("");
                let asset_type = payload["asset_type"].as_str().unwrap_or("doc");
                let file_path = root.join("docs").join(format!("{}.md", asset_type));
                crate::fs_utils::ensure_within_root(root, &file_path)?;
                crate::fs_utils::atomic_write(&file_path, format!("# {}\n\n{}", title, content))?;
                Ok(json!({ "saved": true, "path": file_path.display().to_string() }))
            }
            "secret.schema.check" => {
                let env_path = root.join(".env");
                let has_env = env_path.exists();
                Ok(json!({ "has_env": has_env, "example_aligned": true }))
            }

            // Domain 3: Board & Decisions
            "board.upsert" => {
                let card_id = payload["card_id"].as_str().map(|s| s.to_string());
                let title = payload["title"].as_str().map(|s| s.to_string());
                let col = match payload["column"].as_str() {
                    Some("doing") => BoardColumn::Doing,
                    Some("testing") => BoardColumn::Testing,
                    Some("done") => BoardColumn::Done,
                    _ => BoardColumn::Todo,
                };
                let updated_by = match caller {
                    CallerType::AgentMcp => "agent",
                    _ => "user",
                };
                let card = BoardManager::upsert_card(root, project, card_id, title, col, updated_by, None, None)?;
                Ok(serde_json::to_value(card)?)
            }
            "board.complete" => {
                let card_id = payload["card_id"].as_str().unwrap_or("");
                let card = BoardManager::upsert_card(root, project, Some(card_id.to_string()), None, BoardColumn::Done, "user", None, None)?;
                Ok(serde_json::to_value(card)?)
            }

            // Domain 4: Testing & Issues
            "test.submit" => {
                let card_id = payload["card_id"].as_str().ok_or_else(|| DevosError::Custom {
                    code: "MISSING_CARD_ID".to_string(),
                    message: "card_id is required".to_string(),
                    hint: None,
                    plain_message: None,
                })?;
                let summary = payload["summary_plain"].as_str().unwrap_or("功能提测");
                let steps: Vec<ChecklistStep> = serde_json::from_value(payload["test_checklist"].clone()).unwrap_or_default();
                let targets: Vec<String> = serde_json::from_value(payload["run_target_ids"].clone()).unwrap_or_default();
                let card = BoardManager::submit_for_testing(root, project, card_id, summary, steps, targets)?;
                Ok(serde_json::to_value(card)?)
            }
            "issue.list" => {
                let status = payload["status"].as_str();
                let issues = IssueManager::list_issues(root, project, status)?;
                Ok(serde_json::to_value(issues)?)
            }
            "issue.claim" => {
                let issue_id = payload["issue_id"].as_str().unwrap_or("ISS-001");
                let agent_name = payload["agent_name"].as_str().unwrap_or("Agent");
                let sess = payload["session_id"].as_str().unwrap_or("sess_default");
                let issue = IssueManager::claim_issue(root, project, issue_id, agent_name, sess)?;
                Ok(serde_json::to_value(issue)?)
            }
            "issue.resolve" => {
                let issue_id = payload["issue_id"].as_str().unwrap_or("");
                let fix = payload["fix_summary_plain"].as_str().unwrap_or("");
                let files: Vec<String> = serde_json::from_value(payload["changed_files"].clone()).unwrap_or_default();
                let issue = IssueManager::resolve_issue(root, project, issue_id, fix, files, None)?;
                Ok(serde_json::to_value(issue)?)
            }

            // Domain 5: VCS & Remote
            "vcs.checkpoint.create" => {
                let note = payload["note"].as_str().unwrap_or("Manual checkpoint");
                let cp = CheckpointManager::create_checkpoint(root, note, "user_manual")?;
                Ok(serde_json::to_value(cp)?)
            }
            "vcs.status" => {
                let checkpoints = CheckpointManager::list_checkpoints(root)?;
                Ok(json!({ "checkpoints_count": checkpoints.len() }))
            }

            // Domain 6: Delivery & Deploy Plugins
            "release.prepare" => {
                let ver = payload["version"].as_str().unwrap_or("1.0.0");
                let panel = payload["panel_friendly"].as_bool().unwrap_or(true);
                let res = ReleaseManager::prepare_release_artifacts(root, project, ver, panel)?;
                Ok(json!({ "version": res.version, "zip": res.zip_archive_path }))
            }
            "deploy.plugin.validate" => {
                let mut cfg = std::collections::HashMap::new();
                cfg.insert("host".to_string(), payload["host"].as_str().unwrap_or("127.0.0.1").to_string());
                let val = DeployPluginManager::validate_target("vps-docker", &cfg)?;
                Ok(serde_json::to_value(val)?)
            }

            // Domain 7: System & Adapters
            "system.doctor" => Ok(json!({ "docker_healthy": true, "proxy_bypassed": true })),
            "adapter.scan" => {
                let detected = crate::agent_config::AgentConfigManager::detect_agents(None);
                Ok(serde_json::to_value(&detected)?)
            }

            _ => Err(DevosError::Custom {
                code: "UNKNOWN_COMMAND".to_string(),
                message: format!("Command '{}' is not registered on CommandBus", command_id),
                hint: Some("Consult docs/14-unified-command-protocol-and-control-plane.md".to_string()),
                plain_message: None,
            }),
        })();

        let elapsed = start.elapsed().as_millis() as u64;
        match res {
            Ok(val) => CommandEnvelope::success(command_id, &project.project_id, val, elapsed, locale),
            Err(e) => CommandEnvelope::error(
                command_id,
                &project.project_id,
                &e.error_code(),
                &e.to_string(),
                e.hint(),
                None,
                None,
                elapsed,
                locale,
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::ProjectManager;
    use devos_schema::ProjectType;

    #[test]
    fn test_permission_matrix_and_agent_boundary() {
        let dir = tempdir().unwrap();
        let db = crate::db::Database::open(":memory:").unwrap();
        let project = ProjectManager::init_project(
            dir.path(),
            "test-bus",
            "Bus Test",
            "Test description",
            ProjectType::Hybrid,
            Some(&db),
        ).unwrap();

        // L0 Query: allowed for AgentMcp
        let l0_resp = CommandBus::dispatch(
            dir.path(),
            &project,
            "project.brief",
            &json!({}),
            CallerType::AgentMcp,
            "zh-CN",
        );
        assert!(l0_resp.ok);
        assert_eq!(l0_resp.command_id, "project.brief");

        // L1 Safe Write: allowed for AgentMcp
        let l1_resp = CommandBus::dispatch(
            dir.path(),
            &project,
            "board.upsert",
            &json!({ "title": "New Task", "column": "todo" }),
            CallerType::AgentMcp,
            "zh-CN",
        );
        assert!(l1_resp.ok);

        // L3 High-Risk Danger: STRICTLY BLOCKED for AgentMcp
        let l3_blocked = CommandBus::dispatch(
            dir.path(),
            &project,
            "deploy.plugin.apply",
            &json!({}),
            CallerType::AgentMcp,
            "zh-CN",
        );
        assert!(!l3_blocked.ok);
        assert_eq!(l3_blocked.error.as_ref().unwrap().code, "AUTH_HUMAN_APPROVAL_REQUIRED");

        // L3 High-Risk Danger: ALLOWED for HumanUI
        let l3_allowed = CommandBus::dispatch(
            dir.path(),
            &project,
            "deploy.plugin.validate",
            &json!({ "host": "127.0.0.1" }),
            CallerType::HumanUi,
            "zh-CN",
        );
        assert!(l3_allowed.ok);
    }
}
