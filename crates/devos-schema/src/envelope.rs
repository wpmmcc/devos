use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum PermissionLevel {
    L0ReadOnly,
    L1LocalSafeWrite,
    L2ControlledStateChange,
    L3HumanExclusiveDanger,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum CallerType {
    HumanUi,
    LocalCli,
    AgentMcp,
    DeployPlugin,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct CommandMeta {
    pub duration_ms: u64,
    pub truncated: bool,
    pub user_locale: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct CommandErrorDetail {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub params: Option<serde_json::Value>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub untrusted_log_excerpt: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct CommandEnvelope<T> {
    pub protocol_version: String,
    pub ok: bool,
    pub command_id: String,
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CommandErrorDetail>,
    pub meta: CommandMeta,
}

impl<T: Serialize> CommandEnvelope<T> {
    pub fn success(
        command_id: &str,
        project_id: &str,
        data: T,
        duration_ms: u64,
        locale: &str,
    ) -> Self {
        Self {
            protocol_version: "1.0".to_string(),
            ok: true,
            command_id: command_id.to_string(),
            project_id: project_id.to_string(),
            data: Some(data),
            error: None,
            meta: CommandMeta {
                duration_ms,
                truncated: false,
                user_locale: locale.to_string(),
            },
        }
    }

    pub fn error(
        command_id: &str,
        project_id: &str,
        code: &str,
        message: &str,
        hint: Option<String>,
        params: Option<serde_json::Value>,
        untrusted_log: Option<String>,
        duration_ms: u64,
        locale: &str,
    ) -> Self {
        Self {
            protocol_version: "1.0".to_string(),
            ok: false,
            command_id: command_id.to_string(),
            project_id: project_id.to_string(),
            data: None,
            error: Some(CommandErrorDetail {
                code: code.to_string(),
                params,
                message: message.to_string(),
                hint,
                retryable: false,
                untrusted_log_excerpt: untrusted_log,
            }),
            meta: CommandMeta {
                duration_ms,
                truncated: false,
                user_locale: locale.to_string(),
            },
        }
    }
}
