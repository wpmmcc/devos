use std::path::Path;
use devos_schema::{
    CapturedContext, DevosProject, Issue, IssueClaim, IssueResolution, IssueSeverity, IssueStatus,
    RetestRecord, SourceType, UserReport,
};
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write, atomic_write_json, read_json};

pub struct IssueManager;

impl IssueManager {
    /// List all issues in the project, optionally filtering by status
    pub fn list_issues(
        root: &Path,
        project: &DevosProject,
        filter_status: Option<&str>,
    ) -> Result<Vec<Issue>> {
        let issues_dir = root.join(&project.workspace_paths.issues);
        let mut issues = Vec::new();
        if !issues_dir.exists() {
            return Ok(issues);
        }

        for entry in std::fs::read_dir(issues_dir)?.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(issue) = read_json::<_, Issue>(&path) {
                    let matches_filter = match filter_status {
                        None | Some("all") => true,
                        Some("open") => matches!(issue.status, IssueStatus::Open),
                        Some("in_progress") => matches!(issue.status, IssueStatus::InProgress),
                        Some("ready_for_retest") => matches!(issue.status, IssueStatus::ReadyForRetest),
                        Some("closed") => matches!(issue.status, IssueStatus::Closed),
                        Some("reopened") => matches!(issue.status, IssueStatus::Reopened),
                        _ => true,
                    };

                    if matches_filter {
                        issues.push(issue);
                    }
                }
            }
        }

        // Sort descending by created_at / issue_id
        issues.sort_by(|a, b| b.issue_id.cmp(&a.issue_id));
        Ok(issues)
    }

    /// Read a specific issue
    pub fn get_issue(root: &Path, project: &DevosProject, issue_id: &str) -> Result<Issue> {
        let path = root
            .join(&project.workspace_paths.issues)
            .join(format!("{}.json", issue_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "ISSUE_NOT_FOUND".to_string(),
                message: format!("Issue {} not found", issue_id),
                hint: Some("Check the issue ID in the issues panel.".to_string()),
                plain_message: Some(format!("未找到编号为 {} 的反馈记录", issue_id)),
            });
        }
        read_json(&path)
    }

    /// Create a new issue (either from web preview, script run, or manual)
    pub fn create_issue(
        root: &Path,
        project: &DevosProject,
        title: &str,
        description: &str,
        expected_behavior: Option<String>,
        severity: IssueSeverity,
        source_type: SourceType,
        context: CapturedContext,
        linked_card_id: Option<String>,
        linked_checklist_step: Option<u32>,
    ) -> Result<Issue> {
        let issues_dir = root.join(&project.workspace_paths.issues);
        std::fs::create_dir_all(&issues_dir)?;

        let all = Self::list_issues(root, project, Some("all"))?;
        let next_idx = all.len() + 1;
        let issue_id = format!("ISS-{:03}", next_idx);

        let user_report = UserReport {
            title: title.to_string(),
            description: description.to_string(),
            expected_behavior,
        };

        let mut issue = Issue::new(
            issue_id.clone(),
            severity,
            source_type,
            user_report,
            context,
        );
        issue.linked_card_id = linked_card_id;
        issue.linked_checklist_step = linked_checklist_step;

        let path = issues_dir.join(format!("{}.json", issue_id));
        atomic_write_json(&path, &issue)?;
        Ok(issue)
    }

    /// Claim an issue for exclusive work by an Agent session
    pub fn claim_issue(
        root: &Path,
        project: &DevosProject,
        issue_id: &str,
        agent_name: &str,
        session_id: &str,
    ) -> Result<Issue> {
        let issues_dir = root.join(&project.workspace_paths.issues);
        let path = issues_dir.join(format!("{}.json", issue_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "ISSUE_NOT_FOUND".to_string(),
                message: format!("Issue {} not found", issue_id),
                hint: Some("Verify the issue ID exists.".to_string()),
                plain_message: Some(format!("未找到编号为 {} 的反馈记录", issue_id)),
            });
        }

        let mut issue: Issue = read_json(&path)?;
        let now = chrono::Utc::now().timestamp();

        if let Some(ref claim) = issue.claimed_by {
            // If claimed by another session and still active within 30 minutes (1800s)
            if claim.session_id != session_id && (now - claim.claimed_at) < 1800 {
                return Err(DevosError::Custom {
                    code: "ISSUE_ALREADY_CLAIMED".to_string(),
                    message: format!(
                        "Issue {} is already claimed by {} (session {})",
                        issue_id, claim.agent_name, claim.session_id
                    ),
                    hint: Some("Wait for the other agent to finish or coordinate with user.".to_string()),
                    plain_message: Some(format!("该问题正由 {} 处理中（30分钟内有效），避免重复处理", claim.agent_name)),
                });
            }
        }

        issue.claimed_by = Some(IssueClaim {
            agent_name: agent_name.to_string(),
            session_id: session_id.to_string(),
            claimed_at: now,
        });
        issue.status = IssueStatus::InProgress;
        issue.updated_at = chrono::Utc::now().to_rfc3339();

        atomic_write_json(&path, &issue)?;
        Ok(issue)
    }

    /// Resolve an issue (Tool 7: resolve_issue)
    pub fn resolve_issue(
        root: &Path,
        project: &DevosProject,
        issue_id: &str,
        fix_summary_plain: &str,
        changed_files: Vec<String>,
        knowledge_note: Option<(String, String)>, // (title, content)
    ) -> Result<Issue> {
        let issues_dir = root.join(&project.workspace_paths.issues);
        let path = issues_dir.join(format!("{}.json", issue_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "ISSUE_NOT_FOUND".to_string(),
                message: format!("Issue {} not found", issue_id),
                hint: Some("Verify the issue ID exists.".to_string()),
                plain_message: Some(format!("修复记录提交失败：未找到反馈 {}", issue_id)),
            });
        }

        let mut issue: Issue = read_json(&path)?;
        issue.status = IssueStatus::ReadyForRetest;
        issue.updated_at = chrono::Utc::now().to_rfc3339();

        let mut resolution = IssueResolution {
            resolved_by: Some("agent".to_string()),
            resolved_at: Some(chrono::Utc::now().to_rfc3339()),
            fix_summary_plain: Some(fix_summary_plain.to_string()),
            changed_files,
            knowledge_entry_id: None,
        };

        // If knowledge note is provided, persist it to knowledge/
        if let Some((k_title, k_content)) = knowledge_note {
            let knowledge_dir = root.join(&project.workspace_paths.knowledge);
            std::fs::create_dir_all(&knowledge_dir)?;
            let k_id = format!("KB-{:03}", issue_id);
            let k_path = knowledge_dir.join(format!("{}.md", k_id));
            let md_body = format!(
                "# {}\n\n*关联 Issue: {}*\n\n{}",
                k_title, issue_id, k_content
            );
            atomic_write(&k_path, md_body)?;
            resolution.knowledge_entry_id = Some(k_id);
        }

        issue.resolution = resolution;
        atomic_write_json(&path, &issue)?;
        Ok(issue)
    }

    /// User closes or reopens issue after retesting
    pub fn retest_issue(
        root: &Path,
        project: &DevosProject,
        issue_id: &str,
        passed: bool,
        feedback_plain: &str,
    ) -> Result<Issue> {
        let issues_dir = root.join(&project.workspace_paths.issues);
        let path = issues_dir.join(format!("{}.json", issue_id));
        let mut issue: Issue = read_json(&path)?;

        let now = chrono::Utc::now().to_rfc3339();
        issue.retest_history.push(RetestRecord {
            retested_at: now.clone(),
            passed,
            feedback_plain: feedback_plain.to_string(),
        });
        issue.updated_at = now;

        if passed {
            issue.status = IssueStatus::Closed;
        } else {
            issue.status = IssueStatus::Reopened;
        }

        atomic_write_json(&path, &issue)?;
        Ok(issue)
    }
}
