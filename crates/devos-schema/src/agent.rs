use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct AgentDetection {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub config_path: String,
    pub configured: bool,
    pub description: String,
}
