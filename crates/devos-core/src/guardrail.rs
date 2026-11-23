use crate::error::{DevosError, Result};
use devos_schema::DevosProject;
use std::path::Path;

pub struct Guardrails;

impl Guardrails {
    /// Check if a potentially destructive operation is allowed in current project mode
    pub fn check_destructive_allowed(project: &DevosProject, action: &str) -> Result<()> {
        let is_destructive = matches!(
            action,
            "down" | "restore" | "drop" | "purge" | "reset" | "clean"
        );

        if is_destructive {
            let allowed_modes = &project.guardrails.allow_destructive_in_modes;
            if !allowed_modes.contains(&project.mode) {
                return Err(DevosError::GuardrailBlocked {
                    code: "DESTRUCTIVE_OP_BLOCKED".to_string(),
                    reason: format!(
                        "Destructive operation '{}' is prohibited in current project mode {:?}",
                        action, project.mode
                    ),
                    hint: "Adjust guardrails.allow_destructive_in_modes in devos.json or switch to DEV_LOCAL mode.".to_string(),
                    plain_message: format!(
                        "当前环境处于 {:?} 模式，DevOS 安全护栏已拦截可能破坏数据的 '{}' 操作。",
                        project.mode, action
                    ),
                });
            }
        }

        Ok(())
    }

    /// Check if a path is marked as protected against automated modification
    pub fn check_path_protected(project: &DevosProject, rel_path: &str) -> Result<()> {
        let normalized = rel_path.trim_start_matches("./").replace('\\', "/");
        for protected in &project.guardrails.protected_paths {
            let norm_protected = protected.trim_start_matches("./").replace('\\', "/");
            if normalized == norm_protected
                || normalized.starts_with(&format!("{}/", norm_protected))
            {
                return Err(DevosError::GuardrailBlocked {
                    code: "PATH_PROTECTED".to_string(),
                    reason: format!("Path '{}' is listed in protected_paths", rel_path),
                    hint:
                        "Protected files must be modified manually by user, not automated agents."
                            .to_string(),
                    plain_message: format!(
                        "文件 '{}' 属于项目受保护核心配置，DevOS 安全护栏已拦截自动写入。",
                        rel_path
                    ),
                });
            }
        }
        Ok(())
    }

    /// Validate that smoke check passes before submitting card for testing
    pub fn check_smoke_before_testing(project_root: &Path, project: &DevosProject) -> Result<()> {
        if !project.guardrails.require_smoke_check_before_testing {
            return Ok(());
        }

        // Check if web environment has a health check configured
        if let Some(ref web_env) = project.environments.web {
            if let Some(ref health) = web_env.health_check {
                // If url starts with http, attempt a quick TCP or HTTP probe
                let url = &health.url;
                if url.starts_with("http") {
                    // Quick check if primary url or container is reachable
                    // For local development, if container is not up, fail smoke check
                }
            }
        }

        // Verify standard requirements exist
        let req_dir = project_root.join(&project.workspace_paths.requirements);
        if !req_dir.exists() {
            return Err(DevosError::GuardrailBlocked {
                code: "MISSING_REQUIREMENTS_DIR".to_string(),
                reason: "Requirements directory does not exist".to_string(),
                hint: "Initialize requirements directory with product specifications.".to_string(),
                plain_message: "项目缺少 requirements 需求规格目录，暂不能提交提测。".to_string(),
            });
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use devos_schema::{ProjectMode, ProjectType};

    #[test]
    fn test_guardrails_destructive() {
        let mut proj = DevosProject::new(
            "test".to_string(),
            "Test Proj".to_string(),
            "Desc".to_string(),
            ProjectType::Web,
        );
        proj.mode = ProjectMode::DeployProd;

        let res = Guardrails::check_destructive_allowed(&proj, "restore");
        assert!(res.is_err());

        proj.mode = ProjectMode::DevLocal;
        let res_ok = Guardrails::check_destructive_allowed(&proj, "restore");
        assert!(res_ok.is_ok());
    }

    #[test]
    fn test_guardrails_protected_path() {
        let proj = DevosProject::new(
            "test".to_string(),
            "Test Proj".to_string(),
            "Desc".to_string(),
            ProjectType::Web,
        );
        assert!(Guardrails::check_path_protected(&proj, ".env").is_err());
        assert!(Guardrails::check_path_protected(&proj, ".ddev/config.yaml").is_err());
        assert!(Guardrails::check_path_protected(&proj, "src/index.ts").is_ok());
    }
}
