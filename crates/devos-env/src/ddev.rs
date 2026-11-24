use crate::doctor::PreflightDoctor;
use crate::driver::{DiagnosticItem, EnvDriver, EnvStatus, ExecResult};
use devos_core::{inject_proxy_bypass_env, DevosError, PortRegistry, Result};
use std::path::Path;
use std::process::Command;
use std::time::Instant;

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
        results.push(PreflightDoctor::check_proxy_bypass());
        Ok(results)
    }

    fn up(&self, project_root: &Path) -> Result<EnvStatus> {
        // Automatically check if ports 80/443 are occupied by host processes (e.g. Nginx, IIS, phpStudy)
        // If occupied, automatically configure fallback ports (e.g. 18080/18443) to prevent port collisions
        let (http_port, https_port) = PortRegistry::find_free_web_ports(80, 443);
        if http_port != 80 || https_port != 443 {
            let mut cfg_cmd = Command::new("ddev");
            cfg_cmd
                .args([
                    "config",
                    &format!("--router-http-port={}", http_port),
                    &format!("--router-https-port={}", https_port),
                ])
                .current_dir(project_root);
            inject_proxy_bypass_env(&mut cfg_cmd);
            let _ = cfg_cmd.output();
        }

        let mut start_cmd = Command::new("ddev");
        start_cmd.arg("start").current_dir(project_root);
        inject_proxy_bypass_env(&mut start_cmd);

        let output = start_cmd
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
        let mut cmd = Command::new("ddev");
        cmd.arg("stop").current_dir(project_root);
        inject_proxy_bypass_env(&mut cmd);
        let _ = cmd.output();
        Ok(())
    }

    fn status(&self, project_root: &Path) -> Result<EnvStatus> {
        let mut cmd = Command::new("ddev");
        cmd.arg("describe").arg("-j").current_dir(project_root);
        inject_proxy_bypass_env(&mut cmd);
        let output = cmd.output();

        match output {
            Ok(out) if out.status.success() => {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                    let raw = json.get("raw").unwrap_or(&json);
                    let status_str = raw.get("status").and_then(|s| s.as_str()).unwrap_or("");
                    let running = status_str == "running" || status_str == "OK";
                    let primary_url = raw
                        .get("primary_url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string());
                    return Ok(EnvStatus {
                        running,
                        driver: "ddev".to_string(),
                        primary_url,
                        container_name: raw
                            .get("name")
                            .and_then(|n| n.as_str())
                            .map(|s| s.to_string()),
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
        let mut exec_cmd = Command::new("ddev");
        exec_cmd.arg("exec").arg(cmd).current_dir(project_root);
        inject_proxy_bypass_env(&mut exec_cmd);

        let output = exec_cmd.output().map_err(DevosError::Io)?;

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
        let mut cmd = Command::new("ddev");
        cmd.arg("snapshot")
            .arg("--name")
            .arg(name)
            .current_dir(project_root);
        inject_proxy_bypass_env(&mut cmd);

        let output = cmd.output().map_err(DevosError::Io)?;

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
        let mut cmd = Command::new("ddev");
        cmd.arg("snapshot")
            .arg("restore")
            .arg(name)
            .current_dir(project_root);
        inject_proxy_bypass_env(&mut cmd);

        let output = cmd.output().map_err(DevosError::Io)?;

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

    fn logs(&self, project_root: &Path, tail: usize) -> Result<Vec<String>> {
        let tail_str = tail.to_string();
        let mut cmd = Command::new("ddev");
        cmd.args(["logs", "--tail", &tail_str])
            .current_dir(project_root);
        inject_proxy_bypass_env(&mut cmd);

        match cmd.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let combined = format!("{}\n{}", stdout, stderr);
                let lines: Vec<String> = combined
                    .lines()
                    .map(|l| l.trim().to_string())
                    .filter(|l| !l.is_empty())
                    .collect();
                Ok(lines)
            }
            Err(_) => Ok(vec![]),
        }
    }
}
