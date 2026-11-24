use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Checkpoint {
    pub id: String,
    pub created_at: String,
    pub note: String,
    pub source: String, // "agent_auto" | "user_manual"
    pub commit_ref: Option<String>,
}

pub struct CheckpointManager;

impl CheckpointManager {
    fn checkpoints_dir(root: &Path) -> PathBuf {
        root.join(".devos").join("checkpoints")
    }

    /// List all checkpoints sorted by creation time descending
    pub fn list_checkpoints(root: &Path) -> Result<Vec<Checkpoint>> {
        let dir = Self::checkpoints_dir(root);
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut list = Vec::new();
        for entry in fs::read_dir(dir)?.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(cp) = read_json::<_, Checkpoint>(&path) {
                    list.push(cp);
                }
            }
        }

        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(list)
    }

    /// Create a lightweight snapshot.
    /// If .git exists, it saves a tree snapshot to hidden ref `refs/devos/checkpoints/<id>`,
    /// which NEVER pollutes the user's working branch or git commit log.
    pub fn create_checkpoint(root: &Path, note: &str, source: &str) -> Result<Checkpoint> {
        let dir = Self::checkpoints_dir(root);
        fs::create_dir_all(&dir)?;

        let id = format!("cp_{}", uuid::Uuid::new_v4().simple());
        let now = chrono::Utc::now().to_rfc3339();
        let mut commit_ref = None;

        // Ensure .gitignore has devos temp patterns
        let gitignore = root.join(".gitignore");
        if gitignore.exists() {
            if let Ok(mut content) = fs::read_to_string(&gitignore) {
                let required = [".devos/artifacts/", ".devos/logs/", ".env", "releases/"];
                let mut modified = false;
                for pat in required {
                    if !content.contains(pat) {
                        content.push_str(&format!("\n{}", pat));
                        modified = true;
                    }
                }
                if modified {
                    let _ = fs::write(&gitignore, content);
                }
            }
        }

        let git_dir = root.join(".git");
        if git_dir.exists() {
            // Stage changes
            let _ = Command::new("git")
                .args(["add", "-A"])
                .current_dir(root)
                .output();

            // Write tree
            let tree_out = Command::new("git")
                .args(["write-tree"])
                .current_dir(root)
                .output();

            if let Ok(out) = tree_out {
                if out.status.success() {
                    let tree_id = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !tree_id.is_empty() {
                        // Create detached commit
                        let commit_out = Command::new("git")
                            .args([
                                "commit-tree",
                                &tree_id,
                                "-m",
                                &format!("DevOS Checkpoint: {}", note),
                            ])
                            .current_dir(root)
                            .output();

                        if let Ok(cout) = commit_out {
                            if cout.status.success() {
                                let commit_id =
                                    String::from_utf8_lossy(&cout.stdout).trim().to_string();
                                // Update hidden ref: refs/devos/checkpoints/<id>
                                let ref_name = format!("refs/devos/checkpoints/{}", id);
                                let _ = Command::new("git")
                                    .args(["update-ref", &ref_name, &commit_id])
                                    .current_dir(root)
                                    .output();
                                commit_ref = Some(ref_name);
                            }
                        }
                    }
                }
            }
        }

        let checkpoint = Checkpoint {
            id: id.clone(),
            created_at: now,
            note: note.to_string(),
            source: source.to_string(),
            commit_ref,
        };

        let path = dir.join(format!("{}.json", id));
        atomic_write_json(&path, &checkpoint)?;

        Ok(checkpoint)
    }

    /// Restore to a previous checkpoint
    pub fn restore_checkpoint(root: &Path, checkpoint_id: &str) -> Result<()> {
        let dir = Self::checkpoints_dir(root);
        let path = dir.join(format!("{}.json", checkpoint_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "CHECKPOINT_NOT_FOUND".to_string(),
                message: format!("Checkpoint {} not found", checkpoint_id),
                hint: None,
                plain_message: Some(format!("未找到编号为 {} 的历史快照", checkpoint_id)),
            });
        }

        let cp: Checkpoint = read_json(&path)?;
        if let Some(ref_name) = cp.commit_ref {
            // Restore working tree cleanly using git read-tree
            let res = Command::new("git")
                .args(["read-tree", "-u", "--reset", &ref_name])
                .current_dir(root)
                .output();

            match res {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => Err(DevosError::Custom {
                    code: "CHECKPOINT_RESTORE_FAILED".to_string(),
                    message: String::from_utf8_lossy(&out.stderr).to_string(),
                    hint: Some("Inspect git status for conflicted working files.".to_string()),
                    plain_message: Some(
                        "历史时光机还原失败，请检查工作区是否有未保存文件".to_string(),
                    ),
                }),
                Err(e) => Err(DevosError::Io(e)),
            }
        } else {
            Err(DevosError::Custom {
                code: "CHECKPOINT_NO_GIT_REF".to_string(),
                message: "No git snapshot available for this checkpoint".to_string(),
                hint: None,
                plain_message: Some("该快照缺少有效的代码镜像版本".to_string()),
            })
        }
    }

    /// Compare checkpoint with current working directory to show modified files and diff preview
    pub fn get_checkpoint_diff(
        root: &Path,
        checkpoint_id: &str,
    ) -> Result<Vec<devos_schema::FileDiffItem>> {
        let dir = Self::checkpoints_dir(root);
        let path = dir.join(format!("{}.json", checkpoint_id));
        if !path.exists() {
            return Err(DevosError::Custom {
                code: "CHECKPOINT_NOT_FOUND".to_string(),
                message: format!("Checkpoint {} not found", checkpoint_id),
                hint: None,
                plain_message: Some(format!("未找到编号为 {} 的历史快照", checkpoint_id)),
            });
        }

        let cp: Checkpoint = read_json(&path)?;
        let commit_ref = match cp.commit_ref {
            Some(r) => r,
            None => return Ok(Vec::new()),
        };

        let out_numstat = Command::new("git")
            .args(["diff", "--numstat", &commit_ref])
            .current_dir(root)
            .output();

        let mut diff_items = Vec::new();
        if let Ok(out) = out_numstat {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let additions = parts[0].parse::<usize>().unwrap_or(0);
                    let deletions = parts[1].parse::<usize>().unwrap_or(0);
                    let file_path = parts[2..].join(" ");

                    let patch_out = Command::new("git")
                        .args(["diff", "-U2", &commit_ref, "--", &file_path])
                        .current_dir(root)
                        .output();
                    let preview = patch_out.ok().map(|o| {
                        let full = String::from_utf8_lossy(&o.stdout);
                        full.lines().take(50).collect::<Vec<_>>().join("\n")
                    });

                    let status = if additions > 0 && deletions == 0 {
                        "added"
                    } else if additions == 0 && deletions > 0 {
                        "deleted"
                    } else {
                        "modified"
                    };

                    diff_items.push(devos_schema::FileDiffItem {
                        path: file_path,
                        status: status.to_string(),
                        additions,
                        deletions,
                        diff_preview: preview,
                    });
                }
            }
        }

        Ok(diff_items)
    }
}
