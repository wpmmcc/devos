use std::path::Path;
use devos_schema::{BoardCard, BoardColumn, ChecklistStep, DevosProject};
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};

pub struct BoardManager;

impl BoardManager {
    /// List all cards in the project
    pub fn list_cards(root: &Path, project: &DevosProject) -> Result<Vec<BoardCard>> {
        let board_dir = root.join(&project.workspace_paths.board);
        let mut cards = Vec::new();
        if !board_dir.exists() {
            return Ok(cards);
        }

        for entry in std::fs::read_dir(board_dir)?.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(card) = read_json::<_, BoardCard>(&path) {
                    cards.push(card);
                }
            }
        }

        // Sort by card_id
        cards.sort_by(|a, b| a.card_id.cmp(&b.card_id));
        Ok(cards)
    }

    /// Read a specific card
    pub fn get_card(root: &Path, project: &DevosProject, card_id: &str) -> Result<BoardCard> {
        let path = root
            .join(&project.workspace_paths.board)
            .join(format!("{}.json", card_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "CARD_NOT_FOUND".to_string(),
                message: format!("Board card {} not found", card_id),
                hint: Some("Check the card ID in the board view.".to_string()),
                plain_message: Some(format!("未找到编号为 {} 的看板卡片", card_id)),
            });
        }
        read_json(&path)
    }

    /// Create or update a board card with guardrail checks
    pub fn upsert_card(
        root: &Path,
        project: &DevosProject,
        card_id: Option<String>,
        title: Option<String>,
        column: BoardColumn,
        updated_by: &str,
        linked_req_id: Option<String>,
        note: Option<String>,
    ) -> Result<BoardCard> {
        let board_dir = root.join(&project.workspace_paths.board);
        std::fs::create_dir_all(&board_dir)?;

        let mut card = match card_id {
            Some(id) => {
                let path = board_dir.join(format!("{}.json", id));
                if path.exists() {
                    read_json::<_, BoardCard>(&path)?
                } else {
                    let card_title = title.clone().unwrap_or_else(|| "未命名任务".to_string());
                    BoardCard::new(id, card_title, updated_by.to_string())
                }
            }
            None => {
                // Generate next card ID like CARD-001
                let existing = Self::list_cards(root, project)?;
                let next_idx = existing.len() + 1;
                let id = format!("CARD-{:03}", next_idx);
                let card_title = title.clone().unwrap_or_else(|| "未命名任务".to_string());
                BoardCard::new(id, card_title, updated_by.to_string())
            }
        };

        // Guardrail: Prohibit Agent from moving directly to Done skipping Testing
        if updated_by == "agent" && matches!(column, BoardColumn::Done) {
            if !matches!(card.column, BoardColumn::Testing) {
                return Err(DevosError::GuardrailBlocked {
                    code: "GUARDRAIL_AGENT_DONE_BLOCKED".to_string(),
                    reason: "Agent cannot move card directly to Done without passing Testing.".to_string(),
                    hint: "Call `submit_for_testing` to put the card into the Testing column with acceptance criteria first.".to_string(),
                    plain_message: "开发护栏拦截：AI 助手不能跳过提测验收直接将卡片移至“已完成”。请先提交测试单供用户验收。".to_string(),
                });
            }
        }

        if let Some(t) = title {
            card.title = t;
        }
        card.column = column;
        card.updated_by = updated_by.to_string();
        card.updated_at = chrono::Utc::now().to_rfc3339();
        if let Some(req_id) = linked_req_id {
            card.linked_req_id = Some(req_id);
        }
        if let Some(n) = note {
            card.summary_plain = Some(n);
        }

        let path = board_dir.join(format!("{}.json", card.card_id));
        atomic_write_json(&path, &card)?;
        Ok(card)
    }

    /// Submit a card for testing (Tool 5: submit_for_testing)
    pub fn submit_for_testing(
        root: &Path,
        project: &DevosProject,
        card_id: &str,
        summary_plain: &str,
        checklist_steps: Vec<ChecklistStep>,
        run_target_ids: Vec<String>,
    ) -> Result<BoardCard> {
        let board_dir = root.join(&project.workspace_paths.board);
        let path = board_dir.join(format!("{}.json", card_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "CARD_NOT_FOUND".to_string(),
                message: format!("Board card {} not found", card_id),
                hint: Some("Verify card ID exists before submitting for testing.".to_string()),
                plain_message: Some(format!("提测失败：未找到卡片 {}", card_id)),
            });
        }

        let mut card: BoardCard = read_json(&path)?;
        card.column = BoardColumn::Testing;
        card.summary_plain = Some(summary_plain.to_string());
        card.checklist = checklist_steps;
        card.run_target_ids = run_target_ids;
        card.updated_by = "agent".to_string();
        card.updated_at = chrono::Utc::now().to_rfc3339();

        atomic_write_json(&path, &card)?;
        Ok(card)
    }
}
