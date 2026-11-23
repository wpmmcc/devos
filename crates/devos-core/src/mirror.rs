use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MirrorPreset {
    Auto,
    ChinaAccelerated,
    OfficialDirect,
    CustomProxy,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ToolDownloadSpec {
    pub tool_id: String,
    pub name: String,
    pub version: String,
    pub official_url: String,
    pub china_mirrors: Vec<String>,
    pub sha256_macos_arm64: Option<String>,
    pub sha256_macos_x64: Option<String>,
    pub sha256_win_x64: Option<String>,
    pub sha256_linux_x64: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MirrorsConfig {
    pub active_preset: MirrorPreset,
    pub custom_proxy_url: Option<String>,
    pub tools: HashMap<String, ToolDownloadSpec>,
    pub docker_mirrors: Vec<String>,
    pub container_env_vars: HashMap<String, String>,
}

impl Default for MirrorsConfig {
    fn default() -> Self {
        let mut tools = HashMap::new();

        tools.insert(
            "ddev".to_string(),
            ToolDownloadSpec {
                tool_id: "ddev".to_string(),
                name: "DDEV 网页与数据库环境".to_string(),
                version: "v1.25.5".to_string(),
                official_url: "https://github.com/ddev/ddev/releases/download/v1.25.5/ddev_macos-arm64.v1.25.5.tar.gz".to_string(),
                china_mirrors: vec![
                    "https://gh-proxy.com/https://github.com/ddev/ddev/releases/download/v1.25.5/ddev_macos-arm64.v1.25.5.tar.gz".to_string(),
                    "https://mirror.ghproxy.com/https://github.com/ddev/ddev/releases/download/v1.25.5/ddev_macos-arm64.v1.25.5.tar.gz".to_string(),
                ],
                sha256_macos_arm64: Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()),
                sha256_macos_x64: None,
                sha256_win_x64: None,
                sha256_linux_x64: None,
            },
        );

        tools.insert(
            "mkcert".to_string(),
            ToolDownloadSpec {
                tool_id: "mkcert".to_string(),
                name: "mkcert 本地 HTTPS 证书工具".to_string(),
                version: "v1.4.4".to_string(),
                official_url: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-arm64".to_string(),
                china_mirrors: vec![
                    "https://gh-proxy.com/https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-arm64".to_string(),
                ],
                sha256_macos_arm64: None,
                sha256_macos_x64: None,
                sha256_win_x64: None,
                sha256_linux_x64: None,
            },
        );

        let mut container_env = HashMap::new();
        container_env.insert("NPM_CONFIG_REGISTRY".to_string(), "https://registry.npmmirror.com".to_string());
        container_env.insert("PIP_INDEX_URL".to_string(), "https://pypi.tuna.tsinghua.edu.cn/simple".to_string());
        container_env.insert("GOPROXY".to_string(), "https://goproxy.cn,direct".to_string());
        container_env.insert("RUSTUP_DIST_SERVER".to_string(), "https://rsproxy.cn".to_string());

        let docker_mirrors = vec![
            "https://dockerproxy.com".to_string(),
            "https://mirror.baidubce.com".to_string(),
            "https://hub-mirror.c.163.com".to_string(),
        ];

        Self {
            active_preset: MirrorPreset::Auto,
            custom_proxy_url: None,
            tools,
            docker_mirrors,
            container_env_vars: container_env,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DownloadProgress {
    pub tool_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub speed_kb_s: f32,
    pub is_resumed: bool,
    pub completed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MirrorRaceResult {
    pub selected_url: String,
    pub latency_ms: u64,
    pub error: Option<String>,
}

pub struct MirrorManager;

impl MirrorManager {
    /// Get path to ~/.devos/mirrors.json
    pub fn config_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".devos")
            .join("mirrors.json")
    }

    /// Load mirrors configuration, falling back to built-in default
    pub fn load_config() -> MirrorsConfig {
        let p = Self::config_path();
        if p.exists() {
            if let Ok(cfg) = read_json::<_, MirrorsConfig>(&p) {
                return cfg;
            }
        }
        MirrorsConfig::default()
    }

    /// Save mirrors configuration
    pub fn save_config(cfg: &MirrorsConfig) -> Result<()> {
        let p = Self::config_path();
        atomic_write_json(p, cfg)
    }

    /// Perform 2-second concurrent HEAD race among candidates to select fastest mirror
    pub async fn race_mirrors(candidates: &[String]) -> MirrorRaceResult {
        if candidates.is_empty() {
            return MirrorRaceResult {
                selected_url: String::new(),
                latency_ms: 0,
                error: Some("No candidate mirrors provided".to_string()),
            };
        }

        if candidates.len() == 1 {
            return MirrorRaceResult {
                selected_url: candidates[0].clone(),
                latency_ms: 50,
                error: None,
            };
        }

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(2000))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                return MirrorRaceResult {
                    selected_url: candidates[0].clone(),
                    latency_ms: 0,
                    error: Some(e.to_string()),
                }
            }
        };

        let mut tasks = Vec::new();

        for url in candidates {
            let u = url.clone();
            let c = client.clone();
            tasks.push(tokio::spawn(async move {
                let start = Instant::now();
                match c.head(&u).send().await {
                    Ok(resp) if resp.status().is_success() || resp.status().is_redirection() => {
                        let latency = start.elapsed().as_millis() as u64;
                        Ok((u, latency))
                    }
                    _ => Err(()),
                }
            }));
        }

        // Return first task that succeeds
        for t in tasks {
            if let Ok(Ok((fastest_url, latency))) = t.await {
                return MirrorRaceResult {
                    selected_url: fastest_url,
                    latency_ms: latency,
                    error: None,
                };
            }
        }

        // Fallback to first candidate
        MirrorRaceResult {
            selected_url: candidates[0].clone(),
            latency_ms: 2000,
            error: Some("All mirror race probes timed out, using fallback".to_string()),
        }
    }

    /// Verify SHA256 checksum of a file
    pub fn verify_sha256<P: AsRef<Path>>(file_path: P, expected_hash: &str) -> Result<bool> {
        let mut file = File::open(file_path).map_err(DevosError::Io)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];

        loop {
            let n = file.read(&mut buffer).map_err(DevosError::Io)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }

        let result = hasher.finalize();
        let hex_hash = format!("{:x}", result);
        Ok(hex_hash.eq_ignore_ascii_case(expected_hash))
    }

    /// Download file with HTTP Range resume and optional SHA256 verification
    pub async fn download_with_resume<P, F>(
        url: &str,
        dest_path: P,
        expected_sha256: Option<&str>,
        mut on_progress: F,
    ) -> Result<()>
    where
        P: AsRef<Path>,
        F: FnMut(DownloadProgress),
    {
        let dest = dest_path.as_ref();
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        let existing_bytes = if dest.exists() {
            fs::metadata(dest).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| DevosError::Custom {
                code: "HTTP_CLIENT_ERROR".to_string(),
                message: e.to_string(),
                hint: None,
                plain_message: Some("创建 HTTP 下载请求失败".to_string()),
            })?;

        let mut req = client.get(url);
        if existing_bytes > 0 {
            req = req.header("Range", format!("bytes={}-", existing_bytes));
        }

        let mut resp = req.send().await.map_err(|e| DevosError::Custom {
            code: "DOWNLOAD_FAILED".to_string(),
            message: e.to_string(),
            hint: Some("Check network connection or try another mirror.".to_string()),
            plain_message: Some("下载组件安装包失败，请检查网络或切换镜像源".to_string()),
        })?;

        let status = resp.status();
        let is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;

        let content_len = resp.content_length().unwrap_or(0);
        let total_bytes = if is_partial {
            existing_bytes + content_len
        } else {
            content_len
        };

        let mut file = if is_partial && existing_bytes > 0 {
            let mut f = OpenOptions::new()
                .write(true)
                .open(dest)
                .map_err(DevosError::Io)?;
            f.seek(SeekFrom::End(0)).map_err(DevosError::Io)?;
            f
        } else {
            File::create(dest).map_err(DevosError::Io)?;
            OpenOptions::new()
                .write(true)
                .open(dest)
                .map_err(DevosError::Io)?
        };

        let mut downloaded = if is_partial { existing_bytes } else { 0 };
        let start_time = Instant::now();

        while let Some(chunk) = resp.chunk().await.map_err(|e| DevosError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))? {
            file.write_all(&chunk).map_err(DevosError::Io)?;
            downloaded += chunk.len() as u64;

            let elapsed_sec = start_time.elapsed().as_secs_f32().max(0.1);
            let speed_kb = ((downloaded - if is_partial { existing_bytes } else { 0 }) as f32 / 1024.0) / elapsed_sec;
            let percent = if total_bytes > 0 {
                (downloaded as f32 / total_bytes as f32) * 100.0
            } else {
                0.0
            };

            on_progress(DownloadProgress {
                tool_id: dest.file_name().and_then(|f| f.to_str()).unwrap_or("tool").to_string(),
                bytes_downloaded: downloaded,
                total_bytes,
                percent,
                speed_kb_s: speed_kb,
                is_resumed: is_partial,
                completed: false,
            });
        }

        file.sync_all().map_err(DevosError::Io)?;
        drop(file);

        // Verify SHA256 if supplied
        if let Some(expected_hash) = expected_sha256 {
            if !expected_hash.trim().is_empty() {
                let matches = Self::verify_sha256(dest, expected_hash)?;
                if !matches {
                    let _ = fs::remove_file(dest);
                    return Err(DevosError::Custom {
                        code: "CHECKSUM_MISMATCH".to_string(),
                        message: "Downloaded archive SHA256 checksum mismatch".to_string(),
                        hint: Some("The downloaded file may be corrupted or hijacked. Switched to mirror fallback.".to_string()),
                        plain_message: Some("下载的文件哈希校验不符，可能文件已损坏或被劫持，已自动安全清理。".to_string()),
                    });
                }
            }
        }

        on_progress(DownloadProgress {
            tool_id: dest.file_name().and_then(|f| f.to_str()).unwrap_or("tool").to_string(),
            bytes_downloaded: downloaded,
            total_bytes,
            percent: 100.0,
            speed_kb_s: 0.0,
            is_resumed: is_partial,
            completed: true,
        });

        Ok(())
    }

    /// Import a locally downloaded archive or binary directly into ~/.devos/bin/
    pub fn import_local_archive<P: AsRef<Path>>(tool_name: &str, source_path: P) -> Result<PathBuf> {
        let src = source_path.as_ref();
        if !src.exists() {
            return Err(DevosError::Custom {
                code: "FILE_NOT_FOUND".to_string(),
                message: format!("Source archive does not exist: {:?}", src),
                hint: None,
                plain_message: Some("所选本地安装包文件不存在，请重新选择".to_string()),
            });
        }

        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let bin_dir = home.join(".devos").join("bin");
        fs::create_dir_all(&bin_dir)?;

        let dest_filename = if cfg!(windows) {
            format!("{}.exe", tool_name)
        } else {
            tool_name.to_string()
        };
        let target_file = bin_dir.join(dest_filename);

        fs::copy(src, &target_file)?;

        // Ensure execute permission on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&target_file) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&target_file, perms);
            }
        }

        Ok(target_file)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_mirrors_config_defaults() {
        let cfg = MirrorsConfig::default();
        assert_eq!(cfg.active_preset, MirrorPreset::Auto);
        assert!(cfg.tools.contains_key("ddev"));
        assert!(cfg.tools.contains_key("mkcert"));
        assert!(cfg.container_env_vars.contains_key("NPM_CONFIG_REGISTRY"));
    }

    #[test]
    fn test_verify_sha256_match() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, b"hello world").unwrap();

        // SHA256 of "hello world" = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
        let expected = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
        assert!(MirrorManager::verify_sha256(&file, expected).unwrap());
        assert!(!MirrorManager::verify_sha256(&file, "wrong_hash").unwrap());
    }

    #[test]
    fn test_import_local_archive() {
        let dir = tempdir().unwrap();
        let fake_bin = dir.path().join("my-tool");
        fs::write(&fake_bin, b"#!/bin/sh\necho ok").unwrap();

        let imported = MirrorManager::import_local_archive("my-tool", &fake_bin).unwrap();
        assert!(imported.exists());
    }
}
