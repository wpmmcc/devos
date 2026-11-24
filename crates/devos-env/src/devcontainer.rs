use crate::doctor::PreflightDoctor;
use crate::driver::{DiagnosticItem, EnvDriver, EnvStatus, ExecResult};
use devos_core::{inject_proxy_bypass_env, DevosError, Result};
use std::path::Path;
use std::process::Command;
use std::time::Instant;

fn get_dc_command() -> Command {
    if let Some(bin) = PreflightDoctor::get_devcontainer_binary() {
        Command::new(bin)
    } else {
        Command::new("devcontainer")
    }
}

pub struct DevcontainerDriver;

impl DevcontainerDriver {
    pub fn new() -> Self {
        Self
    }
}

fn find_devcontainer(project_root: &Path) -> Option<(String, String, String)> {
    let folder_str = project_root.display().to_string();
    let filters = [
        format!("label=devcontainer.local_folder={}", folder_str),
        format!("label=vsch.local.folder={}", folder_str),
    ];
    for filter in &filters {
        let mut cmd = Command::new("docker");
        cmd.args(["ps", "--filter", filter, "--format", "{{.ID}}|{{.Names}}|{{.Status}}"]);
        inject_proxy_bypass_env(&mut cmd);
        if let Ok(out) = cmd.output() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !stdout.is_empty() {
                if let Some(first_line) = stdout.lines().next() {
                    let parts: Vec<&str> = first_line.split('|').collect();
                    if parts.len() >= 2 {
                        return Some((
                            parts[0].to_string(),
                            parts[1].to_string(),
                            parts.get(2).unwrap_or(&"").to_string(),
                        ));
                    }
                }
            }
        }
    }
    None
}

