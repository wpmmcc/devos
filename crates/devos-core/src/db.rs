use rusqlite::{params, Connection};
use std::path::Path;
use crate::error::Result;

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open SQLite database at the specified path (or in-memory if path is ":memory:")
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = if path.as_ref().to_str() == Some(":memory:") {
            Connection::open_in_memory()?
        } else {
            if let Some(parent) = path.as_ref().parent() {
                std::fs::create_dir_all(parent)?;
            }
            Connection::open(path)?
        };

        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// Open standard global database at ~/.devos/index.sqlite
    pub fn open_global() -> Result<Self> {
        let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        let db_path = home.join(".devos").join("index.sqlite");
        Self::open(db_path)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS projects (
                project_id TEXT PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                project_type TEXT NOT NULL,
                mode TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS board_cards (
                card_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                col TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS issues (
                issue_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                status TEXT NOT NULL,
                severity TEXT NOT NULL,
                source_type TEXT NOT NULL,
                title TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS port_registry (
                project_id TEXT NOT NULL,
                port INTEGER NOT NULL,
                service TEXT NOT NULL,
                allocated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, port)
            );

            CREATE TABLE IF NOT EXISTS assets (
                asset_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                title TEXT NOT NULL,
                tags TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_board_proj ON board_cards(project_id, col);
            CREATE INDEX IF NOT EXISTS idx_issues_proj ON issues(project_id, status);
            CREATE INDEX IF NOT EXISTS idx_assets_proj ON assets(project_id, asset_type);
            "#
        )?;
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn upsert_project(
        &self,
        project_id: &str,
        slug: &str,
        name: &str,
        path: &str,
        project_type: &str,
        mode: &str,
        created_at: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO projects (project_id, slug, name, path, project_type, mode, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(project_id) DO UPDATE SET
                slug = excluded.slug,
                name = excluded.name,
                path = excluded.path,
                project_type = excluded.project_type,
                mode = excluded.mode,
                updated_at = excluded.updated_at
            "#,
            params![project_id, slug, name, path, project_type, mode, created_at, now],
        )?;
        Ok(())
    }

    pub fn upsert_board_card(
        &self,
        card_id: &str,
        project_id: &str,
        title: &str,
        col: &str,
        updated_by: &str,
        data_json: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO board_cards (card_id, project_id, title, col, updated_by, data_json, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(card_id) DO UPDATE SET
                title = excluded.title,
                col = excluded.col,
                updated_by = excluded.updated_by,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            "#,
            params![card_id, project_id, title, col, updated_by, data_json, now],
        )?;
        Ok(())
    }

    pub fn upsert_issue(
        &self,
        issue_id: &str,
        project_id: &str,
        status: &str,
        severity: &str,
        source_type: &str,
        title: &str,
        data_json: &str,
        created_at: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO issues (issue_id, project_id, status, severity, source_type, title, data_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(issue_id) DO UPDATE SET
                status = excluded.status,
                severity = excluded.severity,
                source_type = excluded.source_type,
                title = excluded.title,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            "#,
            params![issue_id, project_id, status, severity, source_type, title, data_json, created_at, now],
        )?;
        Ok(())
    }
}
