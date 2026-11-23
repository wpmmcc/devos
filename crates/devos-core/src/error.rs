use thiserror::Error;

#[derive(Error, Debug)]
pub enum DevosError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Project not found at path: {path}")]
    ProjectNotFound { path: String },

    #[error("Invalid manifest: {reason}")]
    InvalidManifest { reason: String },

    #[error("Guardrail blocked: {reason}")]
    GuardrailBlocked {
        code: String,
        reason: String,
        hint: String,
        plain_message: String,
    },

    #[error("Environment error: {message}")]
    EnvironmentError {
        code: String,
        message: String,
        hint: String,
        plain_message: String,
    },

    #[error("Smoke test failed: {output}")]
    SmokeTestFailed {
        output: String,
        hint: String,
        plain_message: String,
    },

    #[error("Port conflict: port {port} is already in use")]
    PortConflict { port: u16 },

    #[error("Unauthorized: {message}")]
    Unauthorized { message: String },

    #[error("Custom: {message}")]
    Custom {
        code: String,
        message: String,
        hint: Option<String>,
        plain_message: Option<String>,
    },
}

impl DevosError {
    pub fn error_code(&self) -> String {
        match self {
            Self::Io(_) => "IO_ERROR".to_string(),
            Self::Serialization(_) => "SERIALIZATION_ERROR".to_string(),
            Self::Database(_) => "DB_ERROR".to_string(),
            Self::ProjectNotFound { .. } => "PROJECT_NOT_FOUND".to_string(),
            Self::InvalidManifest { .. } => "INVALID_MANIFEST".to_string(),
            Self::GuardrailBlocked { code, .. } => code.clone(),
            Self::EnvironmentError { code, .. } => code.clone(),
            Self::SmokeTestFailed { .. } => "SMOKE_TEST_FAILED".to_string(),
            Self::PortConflict { .. } => "PORT_CONFLICT".to_string(),
            Self::Unauthorized { .. } => "UNAUTHORIZED".to_string(),
            Self::Custom { code, .. } => code.clone(),
        }
    }

    pub fn hint(&self) -> Option<String> {
        match self {
            Self::GuardrailBlocked { hint, .. } => Some(hint.clone()),
            Self::EnvironmentError { hint, .. } => Some(hint.clone()),
            Self::SmokeTestFailed { hint, .. } => Some(hint.clone()),
            Self::Custom { hint, .. } => hint.clone(),
            _ => None,
        }
    }

    pub fn plain_message(&self) -> String {
        match self {
            Self::ProjectNotFound { path } => {
                format!(
                    "未在目录 {} 中找到有效的 DevOS 项目配置文件 (devos.json)",
                    path
                )
            }
            Self::GuardrailBlocked { plain_message, .. } => plain_message.clone(),
            Self::EnvironmentError { plain_message, .. } => plain_message.clone(),
            Self::SmokeTestFailed { plain_message, .. } => plain_message.clone(),
            Self::PortConflict { port } => {
                format!("端口 {} 已被占用，请先关闭占用程序或在设置中更换端口", port)
            }
            Self::Unauthorized { .. } => "鉴权失败，本地连接令牌无效或已过期".to_string(),
            Self::Custom {
                plain_message,
                message,
                ..
            } => plain_message.clone().unwrap_or_else(|| message.clone()),
            _ => self.to_string(),
        }
    }
}

pub type Result<T> = std::result::Result<T, DevosError>;
