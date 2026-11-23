use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use crate::error::{DevosError, Result};

#[derive(Debug, Clone, PartialEq)]
pub enum ProjectChangeEvent {
    BoardUpdated { card_id: Option<String> },
    IssueUpdated { issue_id: Option<String> },
    ManifestUpdated,
    StandardUpdated,
    Other,
}

pub struct ProjectWatcher {
    _watcher: RecommendedWatcher,
}

impl ProjectWatcher {
    /// Start watching the project directory for changes to board/, issues/, devos.json, standards/
    pub fn watch<P, F>(root: P, on_change: F) -> Result<Self>
    where
        P: AsRef<Path>,
        F: Fn(ProjectChangeEvent, PathBuf) + Send + Sync + 'static,
    {
        let root_path = root.as_ref().to_path_buf();
        let callback = Arc::new(on_change);

        let mut watcher = RecommendedWatcher::new(
            move |res: std::result::Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    // Only react to file creation, modification, or removal
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {}
                        _ => return,
                    }

                    for path in event.paths {
                        // Skip temporary files from atomic_write
                        if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
                            if file_name.starts_with('.') && file_name.contains(".tmp.") {
                                continue;
                            }
                        }

                        let relative = path.strip_prefix(&root_path).unwrap_or(&path);
                        let rel_str = relative.to_string_lossy();

                        let change_type = if rel_str.starts_with("board/") && rel_str.ends_with(".json") {
                            let card_id = path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string());
                            ProjectChangeEvent::BoardUpdated { card_id }
                        } else if rel_str.starts_with("issues/") && rel_str.ends_with(".json") {
                            let issue_id = path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string());
                            ProjectChangeEvent::IssueUpdated { issue_id }
                        } else if rel_str == "devos.json" || rel_str == "devos.run.json" {
                            ProjectChangeEvent::ManifestUpdated
                        } else if rel_str.starts_with("standards/") {
                            ProjectChangeEvent::StandardUpdated
                        } else {
                            ProjectChangeEvent::Other
                        };

                        if change_type != ProjectChangeEvent::Other {
                            callback(change_type, path);
                        }
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| DevosError::Custom {
            code: "WATCHER_INIT_ERROR".to_string(),
            message: e.to_string(),
            hint: None,
            plain_message: Some("初始化本地文件监听器失败".to_string()),
        })?;

        watcher
            .watch(root.as_ref(), RecursiveMode::Recursive)
            .map_err(|e| DevosError::Custom {
                code: "WATCHER_START_ERROR".to_string(),
                message: e.to_string(),
                hint: None,
                plain_message: Some("启动本地文件监听器失败".to_string()),
            })?;

        Ok(Self { _watcher: watcher })
    }
}
