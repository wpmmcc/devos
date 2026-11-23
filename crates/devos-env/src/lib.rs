pub mod ddev;
pub mod devcontainer;
pub mod doctor;
pub mod driver;

pub use ddev::DdevDriver;
pub use devcontainer::DevcontainerDriver;
pub use doctor::PreflightDoctor;
pub use driver::{DiagnosticItem, DiagnosticStatus, EnvDriver, EnvStatus, ExecResult};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preflight_doctor() {
        let results = PreflightDoctor::diagnose_all();
        assert!(!results.is_empty());
        let docker_check = results.iter().find(|item| item.key == "docker");
        assert!(docker_check.is_some());
    }
}
