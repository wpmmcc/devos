use std::fs;
use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use crate::error::Result;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StorageReport {
    pub artifacts_bytes: u64,
    pub logs_bytes: u64,
    pub checkpoints_bytes: u64,
    pub total_project_bytes: u64,
    pub host_available_gb: f64,
    pub low_disk_warning: bool,
}

pub struct StorageCleaner;

impl StorageCleaner {
    /// Calculate disk storage usage for artifacts, logs, and checkpoints
    pub fn calculate_storage_usage(root: &Path) -> StorageReport {
        let mut artifacts_bytes = 0u64;
        let mut logs_bytes = 0u64;
        let mut checkpoints_bytes = 0u64;

        let artifacts_dir = root.join(".devos").join("artifacts");
        if artifacts_dir.exists() {
            for entry in WalkDir::new(&artifacts_dir).into_iter().flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        artifacts_bytes += meta.len();
                    }
                }
            }
        }

        let logs_dir = root.join(".devos").join("logs");
        if logs_dir.exists() {
            for entry in WalkDir::new(&logs_dir).into_iter().flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        logs_bytes += meta.len();
                    }
                }
            }
        }

        let cp_dir = root.join(".devos").join("checkpoints");
        if cp_dir.exists() {
            for entry in WalkDir::new(&cp_dir).into_iter().flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        checkpoints_bytes += meta.len();
                    }
                }
            }
        }

        let total_project_bytes = artifacts_bytes + logs_bytes + checkpoints_bytes;

        // Estimate host available disk space
        let mut host_available_gb = 50.0;
        #[cfg(unix)]
        {
            let df_out = Command::new("df")
                .args(["-g", &root.display().to_string()])
                .output();
            if let Ok(out) = df_out {
                let s = String::from_utf8_lossy(&out.stdout);
                for line in s.lines().skip(1) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        if let Ok(avail) = parts[3].parse::<f64>() {
                            host_available_gb = avail;
                            break;
                        }
                    }
                }
            }
        }

        let low_disk_warning = host_available_gb < 5.0;

        StorageReport {
            artifacts_bytes,
            logs_bytes,
            checkpoints_bytes,
            total_project_bytes,
            host_available_gb,
            low_disk_warning,
        }
    }

    /// Clean expired artifacts (e.g. screenshots or test outputs older than N days)
    pub fn clean_expired_artifacts(root: &Path, older_than_days: u64) -> Result<u64> {
        let artifacts_dir = root.join(".devos").join("artifacts");
        if !artifacts_dir.exists() {
            return Ok(0);
        }

        let max_age = std::time::Duration::from_secs(older_than_days * 86400);
        let mut freed_bytes = 0u64;

        for entry in WalkDir::new(&artifacts_dir).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(elapsed) = modified.elapsed() {
                            if elapsed > max_age {
                                freed_bytes += meta.len();
                                let _ = fs::remove_file(entry.path());
                            }
                        }
                    }
                }
            }
        }

        Ok(freed_bytes)
    }

    /// Prune dangling containers and images tagged strictly with com.devos.managed=true
    pub fn prune_managed_docker_cache() -> Result<()> {
        let _ = Command::new("docker")
            .args(["image", "prune", "-f", "--filter", "label=com.devos.managed=true"])
            .output();
        Ok(())
    }
}
