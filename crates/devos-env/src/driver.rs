use devos_core::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum DiagnosticStatus {
    Ok,
    Warning,
    Error,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct DiagnosticItem {
    pub key: String,
    pub title: String,
    pub status: DiagnosticStatus,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix_hint: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct EnvStatus {
    pub running: bool,
    pub driver: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_name: Option<String>,
    #[ts(type = "any")]
    pub details: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ExecResult {
    pub exit_code: i32,
    pub duration_ms: u64,
    pub stdout: String,
    pub stderr: String,
}

pub trait EnvDriver: Send + Sync {
    fn driver_name(&self) -> &'static str;
    fn check_prereqs(&self) -> Result<Vec<DiagnosticItem>>;
    fn up(&self, project_root: &Path) -> Result<EnvStatus>;
    fn down(&self, project_root: &Path) -> Result<()>;
    fn status(&self, project_root: &Path) -> Result<EnvStatus>;
    fn exec(
        &self,
        project_root: &Path,
        cmd: &str,
        timeout_sec: u64,
        env_vars: &[(&str, &str)],
    ) -> Result<ExecResult>;
    fn snapshot(&self, project_root: &Path, name: &str) -> Result<()>;
    fn restore(&self, project_root: &Path, name: &str) -> Result<()>;
    fn logs(&self, project_root: &Path, tail: usize) -> Result<Vec<String>>;
}
