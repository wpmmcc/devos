use std::net::TcpListener;
use crate::db::Database;
use crate::error::{DevosError, Result};

pub struct PortRegistry;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PortAllocation {
    pub project_id: String,
    pub port: u16,
    pub service: String,
    pub allocated_at: String,
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
            message: format!("No available port found in range {}-{}", start_port, end_port),
            hint: Some("Check and terminate running background services.".to_string()),
            plain_message: Some(format!("在端口范围 {}-{} 内未找到可用空闲端口", start_port, end_port)),
        })
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
                    hint: Some(format!("Stop project '{}' or reconfigure its port in devos.json", other_proj)),
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
}
