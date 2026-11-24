use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct DecisionOption {
    #[serde(alias = "key")]
    pub id: String,
    pub label: String,
    #[serde(alias = "description", skip_serializing_if = "Option::is_none")]
    pub tradeoff: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct DecisionRequest {
    pub decision_id: String,
    #[serde(alias = "question")]
    pub question_plain: String,
    #[serde(alias = "context")]
    pub context_plain: String,
    pub options: Vec<DecisionOption>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_option_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_card_id: Option<String>,
    pub status: String, // "pending" | "resolved"
    pub created_at: String,
}
