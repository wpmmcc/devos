use crate::db::Database;
use crate::error::{DevosError, Result};
use std::net::TcpListener;
use std::process::Command;

pub struct PortRegistry;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PortAllocation {
    pub project_id: String,
    pub port: u16,
    pub service: String,
    pub allocated_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PortOccupant {
    pub port: u16,
    pub is_occupied: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub command_line: Option<String>,
    pub suggested_action: Option<String>,
}

impl PortRegistry {
    /// Check if a local TCP port is currently free to bind
    pub fn is_port_available(port: u16) -> bool {
        match TcpListener::bind(("127.0.0.1", port)) {
            Ok(listener) => {
                drop(listener);
                true
            }
            Err(_) => false,
        }
    }

    /// Allocate the first free port in range [start_port, end_port]
    pub fn find_available_port(start_port: u16, end_port: u16) -> Result<u16> {
        for port in start_port..=end_port {
            if Self::is_port_available(port) {
                return Ok(port);
            }
        }
        Err(DevosError::Custom {
            code: "NO_PORT_AVAILABLE".to_string(),
            message: format!(
                "No available port found in range {}-{}",
                start_port, end_port
            ),
            hint: Some("Check and terminate running background services.".to_string()),
            plain_message: Some(format!(
                "在端口范围 {}-{} 内未找到可用空闲端口",
                start_port, end_port
            )),
        })
    }

    /// Automatically find suitable web ports, avoiding standard 80/443 if occupied by host processes
    pub fn find_free_web_ports(preferred_http: u16, preferred_https: u16) -> (u16, u16) {
        let http_port = if Self::is_port_available(preferred_http) {
            preferred_http
        } else {
            Self::find_available_port(18080, 18399).unwrap_or(18080)
        };

        let https_port = if Self::is_port_available(preferred_https) {
            preferred_https
        } else {
            Self::find_available_port(18443, 18999).unwrap_or(18443)
        };

        (http_port, https_port)
    }

    /// Inspect what process is occupying the specified port
    pub fn inspect_port_occupant(port: u16) -> PortOccupant {
        if Self::is_port_available(port) {
            return PortOccupant {
                port,
                is_occupied: false,
                pid: None,
                process_name: None,
                command_line: None,
                suggested_action: Some("端口当前空闲可用".to_string()),
            };
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = Command::new("lsof")
                .arg("-nP")
                .arg(format!("-iTCP:{}", port))
                .arg("-sTCP:LISTEN")
                .output()
            {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    let mut lines = text.lines();
                    let _header = lines.next();
                    if let Some(row) = lines.next() {
                        let parts: Vec<&str> = row.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let process_name = parts[0].to_string();
                            let pid: Option<u32> = parts[1].parse().ok();

                            let mut cmdline = None;
                            if let Some(p) = pid {
                                if let Ok(ps_out) = Command::new("ps")
                                    .args(["-p", &p.to_string(), "-o", "command="])
                                    .output()
                                {
                                    let c =
                                        String::from_utf8_lossy(&ps_out.stdout).trim().to_string();
                                    if !c.is_empty() {
                                        cmdline = Some(c);
                                    }
                                }
                            }

                            return PortOccupant {
                                port,
                                is_occupied: true,
                                pid,
                                process_name: Some(process_name.clone()),
                                command_line: cmdline,
                                suggested_action: Some(format!(
                                    "检测到进程 '{}' (PID: {:?}) 正在使用该端口。建议点击【自动换用空闲端口启动】自动切换到高位端口避让冲突。",
                                    process_name,
                                    pid.unwrap_or(0)
                                )),
                            };
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("cmd")
                .args(["/C", &format!("netstat -ano -p tcp | findstr :{}", port)])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    if line.contains("LISTENING") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if let Some(pid_str) = parts.last() {
                            let pid: Option<u32> = pid_str.parse().ok();
                            let mut proc_name = None;
                            if let Some(p) = pid {
                                if let Ok(task_out) = Command::new("tasklist")
                                    .args(["/FI", &format!("PID eq {}", p), "/FO", "CSV", "/NH"])
                                    .output()
                                {
                                    let task_csv = String::from_utf8_lossy(&task_out.stdout);
                                    if let Some(first_col) = task_csv.split(',').next() {
                                        let name = first_col.trim_matches('"').trim();
                                        if !name.is_empty() {
                                            proc_name = Some(name.to_string());
                                        }
                                    }
                                }
                            }

                            return PortOccupant {
                                port,
                                is_occupied: true,
                                pid,
                                process_name: proc_name.clone(),
                                command_line: None,
                                suggested_action: Some(format!(
                                    "检测到 Windows 进程 '{}' (PID: {:?}) 正在占用端口。建议点击【自动换用空闲端口启动】避让冲突。",
                                    proc_name.unwrap_or_else(|| "未知系统服务".into()),
                                    pid.unwrap_or(0)
                                )),
                            };
                        }
                    }
                }
            }
        }

