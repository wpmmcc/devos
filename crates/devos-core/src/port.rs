use std::net::TcpListener;
use crate::db::Database;
use crate::error::{DevosError, Result};

pub struct PortRegistry;

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
}
