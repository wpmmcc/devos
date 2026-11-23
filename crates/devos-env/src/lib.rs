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
    use std::path::PathBuf;

    #[test]
    fn test_preflight_doctor_diagnostics() {
        let results = PreflightDoctor::diagnose_all();
        assert!(!results.is_empty());
        let docker_check = results.iter().find(|item| item.key == "docker");
        assert!(docker_check.is_some());
        let ddev_check = results.iter().find(|item| item.key == "ddev");
        assert!(ddev_check.is_some());
        let devcontainer_check = results.iter().find(|item| item.key == "devcontainer");
        assert!(devcontainer_check.is_some());
        let proxy_check = results.iter().find(|item| item.key == "proxy");
        assert!(proxy_check.is_some());
    }

    #[test]
    fn test_ddev_driver_interface() {
        let driver = DdevDriver::new();
        assert_eq!(driver.driver_name(), "ddev");

        let prereqs = driver
            .check_prereqs()
            .expect("check_prereqs should not fail");
        assert_eq!(prereqs.len(), 3);
        assert!(prereqs.iter().any(|p| p.key == "docker"));
        assert!(prereqs.iter().any(|p| p.key == "ddev"));
        assert!(prereqs.iter().any(|p| p.key == "proxy"));

        let dummy_root = PathBuf::from("/tmp/nonexistent-devos-ddev-test");
        let status = driver
            .status(&dummy_root)
            .expect("status should return EnvStatus");
        assert_eq!(status.driver, "ddev");
        assert!(!status.running);
    }

    #[test]
    fn test_devcontainer_driver_interface() {
        let driver = DevcontainerDriver::new();
        assert_eq!(driver.driver_name(), "devcontainer");

        let prereqs = driver
            .check_prereqs()
            .expect("check_prereqs should not fail");
        assert_eq!(prereqs.len(), 3);
        assert!(prereqs.iter().any(|p| p.key == "docker"));
        assert!(prereqs.iter().any(|p| p.key == "devcontainer"));
        assert!(prereqs.iter().any(|p| p.key == "proxy"));

        let dummy_root = PathBuf::from("/tmp/nonexistent-devos-dc-test");
        let status = driver
            .status(&dummy_root)
            .expect("status should return EnvStatus");
        assert_eq!(status.driver, "devcontainer");
        assert!(!status.running);
    }

    #[test]
    fn test_devcontainer_exec_fallback() {
        let driver = DevcontainerDriver::new();
        let cur_dir = std::env::current_dir().unwrap();
        let res = driver.exec(&cur_dir, "echo devos-framework-test", 10, &[]);
        assert!(res.is_ok(), "exec should succeed or fallback gracefully");
        let exec_res = res.unwrap();
        assert!(exec_res.stdout.contains("devos-framework-test"));
    }

    #[test]
    fn test_port_registry_allocations() {
        use devos_core::PortRegistry;
        let (http_port, https_port) = PortRegistry::find_free_web_ports(80, 443);
        assert!(http_port > 0);
        assert!(https_port > 0);
        assert_ne!(http_port, https_port);
    }
}
