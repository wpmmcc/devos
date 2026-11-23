use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::db::Database;
use crate::error::Result;
use crate::fs_utils::{atomic_write_json, read_json};

pub struct RingBufferLogger {
    buffer: VecDeque<String>,
    capacity: usize,
}

impl RingBufferLogger {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn append(&mut self, line: String) {
        if self.buffer.len() >= self.capacity {
            self.buffer.pop_front();
        }
        self.buffer.push_back(line);
    }

    pub fn get_lines(&self, only_errors: bool) -> Vec<String> {
        self.buffer
            .iter()
            .filter(|l| {
                if only_errors {
                    let lower = l.to_lowercase();
                    lower.contains("error") || lower.contains("fatal") || lower.contains("fail") || lower.contains("exception")
                } else {
                    true
                }
            })
            .cloned()
            .collect()
    }
}

fn global_logger() -> &'static Mutex<RingBufferLogger> {
    static LOGGER: OnceLock<Mutex<RingBufferLogger>> = OnceLock::new();
    LOGGER.get_or_init(|| Mutex::new(RingBufferLogger::new(1000)))
}

/// Append an environment or runtime log line to the in-memory ring buffer
pub fn log_runtime_line(line: &str) {
    if let Ok(mut l) = global_logger().lock() {
        let timestamp = chrono::Utc::now().format("%H:%M:%S");
        l.append(format!("[{}] {}", timestamp, line));
    }
}

/// Get recent log lines from the in-memory ring buffer
pub fn get_runtime_logs(only_errors: bool) -> Vec<String> {
    if let Ok(l) = global_logger().lock() {
        l.get_lines(only_errors)
    } else {
        Vec::new()
    }
}

/// Sanitize text by redacting sensitive user directory paths, tokens, and secrets
pub fn sanitize_text(raw: &str) -> String {
    let mut s = raw.to_string();

    // 1. Redact user home directory path
    if let Some(home) = dirs::home_dir() {
        let home_str = home.display().to_string();
        if !home_str.is_empty() {
            s = s.replace(&home_str, "~");
        }
    }

    // 2. Redact Bearer / API keys
    if let Ok(re_bearer) = Regex::new(r"(?i)(bearer\s+)[A-Za-z0-9_\-\.]{8,}") {
        s = re_bearer.replace_all(&s, "$1[REDACTED_TOKEN]").to_string();
    }
    if let Ok(re_sk) = Regex::new(r"sk-[A-Za-z0-9_\-]{16,}") {
        s = re_sk.replace_all(&s, "sk-[REDACTED_API_KEY]").to_string();
    }
    if let Ok(re_gh) = Regex::new(r"gh[pousr]_[A-Za-z0-9]{20,}") {
        s = re_gh.replace_all(&s, "ghp_[REDACTED_GITHUB_TOKEN]").to_string();
    }
    if let Ok(re_pwd) = Regex::new(r"(?i)(password|secret|passwd)=([^\s&]+)") {
        s = re_pwd.replace_all(&s, "$1=[REDACTED]").to_string();
    }

    s
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiagnosticBundle {
    pub exported_at: String,
    pub os: String,
    pub arch: String,
    pub devos_version: String,
    pub project_slug: Option<String>,
    pub recent_activities: Vec<String>,
    pub runtime_logs: Vec<String>,
    pub is_sanitized: bool,
}

/// Export a sanitized diagnostic bundle file to ~/.devos/diagnostics/
pub fn export_diagnostic_bundle(project_root: Option<&Path>) -> Result<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let diag_dir = home.join(".devos").join("diagnostics");
    fs::create_dir_all(&diag_dir)?;

    let now_str = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let bundle_path = diag_dir.join(format!("diagnostic_bundle_{}.json", now_str));

    let raw_logs = get_runtime_logs(false);
    let sanitized_logs: Vec<String> = raw_logs.into_iter().map(|l| sanitize_text(&l)).collect();

    let mut project_slug = None;
    let mut recent_acts = Vec::new();

    if let Some(root) = project_root {
        let manifest_path = root.join("devos.json");
        if manifest_path.exists() {
            if let Ok(val) = read_json::<_, serde_json::Value>(&manifest_path) {
                project_slug = val.get("slug").and_then(|s| s.as_str()).map(|s| s.to_string());
            }
        }
    }

    if let Ok(db) = Database::open_global() {
        if let Ok(acts) = db.list_activities(project_slug.as_deref().unwrap_or(""), 20) {
            recent_acts = acts.into_iter().map(|a| format!("[{}] {}: {}", a.created_at, a.actor, a.summary_plain)).collect();
        }
    }

    let bundle = DiagnosticBundle {
        exported_at: chrono::Utc::now().to_rfc3339(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        devos_version: env!("CARGO_PKG_VERSION").to_string(),
        project_slug,
        recent_activities: recent_acts,
        runtime_logs: sanitized_logs,
        is_sanitized: true,
    };

    atomic_write_json(&bundle_path, &bundle)?;

    Ok(bundle_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_logger() {
        let mut r = RingBufferLogger::new(3);
        r.append("Line 1".into());
        r.append("Error occurred".into());
        r.append("Line 3".into());
        r.append("Line 4".into());

        assert_eq!(r.get_lines(false).len(), 3);
        assert_eq!(r.get_lines(true).len(), 1);
        assert_eq!(r.get_lines(true)[0], "Error occurred");
    }

    #[test]
    fn test_sanitize_text_secrets() {
        let input = "Failed to connect with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and sk-1234567890abcdef12345678 and password=mysecretpass";
        let sanitized = sanitize_text(input);
        assert!(!sanitized.contains("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
        assert!(!sanitized.contains("sk-1234567890abcdef12345678"));
        assert!(!sanitized.contains("mysecretpass"));
        assert!(sanitized.contains("[REDACTED"));
    }
}
