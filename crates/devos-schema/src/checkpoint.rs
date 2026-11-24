use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct FileDiffItem {
    pub path: String,
    pub status: String, // "modified" | "added" | "deleted"
    pub additions: usize,
    pub deletions: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff_preview: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct CheckpointInfo {
    pub id: String,
    pub created_at: String,
    pub note: String,
    pub source: String,
    pub commit_ref: Option<String>,
}
