use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum InputType {
    String,
    Number,
    Boolean,
    Select,
    File,
    Directory,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct RunInput {
    pub name: String,
    pub label: String,
    #[serde(rename = "type")]
    pub input_type: InputType,
    #[serde(default)]
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ExpectedOutput {
    pub path: String,
    pub label: String,
    pub preview_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct SmokeTestConfig {
    pub enabled: bool,
    pub command: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct RunTarget {
    pub id: String,
    pub label: String,
    pub description: String,
    pub env: String,
    pub command: String,
    #[serde(default = "default_timeout")]
    pub timeout_sec: u64,
    #[serde(default)]
    pub inputs: Vec<RunInput>,
    #[serde(default)]
    pub expected_outputs: Vec<ExpectedOutput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smoke_test: Option<SmokeTestConfig>,
}

fn default_timeout() -> u64 {
    60
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct RunManifest {
    pub schema_version: String,
    pub targets: Vec<RunTarget>,
}

impl Default for RunManifest {
    fn default() -> Self {
        Self {
            schema_version: "1.0".to_string(),
            targets: Vec::new(),
        }
    }
}
