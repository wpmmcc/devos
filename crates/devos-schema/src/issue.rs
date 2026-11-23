use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueStatus {
    Open,
    InProgress,
    ReadyForRetest,
    Closed,
    Reopened,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IssueSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum SourceType {
    WebPreview,
    ScriptRun,
    Manual,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct UserReport {
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_behavior: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct AnnotatedRegion {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ConsoleErrorRecord {
    pub timestamp: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct FailedRequestRecord {
    pub method: String,
    pub url: String,
    pub status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_snippet: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct WebContext {
    pub url: String,
    pub viewport: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotated_region: Option<AnnotatedRegion>,
    #[serde(default)]
    pub console_errors: Vec<ConsoleErrorRecord>,
    #[serde(default)]
    pub failed_requests: Vec<FailedRequestRecord>,
    #[serde(default)]
    pub backend_logs_tail: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ScriptContext {
    pub run_target_id: String,
    pub command_executed: String,
    #[ts(type = "any")]
    pub inputs_used: serde_json::Value,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub stdout_tail: String,
    pub stderr_tail: String,
    #[serde(default)]
    pub output_files_generated: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default, TS)]
#[ts(export)]
pub struct CapturedContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web: Option<WebContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<ScriptContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub env_health: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default, TS)]
#[ts(export)]
pub struct IssueResolution {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix_summary_plain: Option<String>,
    #[serde(default)]
    pub changed_files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub knowledge_entry_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct RetestRecord {
    pub retested_at: String,
    pub passed: bool,
    pub feedback_plain: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct Issue {
    pub schema_version: String,
    pub issue_id: String,
    pub status: IssueStatus,
    pub severity: IssueSeverity,
    pub source_type: SourceType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_card_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_checklist_step: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
    pub user_report: UserReport,
    pub captured_context: CapturedContext,
    pub resolution: IssueResolution,
    #[serde(default)]
    pub retest_history: Vec<RetestRecord>,
}

impl Issue {
    pub const CURRENT_SCHEMA_VERSION: &'static str = "1.0";

    pub fn new(
        issue_id: String,
        severity: IssueSeverity,
        source_type: SourceType,
        user_report: UserReport,
        captured_context: CapturedContext,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION.to_string(),
            issue_id,
            status: IssueStatus::Open,
            severity,
            source_type,
            linked_card_id: None,
            linked_checklist_step: None,
            created_at: now.clone(),
            updated_at: now,
            user_report,
            captured_context,
            resolution: IssueResolution::default(),
            retest_history: Vec::new(),
        }
    }
}
