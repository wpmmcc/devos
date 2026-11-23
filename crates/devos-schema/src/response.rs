use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ApiErrorDetail {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plain_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ApiResponse<T> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiErrorDetail>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: impl Into<String>, message: impl Into<String>, hint: Option<String>, plain_message: Option<String>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(ApiErrorDetail {
                code: code.into(),
                message: message.into(),
                hint,
                plain_message,
            }),
        }
    }
}
