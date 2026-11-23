use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ProjectType {
    Web,
    Script,
    Hybrid,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ProjectMode {
    DevLocal,
    ContentLocal,
    DeployProd,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct HealthCheckConfig {
    pub url: String,
    pub expect_status: u16,
    pub timeout_sec: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct WebEnvironment {
    pub enabled: bool,
    pub driver: String,
    pub config_dir: String,
    pub primary_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_check: Option<HealthCheckConfig>,
    pub snapshot_supported: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct ScriptEnvironment {
    pub enabled: bool,
    pub driver: String,
    pub config_dir: String,
    pub service_name: String,
    pub workdir: String,
    pub non_root_user: String,
    pub run_manifest: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default, TS)]
#[ts(export)]
pub struct EnvironmentsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web: Option<WebEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<ScriptEnvironment>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct WorkspacePaths {
    pub requirements: String,
    pub standards: String,
    pub board: String,
    pub issues: String,
    pub docs: String,
    pub knowledge: String,
    pub artifacts: String,
}

impl Default for WorkspacePaths {
    fn default() -> Self {
        Self {
            requirements: "requirements/".to_string(),
            standards: "standards/".to_string(),
            board: "board/".to_string(),
            issues: "issues/".to_string(),
            docs: "docs/".to_string(),
            knowledge: "knowledge/".to_string(),
            artifacts: ".devos/artifacts/".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct GuardrailsConfig {
    pub allow_destructive_in_modes: Vec<ProjectMode>,
    pub require_smoke_check_before_testing: bool,
    pub protected_paths: Vec<String>,
}

impl Default for GuardrailsConfig {
    fn default() -> Self {
        Self {
            allow_destructive_in_modes: vec![ProjectMode::DevLocal],
            require_smoke_check_before_testing: true,
            protected_paths: vec![
                ".env".to_string(),
                ".env.production".to_string(),
                ".ddev/config.yaml".to_string(),
            ],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[ts(export)]
pub struct DevosProject {
    pub schema_version: String,
    pub project_id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub project_type: ProjectType,
    pub mode: ProjectMode,
    pub created_at: String,
    pub environments: EnvironmentsConfig,
    pub workspace_paths: WorkspacePaths,
    pub guardrails: GuardrailsConfig,
}

impl DevosProject {
    pub const CURRENT_SCHEMA_VERSION: &'static str = "1.0";

    pub fn new(slug: String, name: String, description: String, project_type: ProjectType) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let project_id = format!("proj_{}", uuid::Uuid::new_v4().simple());

        let mut environments = EnvironmentsConfig::default();
        match project_type {
            ProjectType::Web => {
                environments.web = Some(WebEnvironment {
                    enabled: true,
                    driver: "ddev".to_string(),
                    config_dir: ".ddev".to_string(),
                    primary_url: format!("https://{}.ddev.site", slug),
                    health_check: Some(HealthCheckConfig {
                        url: format!("https://{}.ddev.site/health", slug),
                        expect_status: 200,
                        timeout_sec: 10,
                    }),
                    snapshot_supported: true,
                });
            }
            ProjectType::Script => {
                environments.script = Some(ScriptEnvironment {
                    enabled: true,
                    driver: "devcontainer".to_string(),
                    config_dir: ".devcontainer".to_string(),
                    service_name: "app".to_string(),
                    workdir: "/workspace".to_string(),
                    non_root_user: "vscode".to_string(),
                    run_manifest: "devos.run.json".to_string(),
                });
            }
            ProjectType::Hybrid => {
                environments.web = Some(WebEnvironment {
                    enabled: true,
                    driver: "ddev".to_string(),
                    config_dir: ".ddev".to_string(),
                    primary_url: format!("https://{}.ddev.site", slug),
                    health_check: Some(HealthCheckConfig {
                        url: format!("https://{}.ddev.site/health", slug),
                        expect_status: 200,
                        timeout_sec: 10,
                    }),
                    snapshot_supported: true,
                });
                environments.script = Some(ScriptEnvironment {
                    enabled: true,
                    driver: "devcontainer".to_string(),
                    config_dir: ".devcontainer".to_string(),
                    service_name: "app".to_string(),
                    workdir: "/workspace".to_string(),
                    non_root_user: "vscode".to_string(),
                    run_manifest: "devos.run.json".to_string(),
                });
            }
        }

        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION.to_string(),
            project_id,
            slug,
            name,
            description,
            project_type,
            mode: ProjectMode::DevLocal,
            created_at: now,
            environments,
            workspace_paths: WorkspacePaths::default(),
            guardrails: GuardrailsConfig::default(),
        }
    }
}
