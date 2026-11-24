use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, TS)]
#[serde(rename_all = "UPPERCASE")]
#[ts(export)]
pub enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

impl fmt::Display for LogLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

impl FromStr for LogLevel {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "DEBUG" => Ok(LogLevel::Debug),
            "INFO" => Ok(LogLevel::Info),
            "WARN" | "WARNING" => Ok(LogLevel::Warn),
            "ERROR" | "ERR" | "FATAL" => Ok(LogLevel::Error),
            _ => Err(format!("Unknown log level: {}", s)),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum LogSource {
    All,
    Core,
    Env,
    Runner,
    Probe,
    Deploy,
}

impl fmt::Display for LogSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LogSource::All => write!(f, "all"),
            LogSource::Core => write!(f, "core"),
            LogSource::Env => write!(f, "env"),
            LogSource::Runner => write!(f, "runner"),
            LogSource::Probe => write!(f, "probe"),
            LogSource::Deploy => write!(f, "deploy"),
        }
    }
}

impl FromStr for LogSource {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "all" => Ok(LogSource::All),
            "core" | "system" | "daemon" => Ok(LogSource::Core),
            "env" | "docker" | "ddev" | "devcontainer" => Ok(LogSource::Env),
            "runner" | "script" | "task" => Ok(LogSource::Runner),
            "probe" | "browser" | "web" => Ok(LogSource::Probe),
            "deploy" | "plugin" | "release" => Ok(LogSource::Deploy),
            _ => Err(format!("Unknown log source: {}", s)),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: LogLevel,
    pub source: LogSource,
    pub message: String,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_slug: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, TS)]
#[ts(export)]
pub struct LogFilter {
    #[ts(optional)]
    #[serde(default)]
    pub min_level: Option<LogLevel>,
    #[ts(optional)]
    #[serde(default)]
    pub source: Option<LogSource>,
    #[ts(optional)]
    #[serde(default)]
    pub query: Option<String>,
    #[ts(optional)]
    #[serde(default)]
    pub limit: Option<usize>,
}
