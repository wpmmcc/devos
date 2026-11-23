use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum BoardColumn {
    Todo,
    Doing,
    Testing,
    Done,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ChecklistStep {
    pub step: u32,
    pub action: String,
    pub expected: String,
    #[serde(default)]
    pub checked: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct BoardCard {
    pub schema_version: String,
    pub card_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub column: BoardColumn,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_req_id: Option<String>,
    #[serde(default)]
    pub checklist: Vec<ChecklistStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary_plain: Option<String>,
    #[serde(default)]
    pub run_target_ids: Vec<String>,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

impl BoardCard {
    pub const CURRENT_SCHEMA_VERSION: &'static str = "1.0";

    pub fn new(card_id: String, title: String, updated_by: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION.to_string(),
            card_id,
            title,
            description: None,
            column: BoardColumn::Todo,
            linked_req_id: None,
            checklist: Vec::new(),
            summary_plain: None,
            run_target_ids: Vec::new(),
            updated_by,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