        PortOccupant {
            port,
            is_occupied: true,
            pid: None,
            process_name: Some("系统或第三方后台程序".to_string()),
            command_line: None,
            suggested_action: Some("端口已被占用。建议点击【自动换用空闲端口启动】自动分配备用端口（如 18080/18443）。".to_string()),
        }
    }

    /// Register port for a project in SQLite
    pub fn register_port(db: &Database, project_id: &str, port: u16, service: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        db.conn().execute(
            r#"
            INSERT INTO port_registry (project_id, port, service, allocated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(project_id, port) DO UPDATE SET
                service = excluded.service,
                allocated_at = excluded.allocated_at
            "#,
            rusqlite::params![project_id, port as i64, service, now],
        )?;
        Ok(())
    }

    /// Release port registration
    pub fn release_port(db: &Database, project_id: &str, port: u16) -> Result<()> {
        db.conn().execute(
            "DELETE FROM port_registry WHERE project_id = ?1 AND port = ?2",
            rusqlite::params![project_id, port as i64],
        )?;
        Ok(())
    }

    /// List all registered ports
    pub fn list_allocated_ports(db: &Database) -> Result<Vec<PortAllocation>> {
        let mut stmt = db.conn().prepare(
            "SELECT project_id, port, service, allocated_at FROM port_registry ORDER BY port ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PortAllocation {
                project_id: row.get(0)?,
                port: row.get::<_, i64>(1)? as u16,
                service: row.get(2)?,
                allocated_at: row.get(3)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    /// Check if port is in conflict with another project or already bound by OS
    pub fn check_port_conflict(
        db: Option<&Database>,
        port: u16,
        current_project_id: &str,
    ) -> Result<()> {
        // 1. Check database registry for other projects holding this port
        if let Some(database) = db {
            let mut stmt = database.conn().prepare(
                "SELECT project_id, service FROM port_registry WHERE port = ?1 AND project_id != ?2",
            )?;
            let mut rows = stmt.query(rusqlite::params![port as i64, current_project_id])?;
            if let Some(row) = rows.next()? {
                let other_proj: String = row.get(0)?;
                let service: String = row.get(1)?;
                return Err(DevosError::Custom {
                    code: "PORT_OCCUPIED_BY_DEVOS_PROJECT".to_string(),
                    message: format!(
                        "Port {} is already registered by DevOS project '{}' for service '{}'",
                        port, other_proj, service
                    ),
                    hint: Some(format!(
                        "Stop project '{}' or reconfigure its port in devos.json",
                        other_proj
                    )),
                    plain_message: Some(format!(
                        "端口 {} 已被 DevOS 项目 '{}' 的 {} 服务占用，请先停止该项目或更换端口",
                        port, other_proj, service
                    )),
                });
            }
        }

        // 2. Check local OS port binding
        if !Self::is_port_available(port) {
            return Err(DevosError::PortConflict { port });
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_availability() {
        let port = PortRegistry::find_available_port(18000, 18500).unwrap();
        assert!(PortRegistry::is_port_available(port));
    }

    #[test]
    fn test_inspect_free_port() {
        let port = PortRegistry::find_available_port(19000, 19500).unwrap();
        let occ = PortRegistry::inspect_port_occupant(port);
        assert!(!occ.is_occupied);
    }

    #[test]
    fn test_find_free_web_ports() {
        let (http, https) = PortRegistry::find_free_web_ports(80, 443);
        assert!(http > 0);
        assert!(https > 0);
    }
}
