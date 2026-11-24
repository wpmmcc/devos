use crate::error::Result;
use rusqlite::{params, Connection};
use std::path::Path;

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

            CREATE TABLE IF NOT EXISTS recent_projects (
                path TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                project_type TEXT NOT NULL,
                last_opened_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activity_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor TEXT NOT NULL,
                summary_plain TEXT NOT NULL,
                details_json TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS decisions (
                decision_id TEXT PRIMARY KEY,
                project_slug TEXT NOT NULL,
                question_plain TEXT NOT NULL,
                context_plain TEXT NOT NULL,
                options_json TEXT NOT NULL,
                selected_option_id TEXT,
                linked_card_id TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_board_proj ON board_cards(project_id, col);
            CREATE INDEX IF NOT EXISTS idx_issues_proj ON issues(project_id, status);
            CREATE INDEX IF NOT EXISTS idx_assets_proj ON assets(project_id, asset_type);
            CREATE INDEX IF NOT EXISTS idx_activity_proj ON activity_events(project_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_decisions_proj ON decisions(project_slug, status);
            "#,
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

    pub fn add_recent_project(&self, path: &str, name: &str, project_type: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO recent_projects (path, name, project_type, last_opened_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(path) DO UPDATE SET
                name = excluded.name,
                project_type = excluded.project_type,
                last_opened_at = excluded.last_opened_at
            "#,
            params![path, name, project_type, now],
        )?;
        Ok(())
    }

    pub fn remove_recent_project(&self, path: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM recent_projects WHERE path = ?1", params![path])?;
        Ok(())
    }

    pub fn list_recent_projects(&self) -> Result<Vec<(String, String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT path, name, project_type FROM recent_projects ORDER BY last_opened_at DESC LIMIT 10"
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;

        let mut res = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                res.push(item);
            }
        }
        Ok(res)
    }

    pub fn get_last_active_project(&self) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT path FROM recent_projects ORDER BY last_opened_at DESC LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let path: String = row.get(0)?;
            Ok(Some(path))
        } else {
            Ok(None)
        }
    }

    pub fn record_activity(
        &self,
        project_id: &str,
        event_type: &str,
        actor: &str,
        summary_plain: &str,
        details_json: Option<&str>,
    ) -> Result<i64> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO activity_events (project_id, event_type, actor, summary_plain, details_json, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![project_id, event_type, actor, summary_plain, details_json, now],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn list_activities(&self, project_id: &str, limit: usize) -> Result<Vec<ActivityEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, event_type, actor, summary_plain, details_json, created_at
             FROM activity_events WHERE project_id = ?1 ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![project_id, limit as i64], |row| {
            Ok(ActivityEvent {
                id: row.get(0)?,
                project_id: row.get(1)?,
                event_type: row.get(2)?,
                actor: row.get(3)?,
                summary_plain: row.get(4)?,
                details_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }

    pub fn upsert_decision(
        &self,
        decision_id: &str,
        project_slug: &str,
        question_plain: &str,
        context_plain: &str,
        options_json: &str,
        selected_option_id: Option<&str>,
        linked_card_id: Option<&str>,
        status: &str,
        created_at: &str,
    ) -> Result<()> {
        self.conn.execute(
            r#"
            INSERT INTO decisions (decision_id, project_slug, question_plain, context_plain, options_json, selected_option_id, linked_card_id, status, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(decision_id) DO UPDATE SET
                selected_option_id = excluded.selected_option_id,
                status = excluded.status
            "#,
            params![
                decision_id,
                project_slug,
                question_plain,
                context_plain,
                options_json,
                selected_option_id,
                linked_card_id,
                status,
                created_at
            ],
        )?;
        Ok(())
    }

    pub fn list_decisions(
        &self,
        project_slug: Option<&str>,
        status: Option<&str>,
    ) -> Result<Vec<devos_schema::DecisionRequest>> {
        let mut query = "SELECT decision_id, question_plain, context_plain, options_json, selected_option_id, linked_card_id, status, created_at FROM decisions WHERE 1=1".to_string();
        if project_slug.is_some() {
            query.push_str(" AND project_slug = :proj");
        }
        if status.is_some() {
            query.push_str(" AND status = :st");
        }
        query.push_str(" ORDER BY created_at DESC");

        let mut stmt = self.conn.prepare(&query)?;
        let mut param_vec: Vec<(&str, &dyn rusqlite::ToSql)> = Vec::new();
        if let Some(ref p) = project_slug {
            param_vec.push((":proj", p));
        }
        if let Some(ref s) = status {
            param_vec.push((":st", s));
        }

        let rows = stmt.query_map(&param_vec[..], |row| {
            let options_json: String = row.get(3)?;
            let options: Vec<devos_schema::DecisionOption> = serde_json::from_str(&options_json).unwrap_or_default();
            Ok(devos_schema::DecisionRequest {
                decision_id: row.get(0)?,
                question_plain: row.get(1)?,
                context_plain: row.get(2)?,
                options,
                selected_option_id: row.get(4)?,
                linked_card_id: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn resolve_decision(
        &self,
        decision_id: &str,
        selected_option_id: &str,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE decisions SET status = 'resolved', selected_option_id = ?1 WHERE decision_id = ?2",
            params![selected_option_id, decision_id],
        )?;
        Ok(())
    }

    pub fn global_search(
        &self,
        query: &str,
        project_slug: Option<&str>,
    ) -> Result<Vec<devos_schema::SearchResult>> {
        let pattern = format!("%{}%", query.trim());
        let mut results = Vec::new();

        // 1. Search recent_projects
        let mut proj_stmt = self.conn.prepare(
            "SELECT name, path, project_type FROM recent_projects WHERE name LIKE ?1 OR path LIKE ?2 LIMIT 5",
        )?;
        let proj_rows = proj_stmt.query_map(params![pattern, pattern], |row| {
            let name: String = row.get(0)?;
            let path: String = row.get(1)?;
            let ptype: String = row.get(2)?;
            Ok(devos_schema::SearchResult {
                category: "project".to_string(),
                id: path.clone(),
                title: name,
                subtitle: Some(format!("{} · {}", ptype, path)),
                project_slug: None,
            })
        })?;
        for r in proj_rows.flatten() {
            results.push(r);
        }

        // 2. Search board_cards
        let mut card_stmt = self.conn.prepare(
            "SELECT card_id, title, col, project_id FROM board_cards WHERE (title LIKE ?1 OR data_json LIKE ?1) LIMIT 10",
        )?;
        let card_rows = card_stmt.query_map(params![pattern], |row| {
            let card_id: String = row.get(0)?;
            let title: String = row.get(1)?;
            let col: String = row.get(2)?;
            let pid: String = row.get(3)?;
            Ok(devos_schema::SearchResult {
                category: "card".to_string(),
                id: card_id,
                title,
                subtitle: Some(format!("任务看板 · 状态: {}", col)),
                project_slug: Some(pid),
            })
        })?;
        for r in card_rows.flatten() {
            results.push(r);
        }

        // 3. Search issues
        let mut issue_stmt = self.conn.prepare(
            "SELECT issue_id, title, status, severity, project_id FROM issues WHERE (title LIKE ?1 OR data_json LIKE ?1) LIMIT 10",
        )?;
        let issue_rows = issue_stmt.query_map(params![pattern], |row| {
            let issue_id: String = row.get(0)?;
            let title: String = row.get(1)?;
            let status: String = row.get(2)?;
            let severity: String = row.get(3)?;
            let pid: String = row.get(4)?;
            Ok(devos_schema::SearchResult {
                category: "issue".to_string(),
                id: issue_id,
                title,
                subtitle: Some(format!("缺陷 · 状态: {} · 严重度: {}", status, severity)),
                project_slug: Some(pid),
            })
        })?;
        for r in issue_rows.flatten() {
            results.push(r);
        }

        // 4. Search decisions
        let mut dec_stmt = self.conn.prepare(
            "SELECT decision_id, question_plain, status, project_slug FROM decisions WHERE (question_plain LIKE ?1 OR context_plain LIKE ?1) LIMIT 10",
        )?;
        let dec_rows = dec_stmt.query_map(params![pattern], |row| {
            let id: String = row.get(0)?;
            let q: String = row.get(1)?;
            let status: String = row.get(2)?;
            let slug: String = row.get(3)?;
            Ok(devos_schema::SearchResult {
                category: "decision".to_string(),
                id,
                title: q,
                subtitle: Some(format!("AI 决策请求 · {}", status)),
                project_slug: Some(slug),
            })
        })?;
        for r in dec_rows.flatten() {
            results.push(r);
        }

        // 5. System action shortcuts
        let q_lower = query.trim().to_lowercase();
        let actions = [
            ("action:test", "运行测试 (Run Tests)", "在容器中执行测试指令", vec!["test", "run", "测试", "pytest", "cargo"]),
            ("action:rebuild", "重建容器环境 (Rebuild Environment)", "清除缓存并完全重新构建容器", vec!["rebuild", "重建", "docker", "build"]),
            ("action:shell", "打开容器终端 (Open Terminal)", "交互式连接到容器内 CLI Shell", vec!["shell", "terminal", "终端", "bash", "ssh"]),
            ("action:checkpoint", "创建时光机快照 (Create Checkpoint)", "记录当前代码快照 (Refs)", vec!["checkpoint", "快照", "时光机", "vcs", "snapshot"]),
            ("action:trash", "查看项目回收站 (Project Trash)", "恢复或彻底删除已移除的项目", vec!["trash", "回收站", "delete", "remove", "还原"]),
            ("action:mirror", "镜像加速与诊断 (Network Mirrors)", "查看与测试镜像源延迟", vec!["mirror", "加速", "proxy", "network", "网络"]),
        ];

        for (act_id, act_title, act_sub, keywords) in actions {
            if q_lower.is_empty() || keywords.iter().any(|k| act_id.contains(&q_lower) || act_title.to_lowercase().contains(&q_lower) || k.contains(&q_lower)) {
                results.push(devos_schema::SearchResult {
                    category: "action".to_string(),
                    id: act_id.to_string(),
                    title: act_title.to_string(),
                    subtitle: Some(act_sub.to_string()),
                    project_slug: project_slug.map(|s| s.to_string()),
                });
            }
        }

        Ok(results)
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ActivityEvent {
    pub id: i64,
    pub project_id: String,
    pub event_type: String,
    pub actor: String,
    pub summary_plain: String,
    pub details_json: Option<String>,
    pub created_at: String,
}
