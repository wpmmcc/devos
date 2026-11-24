use crate::db::Database;
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};
use devos_schema::{DecisionOption, DecisionRequest};
use std::fs;
use std::path::Path;

pub struct DecisionManager;

impl DecisionManager {
    /// Create and persist a new decision request
    pub fn create_decision(
        project_root: &Path,
        project_slug: &str,
        question_plain: &str,
        context_plain: &str,
        options: Vec<DecisionOption>,
        linked_card_id: Option<&str>,
        db: Option<&Database>,
    ) -> Result<DecisionRequest> {
        let dec_dir = project_root.join("decisions");
        fs::create_dir_all(&dec_dir)?;

        let decision_id = format!("DEC-{}", uuid::Uuid::new_v4().simple());
        let now = chrono::Utc::now().to_rfc3339();

        let req = DecisionRequest {
            decision_id: decision_id.clone(),
            question_plain: question_plain.to_string(),
            context_plain: context_plain.to_string(),
            options: options.clone(),
            selected_option_id: None,
            linked_card_id: linked_card_id.map(|s| s.to_string()),
            status: "pending".to_string(),
            created_at: now.clone(),
        };

        // 1. Write file decisions/DEC-xxxx.json
        let file_path = dec_dir.join(format!("{}.json", decision_id));
        atomic_write_json(&file_path, &req)?;

        // 2. Index into SQLite if available
        if let Some(database) = db {
            let options_json = serde_json::to_string(&options).unwrap_or_default();
            let _ = database.upsert_decision(
                &decision_id,
                project_slug,
                question_plain,
                context_plain,
                &options_json,
                None,
                linked_card_id,
                "pending",
                &now,
            );
        }

        Ok(req)
    }

    /// List decisions for a project, optionally filtering by status ("pending" | "resolved")
    pub fn list_decisions(
        project_root: &Path,
        project_slug: Option<&str>,
        status: Option<&str>,
        db: Option<&Database>,
    ) -> Result<Vec<DecisionRequest>> {
        // Try reading from SQLite first if available
        if let Some(database) = db {
            if let Ok(list) = database.list_decisions(project_slug, status) {
                if !list.is_empty() {
                    return Ok(list);
                }
            }
        }

        // Fallback to directory scan
        let dec_dir = project_root.join("decisions");
        if !dec_dir.exists() {
            return Ok(Vec::new());
        }

        let mut list = Vec::new();
        for entry in fs::read_dir(dec_dir)?.flatten() {
            let p = entry.path();
            if p.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(req) = read_json::<_, DecisionRequest>(&p) {
                    if let Some(st) = status {
                        if req.status != st {
                            continue;
                        }
                    }
                    list.push(req);
                }
            }
        }

        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(list)
    }

    /// Resolve a decision by selecting an option ID
    pub fn resolve_decision(
        project_root: &Path,
        decision_id: &str,
        selected_option_id: &str,
        db: Option<&Database>,
    ) -> Result<DecisionRequest> {
        let file_path = project_root.join("decisions").join(format!("{}.json", decision_id));
        let mut req: DecisionRequest = if file_path.exists() {
            read_json(&file_path)?
        } else {
            return Err(DevosError::Custom {
                code: "DECISION_NOT_FOUND".to_string(),
                message: format!("Decision {} not found", decision_id),
                hint: None,
                plain_message: Some(format!("未找到待决策项 {}", decision_id)),
            });
        };

        // Verify option exists
        if !req.options.iter().any(|o| o.id == selected_option_id) {
            return Err(DevosError::Custom {
                code: "INVALID_OPTION".to_string(),
                message: format!("Option {} not in decision options", selected_option_id),
                hint: None,
                plain_message: Some(format!("所选选项 {} 不在决策备选项中", selected_option_id)),
            });
        }

        req.status = "resolved".to_string();
        req.selected_option_id = Some(selected_option_id.to_string());

        // Update file
        atomic_write_json(&file_path, &req)?;

        // Update SQLite
        if let Some(database) = db {
            let _ = database.resolve_decision(decision_id, selected_option_id);
        }

        Ok(req)
    }
}
