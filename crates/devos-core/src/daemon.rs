use std::path::PathBuf;
use devos_schema::DaemonInfo;
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};

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
        Ok(info)
    }

    pub fn read_daemon_info() -> Result<DaemonInfo> {
        let path = Self::get_daemon_file_path();
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "DAEMON_NOT_RUNNING".to_string(),
                message: "Local daemon is not running (daemon.json not found)".to_string(),
                hint: Some("Start DevOS Desktop or run `devos daemon`.".to_string()),
                plain_message: Some("DevOS 桌面服务未在运行，正在降级为本地直接读写模式。".to_string()),
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
