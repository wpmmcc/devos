use crate::db::Database;
use crate::error::Result;
use crate::fs_utils::{atomic_write_json, read_json};
pub use devos_schema::{LogEntry, LogFilter, LogLevel, LogSource};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Maximum entries in the in-memory ring buffer to prevent Tauri memory bloat / OOM
pub const MAX_RING_BUFFER_ENTRIES: usize = 2000;

/// Maximum single log file size on disk before rolling over (10 MB as specified in requirements)
pub const MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// In-memory ring buffer logger protecting desktop process memory backpressure
pub struct RingBufferLogger {
    entries: VecDeque<LogEntry>,
    capacity: usize,
    counter: u64,
}

impl RingBufferLogger {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(capacity),
            capacity,
            counter: 0,
        }
    }

    pub fn append(&mut self, mut entry: LogEntry) {
        self.counter += 1;
        if entry.id.is_empty() {
            entry.id = format!("log_{}_{}", chrono::Utc::now().timestamp_millis(), self.counter);
        }
        entry.message = sanitize_text(&entry.message);

        if self.entries.len() >= self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }

    pub fn get_entries(&self, filter: &LogFilter) -> Vec<LogEntry> {
        let query_lower = filter.query.as_ref().map(|q| q.to_lowercase());

        self.entries
            .iter()
            .filter(|e| {
                // 1. Min level filter
                if let Some(min) = filter.min_level {
                    if e.level < min {
                        return false;
                    }
                }
                // 2. Source filter
                if let Some(ref src) = filter.source {
                    if *src != LogSource::All && e.source != *src {
                        return false;
                    }
                }
                // 3. Substring query filter
                if let Some(ref q) = query_lower {
                    let msg_match = e.message.to_lowercase().contains(q);
                    let target_match = e
                        .target
                        .as_ref()
                        .map(|t| t.to_lowercase().contains(q))
                        .unwrap_or(false);
                    let slug_match = e
                        .project_slug
                        .as_ref()
                        .map(|s| s.to_lowercase().contains(q))
                        .unwrap_or(false);
                    if !msg_match && !target_match && !slug_match {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect::<Vec<_>>()
    }

    pub fn tail(&self, n: usize) -> Vec<LogEntry> {
        let count = self.entries.len();
        if n >= count {
            self.entries.iter().cloned().collect()
        } else {
            self.entries.range(count - n..).cloned().collect()
        }
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn get_lines(&self, only_errors: bool) -> Vec<String> {
        self.entries
            .iter()
            .filter(|e| {
                if only_errors {
                    e.level == LogLevel::Error
                } else {
                    true
                }
            })
            .map(|e| {
                format!(
                    "[{}] [{}] [{}] {}",
                    e.timestamp, e.level, e.source, e.message
                )
            })
            .collect()
    }
}

fn global_logger() -> &'static Mutex<RingBufferLogger> {
    static LOGGER: OnceLock<Mutex<RingBufferLogger>> = OnceLock::new();
    LOGGER.get_or_init(|| Mutex::new(RingBufferLogger::new(MAX_RING_BUFFER_ENTRIES)))
}

/// Rolling file appender with 10 MB rotation
pub struct RollingFileLogger;

impl RollingFileLogger {
    pub fn append_to_file(file_path: &Path, line: &str) -> std::io::Result<()> {
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Check file size for 10MB limit rotation
        if let Ok(metadata) = fs::metadata(file_path) {
            if metadata.len() >= MAX_LOG_FILE_BYTES {
                Self::rotate_log_files(file_path)?;
            }
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(file_path)?;
        writeln!(file, "{}", line)?;
        Ok(())
    }

    fn rotate_log_files(base_path: &Path) -> std::io::Result<()> {
        // Keep up to 3 rotated files: base.log.2 -> base.log.3, base.log.1 -> base.log.2, base.log -> base.log.1
        let path3 = PathBuf::from(format!("{}.3", base_path.display()));
        let path2 = PathBuf::from(format!("{}.2", base_path.display()));
        let path1 = PathBuf::from(format!("{}.1", base_path.display()));

        if path2.exists() {
            let _ = fs::rename(&path2, &path3);
        }
        if path1.exists() {
            let _ = fs::rename(&path1, &path2);
        }
        if base_path.exists() {
            let _ = fs::rename(base_path, &path1);
        }
        Ok(())
    }
}

/// Core function to record a structured log entry
pub fn log_entry(
    level: LogLevel,
    source: LogSource,
    message: impl Into<String>,
    target: Option<String>,
    project_slug: Option<String>,
) {
    let now = chrono::Utc::now().to_rfc3339();
    let entry = LogEntry {
        id: String::new(),
        timestamp: now.clone(),
        level,
        source: source.clone(),
        message: message.into(),
        target,
        project_slug: project_slug.clone(),
    };

    // 1. In-memory RingBuffer
    if let Ok(mut l) = global_logger().lock() {
        l.append(entry.clone());
    }

    // 2. Best-effort Disk Logging to ~/.devos/logs/system.log
    let formatted_line = format!(
        "[{}] [{}] [{}] {}{}",
        now,
        level,
        source,
        entry.message,
        project_slug
            .map(|s| format!(" (project={})", s))
            .unwrap_or_default()
    );

    if let Some(home) = dirs::home_dir() {
        let system_log_path = home.join(".devos").join("logs").join("system.log");
        let _ = RollingFileLogger::append_to_file(&system_log_path, &formatted_line);
    }
}

pub fn log_debug(source: LogSource, message: impl Into<String>) {
    log_entry(LogLevel::Debug, source, message, None, None);
}

pub fn log_info(source: LogSource, message: impl Into<String>) {
    log_entry(LogLevel::Info, source, message, None, None);
}

pub fn log_warn(source: LogSource, message: impl Into<String>) {
    log_entry(LogLevel::Warn, source, message, None, None);
}

pub fn log_error(source: LogSource, message: impl Into<String>) {
    log_entry(LogLevel::Error, source, message, None, None);
}

/// Append an environment or runtime log line (backward compatible)
pub fn log_runtime_line(line: &str) {
    let lower = line.to_lowercase();
    let level = if lower.contains("error") || lower.contains("fatal") || lower.contains("fail") {
        LogLevel::Error
    } else if lower.contains("warn") {
        LogLevel::Warn
    } else {
        LogLevel::Info
    };
    log_entry(level, LogSource::Core, line, None, None);
}

/// Query structured logs matching filter (falls back to disk logs if memory buffer is empty)
pub fn get_logs(filter: &LogFilter) -> Vec<LogEntry> {
    let mut entries = if let Ok(l) = global_logger().lock() {
        l.get_entries(filter)
    } else {
        Vec::new()
    };

    if entries.is_empty() {
        entries = read_disk_logs(filter);
    }

    if let Some(limit) = filter.limit {
        if entries.len() > limit {
            entries = entries.split_off(entries.len() - limit);
        }
    }
    entries
}

/// Read recent logs from ~/.devos/logs/system.log matching filter
pub fn read_disk_logs(filter: &LogFilter) -> Vec<LogEntry> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };
    let system_log = home.join(".devos").join("logs").join("system.log");
    if !system_log.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&system_log) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut result = Vec::new();
    let query_lower = filter.query.as_ref().map(|q| q.to_lowercase());

    for line in content.lines() {
        let line = line.trim();
        if !line.starts_with('[') {
            continue;
        }

        let parts: Vec<&str> = line.splitn(4, ']').collect();
        if parts.len() < 4 {
            continue;
        }

        let timestamp = parts[0].trim_start_matches('[').trim().to_string();
        let level_str = parts[1].trim_start_matches('[').trim();
        let source_str = parts[2].trim_start_matches('[').trim();
        let message = parts[3].trim().to_string();

        let level = level_str.parse::<LogLevel>().unwrap_or(LogLevel::Info);
        let source = source_str.parse::<LogSource>().unwrap_or(LogSource::Core);

        if let Some(min) = filter.min_level {
            if level < min {
                continue;
            }
        }
        if let Some(ref src) = filter.source {
            if *src != LogSource::All && source != *src {
                continue;
            }
        }
        if let Some(ref q) = query_lower {
            if !message.to_lowercase().contains(q) {
                continue;
            }
        }

        result.push(LogEntry {
            id: format!("disk_{}", result.len()),
            timestamp,
            level,
            source,
            message,
            target: None,
            project_slug: None,
        });
    }

    result
}

/// Clear in-memory log buffer
pub fn clear_logs() {
    if let Ok(mut l) = global_logger().lock() {
        l.clear();
    }
}

/// Get recent log lines from in-memory ring buffer (backward compatible)
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
        s = re_gh
            .replace_all(&s, "ghp_[REDACTED_GITHUB_TOKEN]")
            .to_string();
    }
    if let Ok(re_pwd) = Regex::new(r"(?i)(password|secret|passwd)=([^\s&]+)") {
        s = re_pwd.replace_all(&s, "$1=[REDACTED]").to_string();
    }

    // 3. Redact Database connection URL credentials (e.g. mysql://root:pass@localhost:3306/db)
    if let Ok(re_db) = Regex::new(r"(?i)(postgres|postgresql|mysql|mongodb|redis)://([^:]+):([^@]+)@") {
        s = re_db.replace_all(&s, "$1://$2:[REDACTED]@").to_string();
    }

    // 4. Redact Private Keys
    if let Ok(re_privkey) = Regex::new(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----") {
        s = re_privkey.replace_all(&s, "[REDACTED_PRIVATE_KEY]").to_string();
    }

    s
}

