use std::collections::HashSet;
use std::env;
use std::path::PathBuf;
use std::process::Command;

pub const DEFAULT_NO_PROXY: &str =
    "127.0.0.1,localhost,*.ddev.site,host.docker.internal,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";

/// Inject NO_PROXY / no_proxy and ~/.devos/bin PATH into external process command
pub fn inject_proxy_bypass_env(cmd: &mut Command) {
    let existing_no_proxy = env::var("NO_PROXY")
        .or_else(|_| env::var("no_proxy"))
        .unwrap_or_default();

    let mut domains: HashSet<String> = HashSet::new();

    for item in DEFAULT_NO_PROXY.split(',') {
        let trimmed = item.trim();
        if !trimmed.is_empty() {
            domains.insert(trimmed.to_string());
        }
    }

    for item in existing_no_proxy.split(',') {
        let trimmed = item.trim();
        if !trimmed.is_empty() {
            domains.insert(trimmed.to_string());
        }
    }

    let merged_no_proxy: Vec<String> = domains.into_iter().collect();
    let no_proxy_val = merged_no_proxy.join(",");

    cmd.env("NO_PROXY", &no_proxy_val);
    cmd.env("no_proxy", &no_proxy_val);

    // Prepend ~/.devos/bin to child PATH for isolated portable toolchain
    if let Some(home) = dirs::home_dir() {
        let devos_bin = home.join(".devos").join("bin");
        let current_path = env::var("PATH").unwrap_or_default();
        let sep = if cfg!(windows) { ";" } else { ":" };
        let new_path = format!("{}{}{}", devos_bin.display(), sep, current_path);
        cmd.env("PATH", new_path);
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ProxyDiagnosticInfo {
    pub has_proxy: bool,
    pub proxy_urls: Vec<String>,
    pub no_proxy_configured: bool,
    pub no_proxy_value: String,
    pub is_bypassed_properly: bool,
}

/// Check system proxy environment variables and whether local loopback bypass is properly active
pub fn diagnose_proxy_env() -> ProxyDiagnosticInfo {
    let proxy_keys = [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ];
    let mut proxy_urls = Vec::new();

    for key in proxy_keys {
        if let Ok(val) = env::var(key) {
            if !val.trim().is_empty() {
                proxy_urls.push(format!("{}={}", key, val));
            }
        }
    }

    let no_proxy = env::var("NO_PROXY")
        .or_else(|_| env::var("no_proxy"))
        .unwrap_or_default();

    let no_proxy_lower = no_proxy.to_lowercase();
    let has_localhost = no_proxy_lower.contains("localhost");
    let has_127 = no_proxy_lower.contains("127.0.0.1");
    let has_ddev = no_proxy_lower.contains("ddev.site");

    let is_bypassed_properly = has_localhost && has_127 && has_ddev;

    ProxyDiagnosticInfo {
        has_proxy: !proxy_urls.is_empty(),
        proxy_urls,
        no_proxy_configured: !no_proxy.is_empty(),
        no_proxy_value: no_proxy,
        is_bypassed_properly,
    }
}

/// Helper to get ~/.devos/bin path
pub fn get_devos_bin_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".devos")
        .join("bin")
}

/// Configure child process group so that entire process tree can be terminated on exit
pub fn configure_child_process_group(cmd: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
}

/// Terminate an entire child process tree by process group (avoiding zombie orphan processes)
pub fn kill_process_tree(pid: u32) {
    #[cfg(unix)]
    {
        // On Unix, send SIGKILL to the process group (-pid)
        let pgid_arg = format!("-{}", pid);
        let _ = Command::new("/bin/kill").args(["-9", &pgid_arg]).output();
        // Also kill directly in case it wasn't process group leader
        let pid_str = pid.to_string();
        let _ = Command::new("/bin/kill").args(["-9", &pid_str]).output();
    }
    #[cfg(windows)]
    {
        let pid_str = pid.to_string();
        let _ = Command::new("taskkill").args(["/F", "/T", "/PID", &pid_str]).output();
    }
}
