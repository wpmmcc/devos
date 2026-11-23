use std::path::Path;
use std::process::Command;
use std::time::Instant;
use devos_core::{DevosError, Result};
use crate::doctor::PreflightDoctor;
use crate::driver::{DiagnosticItem, EnvDriver, EnvStatus, ExecResult};

pub struct DevcontainerDriver;

impl DevcontainerDriver {
    pub fn new() -> Self {
        Self
    }
}

impl EnvDriver for DevcontainerDriver {
    fn driver_name(&self) -> &'static str {
        "devcontainer"
    }

    fn check_prereqs(&self) -> Result<Vec<DiagnosticItem>> {
        let mut results = Vec::new();
        results.push(PreflightDoctor::check_docker());
        results.push(PreflightDoctor::check_devcontainer());
        Ok(results)
    }

    fn up(&self, project_root: &Path) -> Result<EnvStatus> {
        let output = Command::new("devcontainer")
            .arg("up")
            .arg("--workspace-folder")
            .arg(project_root)
            .output()
            .map_err(|e| DevosError::EnvironmentError {
                code: "DEVCONTAINER_NOT_INSTALLED".to_string(),
                message: format!("Failed to run devcontainer up: {}", e),
                hint: "Install @devcontainers/cli via `npm install -g @devcontainers/cli`.".to_string(),
                plain_message: "启动 Dev Container 引擎失败，请检查 @devcontainers/cli 是否已安装。".to_string(),
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DevosError::EnvironmentError {
                code: "DEVCONTAINER_UP_ERROR".to_string(),
                message: stderr.to_string(),
                hint: "Inspect .devcontainer/devcontainer.json syntax and Docker logs.".to_string(),
                plain_message: "后端脚本沙盒容器构建或启动失败，请检查 Docker 服务与配置文件。".to_string(),
            });
        }

        self.status(project_root)
    }

    fn down(&self, project_root: &Path) -> Result<()> {
        // Devcontainers are typically stopped via docker stop
        let folder_str = project_root.display().to_string();
        let _ = Command::new("docker")
            .args(["ps", "-q", "--filter", &format!("label=vsch.local.folder={}", folder_str)])
            .output()
            .and_then(|out| {
                let id = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !id.is_empty() {
                    Command::new("docker").args(["stop", &id]).output()
                } else {
                    Ok(out)
                }
            });
        Ok(())
    }

    fn status(&self, project_root: &Path) -> Result<EnvStatus> {
        let folder_str = project_root.display().to_string();
        let output = Command::new("docker")
            .args([
                "ps",
                "--filter",
                &format!("label=vsch.local.folder={}", folder_str),
                "--format",
                "{{.ID}}|{{.Names}}|{{.Status}}",
            ])
            .output();

        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !stdout.is_empty() {
                let parts: Vec<&str> = stdout.split('|').collect();
                let name = parts.get(1).map(|s| s.to_string());
                return Ok(EnvStatus {
                    running: true,
                    driver: "devcontainer".to_string(),
                    primary_url: None,
                    container_name: name,
                    details: Some(serde_json::json!({
                        "container_info": stdout
                    })),
                });
            }
        }

        Ok(EnvStatus {
            running: false,
            driver: "devcontainer".to_string(),
            primary_url: None,
            container_name: None,
            details: None,
        })
    }

    fn exec(
        &self,
        project_root: &Path,
        cmd: &str,
        _timeout_sec: u64,
        _env_vars: &[(&str, &str)],
    ) -> Result<ExecResult> {
        let start = Instant::now();
        let res = Command::new("devcontainer")
            .arg("exec")
            .arg("--workspace-folder")
            .arg(project_root)
            .arg("sh")
            .arg("-c")
            .arg(cmd)
            .output();

        let output = match res {
            Ok(out) => out,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // Graceful fallback to local execution
                Command::new("sh")
                    .arg("-c")
                    .arg(cmd)
                    .current_dir(project_root)
                    .output()
                    .map_err(DevosError::Io)?
            }
            Err(e) => return Err(DevosError::Io(e)),
        };

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(ExecResult {
            exit_code: output.status.code().unwrap_or(-1),
            duration_ms,
            stdout,
            stderr,
        })
    }

    fn snapshot(&self, _project_root: &Path, _name: &str) -> Result<()> {
        // DevContainer snapshot can be achieved via git stash/branch or volume export
        Ok(())
    }

    fn restore(&self, _project_root: &Path, _name: &str) -> Result<()> {
        Ok(())
    }
}