/// Format untrusted logs for safe ingestion by AI Agent with boundary tag and truncation guardrails
pub fn format_untrusted_log_excerpt(lines: &[String], max_lines: usize, max_bytes: usize) -> String {
    let mut selected: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
    let mut was_truncated = false;

    if selected.len() > max_lines {
        selected = selected.split_off(selected.len() - max_lines);
        was_truncated = true;
    }

    let mut combined = selected.join("\n");
    if combined.len() > max_bytes {
        combined = combined[combined.len().saturating_sub(max_bytes)..].to_string();
        was_truncated = true;
    }

    let sanitized = sanitize_text(&combined);
    if was_truncated {
        format!(
            "<untrusted_log_excerpt truncated=\"true\">\n[...truncated for context safety...]\n{}\n</untrusted_log_excerpt>",
            sanitized
        )
    } else {
        format!(
            "<untrusted_log_excerpt>\n{}\n</untrusted_log_excerpt>",
            sanitized
        )
    }
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
    pub structured_logs: Vec<LogEntry>,
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
    let structured_entries = get_logs(&LogFilter {
        min_level: None,
        source: None,
        query: None,
        limit: Some(200),
    });

    let mut project_slug = None;
    let mut recent_acts = Vec::new();

    if let Some(root) = project_root {
        let manifest_path = root.join("devos.json");
        if manifest_path.exists() {
            if let Ok(val) = read_json::<_, serde_json::Value>(&manifest_path) {
                project_slug = val
                    .get("slug")
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string());
            }
        }
    }

    if let Ok(db) = Database::open_global() {
        if let Ok(acts) = db.list_activities(project_slug.as_deref().unwrap_or(""), 20) {
            recent_acts = acts
                .into_iter()
                .map(|a| format!("[{}] {}: {}", a.created_at, a.actor, a.summary_plain))
                .collect();
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
        structured_logs: structured_entries,
        is_sanitized: true,
    };

    atomic_write_json(&bundle_path, &bundle)?;

    Ok(bundle_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_ring_buffer_structured_logger() {
        let mut r = RingBufferLogger::new(3);
        r.append(LogEntry {
            id: "".into(),
            timestamp: "2026-11-24T10:00:00Z".into(),
            level: LogLevel::Info,
            source: LogSource::Core,
            message: "Project init".into(),
            target: None,
            project_slug: Some("proj-a".into()),
        });
        r.append(LogEntry {
            id: "".into(),
            timestamp: "2026-11-24T10:00:01Z".into(),
            level: LogLevel::Warn,
            source: LogSource::Env,
            message: "Port collision avoided".into(),
            target: None,
            project_slug: Some("proj-a".into()),
        });
        r.append(LogEntry {
            id: "".into(),
            timestamp: "2026-11-24T10:00:02Z".into(),
            level: LogLevel::Error,
            source: LogSource::Probe,
            message: "Uncaught error".into(),
            target: None,
            project_slug: Some("proj-b".into()),
        });
        r.append(LogEntry {
            id: "".into(),
            timestamp: "2026-11-24T10:00:03Z".into(),
            level: LogLevel::Info,
            source: LogSource::Runner,
            message: "Script finished".into(),
            target: None,
            project_slug: Some("proj-b".into()),
        });

        // Capacity is 3, first was evicted
        assert_eq!(r.entries.len(), 3);

        // Filter by min_level = Warn
        let warn_filter = LogFilter {
            min_level: Some(LogLevel::Warn),
            source: None,
            query: None,
            limit: None,
        };
        let warn_entries = r.get_entries(&warn_filter);
        assert_eq!(warn_entries.len(), 2); // Warn and Error

        // Filter by source = Probe
        let probe_filter = LogFilter {
            min_level: None,
            source: Some(LogSource::Probe),
            query: None,
            limit: None,
        };
        let probe_entries = r.get_entries(&probe_filter);
        assert_eq!(probe_entries.len(), 1);
        assert_eq!(probe_entries[0].level, LogLevel::Error);

        // Filter by query
        let query_filter = LogFilter {
            min_level: None,
            source: None,
            query: Some("collision".into()),
            limit: None,
        };
        let query_entries = r.get_entries(&query_filter);
        assert_eq!(query_entries.len(), 1);
    }

    #[test]
    fn test_rolling_file_logger() {
        let dir = tempdir().unwrap();
        let log_file = dir.path().join("test.log");

        RollingFileLogger::append_to_file(&log_file, "Line 1").unwrap();
        RollingFileLogger::append_to_file(&log_file, "Line 2").unwrap();

        let content = fs::read_to_string(&log_file).unwrap();
        assert!(content.contains("Line 1"));
        assert!(content.contains("Line 2"));
    }

    #[test]
    fn test_sanitize_text_secrets() {
        let input = "Failed to connect with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and sk-1234567890abcdef12345678 and mysql://root:secretpass123@127.0.0.1:3306/devos and password=mysecretpass";
        let sanitized = sanitize_text(input);
        assert!(!sanitized.contains("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
        assert!(!sanitized.contains("sk-1234567890abcdef12345678"));
        assert!(!sanitized.contains("secretpass123"));
        assert!(!sanitized.contains("mysecretpass"));
        assert!(sanitized.contains("[REDACTED"));
    }

    #[test]
    fn test_format_untrusted_log_excerpt() {
        let lines = vec![
            "info: starting server".to_string(),
            "error: division by zero".to_string(),
            "warning: memory low".to_string(),
        ];
        let wrapped = format_untrusted_log_excerpt(&lines, 2, 1000);
        assert!(wrapped.contains("<untrusted_log_excerpt truncated=\"true\">"));
        assert!(wrapped.contains("division by zero"));
        assert!(wrapped.contains("</untrusted_log_excerpt>"));
    }
}