impl EnvDriver for DevcontainerDriver {
    fn driver_name(&self) -> &'static str {
        "devcontainer"
    }

    fn check_prereqs(&self) -> Result<Vec<DiagnosticItem>> {
        let mut results = Vec::new();
        results.push(PreflightDoctor::check_docker());
        results.push(PreflightDoctor::check_devcontainer());
        results.push(PreflightDoctor::check_proxy_bypass());
        Ok(results)
    }

    fn up(&self, project_root: &Path) -> Result<EnvStatus> {
        let dc_dir = project_root.join(".devcontainer");
        let dc_config = dc_dir.join("devcontainer.json");
        if !dc_config.exists() {
            let _ = std::fs::create_dir_all(&dc_dir);
            let folder_name = project_root
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("devos-script");
            let default_dc = serde_json::json!({
                "name": folder_name,
                "image": "mcr.microsoft.com/devcontainers/python:3.11"
            });
            let _ = std::fs::write(
                &dc_config,
                serde_json::to_string_pretty(&default_dc).unwrap_or_default(),
            );
        }

        let mut cmd = get_dc_command();
        cmd.arg("up").arg("--workspace-folder").arg(project_root);
        inject_proxy_bypass_env(&mut cmd);

        let output = cmd.output().map_err(|e| DevosError::EnvironmentError {
            code: "DEVCONTAINER_NOT_INSTALLED".to_string(),
            message: format!("Failed to run devcontainer up: {}", e),
            hint: "Install @devcontainers/cli via `npm install -g @devcontainers/cli`.".to_string(),
            plain_message: "启动 Dev Container 引擎失败，请检查 @devcontainers/cli 是否已安装。"
                .to_string(),
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DevosError::EnvironmentError {
                code: "DEVCONTAINER_UP_ERROR".to_string(),
                message: stderr.to_string(),
                hint: "Inspect .devcontainer/devcontainer.json syntax and Docker logs.".to_string(),
                plain_message: "后端脚本沙盒容器构建或启动失败，请检查 Docker 服务与配置文件。"
                    .to_string(),
            });
        }

        self.status(project_root)
    }

    fn down(&self, project_root: &Path) -> Result<()> {
        if let Some((id, _, _)) = find_devcontainer(project_root) {
            let mut stop_cmd = Command::new("docker");
            stop_cmd.args(["stop", &id]);
            inject_proxy_bypass_env(&mut stop_cmd);
            let _ = stop_cmd.output();
        }
        Ok(())
    }

    fn status(&self, project_root: &Path) -> Result<EnvStatus> {
        if let Some((_id, name, status_info)) = find_devcontainer(project_root) {
            return Ok(EnvStatus {
                running: true,
                driver: "devcontainer".to_string(),
                primary_url: None,
                container_name: Some(name),
                details: Some(serde_json::json!({
                    "container_info": status_info
                })),
            });
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
        let mut dc_cmd = get_dc_command();
        dc_cmd
            .arg("exec")
            .arg("--workspace-folder")
            .arg(project_root)
            .arg("sh")
            .arg("-c")
            .arg(cmd);
        inject_proxy_bypass_env(&mut dc_cmd);

        let res = dc_cmd.output();

        let output = match res {
            Ok(out) if out.status.success() => out,
            Ok(out) => {
                // If container is not running or devcontainer failed, gracefully fallback to host execution
                let mut fallback_cmd = if cfg!(windows) {
                    let mut c = Command::new("cmd");
                    c.args(["/C", cmd]).current_dir(project_root);
                    c
                } else {
                    let mut c = Command::new("sh");
                    c.arg("-c").arg(cmd).current_dir(project_root);
                    c
                };
                inject_proxy_bypass_env(&mut fallback_cmd);
                match fallback_cmd.output() {
                    Ok(local_out) => local_out,
                    Err(_) => out,
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // Graceful fallback to local execution
                let mut fallback_cmd = if cfg!(windows) {
                    let mut c = Command::new("cmd");
                    c.args(["/C", cmd]).current_dir(project_root);
                    c
                } else {
                    let mut c = Command::new("sh");
                    c.arg("-c").arg(cmd).current_dir(project_root);
                    c
                };
                inject_proxy_bypass_env(&mut fallback_cmd);
                fallback_cmd.output().map_err(DevosError::Io)?
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
        Ok(())
    }

    fn restore(&self, _project_root: &Path, _name: &str) -> Result<()> {
        Ok(())
    }

    fn logs(&self, _project_root: &Path, tail: usize) -> Result<Vec<String>> {
        let tail_str = tail.to_string();

        // Try querying docker logs for container
        let mut cmd = Command::new("docker");
        cmd.args(["ps", "-q", "--filter", "label=com.devos.managed=true"]);
        inject_proxy_bypass_env(&mut cmd);

        if let Ok(output) = cmd.output() {
            let ids = String::from_utf8_lossy(&output.stdout);
            if let Some(id) = ids.lines().next() {
                let id = id.trim();
                if !id.is_empty() {
                    let mut log_cmd = Command::new("docker");
                    log_cmd.args(["logs", "--tail", &tail_str, id]);
                    inject_proxy_bypass_env(&mut log_cmd);
                    if let Ok(log_output) = log_cmd.output() {
                        let combined = format!(
                            "{}\n{}",
                            String::from_utf8_lossy(&log_output.stdout),
                            String::from_utf8_lossy(&log_output.stderr)
                        );
                        let lines: Vec<String> = combined
                            .lines()
                            .map(|l| l.trim().to_string())
                            .filter(|l| !l.is_empty())
                            .collect();
                        return Ok(lines);
                    }
                }
            }
        }
        Ok(vec![])
    }

    fn rebuild(&self, project_root: &Path) -> Result<EnvStatus> {
        self.down(project_root)?;
        let mut cmd = get_dc_command();
        cmd.arg("build").arg("--workspace-folder").arg(project_root);
        inject_proxy_bypass_env(&mut cmd);
        let _ = cmd.output();
        self.up(project_root)
    }

    fn shell_command(&self, project_root: &Path) -> Result<Vec<String>> {
        if let Some((_id, name, _)) = find_devcontainer(project_root) {
            Ok(vec![
                "docker".to_string(),
                "exec".to_string(),
                "-it".to_string(),
                name,
                "sh".to_string(),
            ])
        } else {
            Ok(vec![
                "docker".to_string(),
                "run".to_string(),
                "-it".to_string(),
                "--rm".to_string(),
                "-v".to_string(),
                format!("{}:/workspace", project_root.display()),
                "-w".to_string(),
                "/workspace".to_string(),
                "mcr.microsoft.com/devcontainers/python:3.11".to_string(),
                "sh".to_string(),
            ])
        }
    }
}
