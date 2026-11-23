use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct DaemonInfo {
    pub port: u16,
    pub pid: u32,
    pub session_token: String,
    pub started_at: String,
    pub version: String,
}
