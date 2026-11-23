use std::path::Path;
use std::process::Command;
use std::time::Instant;
use devos_core::{DevosError, Result};
use crate::doctor::PreflightDoctor;
use crate::driver::{DiagnosticItem, EnvDriver, EnvStatus, ExecResult};

pub struct DdevDriver;

impl DdevDriver {
    pub fn new() -> Self {
        Self
    }
}

impl EnvDriver for DdevDriver {
    fn driver_name(&self) -> &'static str {
        "ddev"
    }

    fn check_prereqs(&self) -> Result<Vec<DiagnosticItem>> {
        let mut results = Vec::new();
        results.push(PreflightDoctor::check_docker());
        results.push(PreflightDoctor::check_ddev());
        Ok(results)
    }

    fn up(&self, project_root: &Path) -> Result<EnvStatus> {
        let output = Command::new("ddev")
            .arg("start")
            .current_dir(project_root)
            .output()
            .map_err(|e| DevosError::EnvironmentError {
                code: "DDEV_START_FAILED".to_string(),
                message: format!("Failed to execute ddev start: {}", e),
                hint: "Ensure Docker is running and DDEV is installed.".to_string(),
                plain_message: "启动 Web 环境失败，请检查 Docker 是否正常运行。".to_string(),
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DevosError::EnvironmentError {
                code: "DDEV_START_ERROR".to_string(),
                message: stderr.to_string(),
                hint: "Review the DDEV error logs or container port allocation.".to_string(),
                plain_message: "Web 容器环境启动失败，可能端口冲突或 Docker 服务异常。".to_string(),
            });
        }

        self.status(project_root)
    }

    fn down(&self, project_root: &Path) -> Result<()> {
        let _ = Command::new("ddev")
            .arg("stop")
            .current_dir(project_root)
            .output();
        Ok(())
    }

    fn status(&self, project_root: &Path) -> Result<EnvStatus> {
        let output = Command::new("ddev")
            .arg("describe")
            .arg("-j")
            .current_dir(project_root)
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                    let raw = json.get("raw").unwrap_or(&json);
                    let status_str = raw.get("status").and_then(|s| s.as_str()).unwrap_or("");
                    let running = status_str == "running" || status_str == "OK";
                    let primary_url = raw.get("primary_url").and_then(|u| u.as_str()).map(|s| s.to_string());
                    return Ok(EnvStatus {
                        running,
                        driver: "ddev".to_string(),
                        primary_url,
                        container_name: raw.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()),
                        details: Some(json),
                    });
                }
            }
            _ => {}
        }

        Ok(EnvStatus {
            running: false,
            driver: "ddev".to_string(),
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
        let output = Command::new("ddev")
            .arg("exec")
            .arg(cmd)
            .current_dir(project_root)
            .output()
            .map_err(|e| DevosError::Io(e))?;

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

    fn snapshot(&self, project_root: &Path, name: &str) -> Result<()> {
        let output = Command::new("ddev")
            .arg("snapshot")
            .arg("--name")
            .arg(name)
            .current_dir(project_root)
            .output()
            .map_err(DevosError::Io)?;

        if !output.status.success() {
            return Err(DevosError::EnvironmentError {
                code: "SNAPSHOT_FAILED".to_string(),
                message: String::from_utf8_lossy(&output.stderr).to_string(),
                hint: "Ensure DDEV container is running when taking snapshot.".to_string(),
                plain_message: "创建数据库与环境快照失败。".to_string(),
            });
        }
        Ok(())
    }

    fn restore(&self, project_root: &Path, name: &str) -> Result<()> {
        let output = Command::new("ddev")
            .arg("snapshot")
            .arg("restore")
            .arg(name)
            .current_dir(project_root)
            .output()
            .map_err(DevosError::Io)?;

        if !output.status.success() {
            return Err(DevosError::EnvironmentError {
                code: "RESTORE_FAILED".to_string(),
                message: String::from_utf8_lossy(&output.stderr).to_string(),
                hint: "Check snapshot name.".to_string(),
                plain_message: "还原环境快照失败，请确认快照名称是否存在。".to_string(),
            });
        }
        Ok(())
    }
}
