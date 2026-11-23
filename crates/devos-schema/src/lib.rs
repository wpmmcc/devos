pub mod agent;
pub mod board;
pub mod daemon;
pub mod decision;
pub mod issue;
pub mod project;
pub mod response;
pub mod run_manifest;

pub use agent::AgentDetection;
pub use board::{BoardCard, BoardColumn, ChecklistStep};
pub use daemon::DaemonInfo;
pub use decision::{DecisionOption, DecisionRequest};
pub use issue::{
    AnnotatedRegion, CapturedContext, ConsoleErrorRecord, FailedRequestRecord, Issue, IssueClaim,
    IssueResolution, IssueSeverity, IssueStatus, RetestRecord, ScriptContext, SourceType,
    UserReport, WebContext,
};
pub use project::{
    DevosProject, EnvironmentsConfig, GuardrailsConfig, HealthCheckConfig, ProjectMode,
    ProjectType, ScriptEnvironment, WebEnvironment, WorkspacePaths,
};
pub use response::{ApiErrorDetail, ApiResponse};
pub use run_manifest::{
    ExpectedOutput, InputType, RunInput, RunManifest, RunTarget, SmokeTestConfig,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serialization() {
        let proj = DevosProject::new(
            "test-proj".to_string(),
            "Test Project".to_string(),
            "A test project description".to_string(),
            ProjectType::Hybrid,
        );
        let json_str = serde_json::to_string_pretty(&proj).unwrap();
        assert!(json_str.contains("proj_"));
        assert!(json_str.contains("ddev"));
        assert!(json_str.contains("devcontainer"));

        let deserialized: DevosProject = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.slug, "test-proj");
    }
}
