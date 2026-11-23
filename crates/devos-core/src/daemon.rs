use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};
use devos_schema::DaemonInfo;
use std::path::PathBuf;

pub struct DaemonManager;

impl DaemonManager {
    pub fn get_daemon_file_path() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join(".devos").join("daemon.json")
    }

    pub fn write_daemon_info(port: u16, pid: u32, session_token: String) -> Result<DaemonInfo> {
        let path = Self::get_daemon_file_path();
        let info = DaemonInfo {
            port,
            pid,
            session_token,
            started_at: chrono::Utc::now().to_rfc3339(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        };
        atomic_write_json(&path, &info)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(info)
    }

    /// Validate incoming HTTP/IPC request headers to prevent CSRF and DNS rebinding attacks:
    /// 1. Host strictly matches 127.0.0.1:<port> or localhost:<port>
    /// 2. Origin (if present) matches expected local origin
    /// 3. Bearer token matches session_token
    pub fn validate_request_security(
        host_header: Option<&str>,
        origin_header: Option<&str>,
        auth_header: Option<&str>,
        expected_token: &str,
    ) -> Result<()> {
        // 1. Host check (DNS Rebinding protection)
        if let Some(host) = host_header {
            let host_clean = host.split(':').next().unwrap_or(host);
            if host_clean != "127.0.0.1" && host_clean != "localhost" {
                return Err(DevosError::Custom {
                    code: "AUTH_DNS_REBINDING_BLOCKED".to_string(),
                    message: format!(
                        "Invalid Host header '{}': DNS rebinding attack blocked",
                        host
                    ),
                    hint: Some("Requests must target 127.0.0.1 or localhost directly.".to_string()),
                    plain_message: Some("安全拦截：拒绝非本地 Host 头的跨站请求".to_string()),
                });
            }
        }

        // 2. Origin check (CSRF protection)
        if let Some(origin) = origin_header {
            if !origin.starts_with("http://127.0.0.1")
                && !origin.starts_with("http://localhost")
                && !origin.starts_with("tauri://")
            {
                return Err(DevosError::Custom {
                    code: "AUTH_CSRF_BLOCKED".to_string(),
                    message: format!("Untrusted Origin header '{}': CSRF attack blocked", origin),
                    hint: Some(
                        "Cross-origin requests from external web pages are forbidden.".to_string(),
                    ),
                    plain_message: Some("安全拦截：拒绝外部网页发起的跨站控制请求".to_string()),
                });
            }
        }

        // 3. Bearer Token check
        if let Some(auth) = auth_header {
            let token = auth.strip_prefix("Bearer ").unwrap_or(auth);
            if token != expected_token {
                return Err(DevosError::Custom {
                    code: "AUTH_INVALID_TOKEN".to_string(),
                    message: "Invalid or missing Bearer authorization token".to_string(),
                    hint: Some("Provide valid session token in Authorization header.".to_string()),
                    plain_message: Some("认证失败：会话凭据无效".to_string()),
                });
            }
        } else {
            return Err(DevosError::Custom {
                code: "AUTH_TOKEN_REQUIRED".to_string(),
                message: "Missing Authorization Bearer token header".to_string(),
                hint: Some("Provide Authorization: Bearer <token>".to_string()),
                plain_message: Some("认证失败：缺少授权凭据".to_string()),
            });
        }

        Ok(())
    }

    pub fn read_daemon_info() -> Result<DaemonInfo> {
        let path = Self::get_daemon_file_path();
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "DAEMON_NOT_RUNNING".to_string(),
                message: "Local daemon is not running (daemon.json not found)".to_string(),
                hint: Some("Start DevOS Desktop or run `devos daemon`.".to_string()),
                plain_message: Some(
                    "DevOS 桌面服务未在运行，正在降级为本地直接读写模式。".to_string(),
                ),
            });
        }
        read_json(&path)
    }

    pub fn remove_daemon_file() -> Result<()> {
        let path = Self::get_daemon_file_path();
        if path.exists() {
            std::fs::remove_file(path).map_err(DevosError::Io)?;
        }
        Ok(())
    }
}
