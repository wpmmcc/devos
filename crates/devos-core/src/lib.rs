pub mod board;
pub mod daemon;
pub mod db;
pub mod error;
pub mod fs_utils;
pub mod issue;
pub mod port;
pub mod project;
pub mod watcher;

pub use board::BoardManager;
pub use daemon::DaemonManager;
pub use db::Database;
pub use error::{DevosError, Result};
pub use fs_utils::{atomic_write, atomic_write_json, ensure_within_root, read_json, read_to_string, to_posix_path};
pub use issue::IssueManager;
pub use port::PortRegistry;
pub use project::ProjectManager;
pub use watcher::{ProjectChangeEvent, ProjectWatcher};

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use devos_schema::{BoardColumn, ProjectType};

    #[test]
    fn test_project_init_and_board_lifecycle() {
        let dir = tempdir().unwrap();
        let project_dir = dir.path().join("my-project");
        let db = Database::open(":memory:").unwrap();

        // 1. Init project
        let project = ProjectManager::init_project(
            &project_dir,
            "my-project",
            "My Project",
            "Description of project",
            ProjectType::Hybrid,
            Some(&db),
        ).unwrap();

        assert_eq!(project.slug, "my-project");
        assert!(project_dir.join("devos.json").exists());
        assert!(project_dir.join("AGENTS.md").exists());
        assert!(project_dir.join("devos.run.json").exists());

        // 2. Upsert board card
        let card = BoardManager::upsert_card(
            &project_dir,
            &project,
            None,
            Some("实现数据导出功能".to_string()),
            BoardColumn::Todo,
            "user",
            None,
            None,
        ).unwrap();
        assert_eq!(card.card_id, "CARD-001");

        // 3. Agent cannot move to Done directly
        let err = BoardManager::upsert_card(
            &project_dir,
            &project,
            Some("CARD-001".to_string()),
            None,
            BoardColumn::Done,
            "agent",
            None,
            None,
        );
        assert!(err.is_err());

        // 4. Submit for testing
        let submitted = BoardManager::submit_for_testing(
            &project_dir,
            &project,
            "CARD-001",
            "数据导出模块已完成，提供 3 条验收测试",
            vec![
                devos_schema::ChecklistStep {
                    step: 1,
                    action: "运行脚本".to_string(),
                    expected: "生成 xlsx 文件".to_string(),
                    checked: false,
                }
            ],
            vec!["export_task".to_string()],
        ).unwrap();
        assert_eq!(submitted.column, BoardColumn::Testing);

        // 5. Create issue
        let issue = IssueManager::create_issue(
            &project_dir,
            &project,
            "导出文件字段缺失",
            "测试时发现导出的 Excel 缺少金额列",
            Some("应包含金额列".to_string()),
            devos_schema::IssueSeverity::High,
            devos_schema::SourceType::ScriptRun,
            devos_schema::CapturedContext::default(),
            Some("CARD-001".to_string()),
            Some(1),
        ).unwrap();
        assert_eq!(issue.issue_id, "ISS-001");

        // 6. Resolve issue
        let resolved = IssueManager::resolve_issue(
            &project_dir,
            &project,
            "ISS-001",
            "已在 scripts/export.py 中补充 amount 字段映射",
            vec!["scripts/export.py".to_string()],
            Some(("Excel 导出字段映射规范".to_string(), "导出字段必须全量包含 schema 字段。".to_string())),
        ).unwrap();
        assert_eq!(resolved.status, devos_schema::IssueStatus::ReadyForRetest);
        assert!(project_dir.join("knowledge/KB-ISS-001.md").exists());
    }
}
