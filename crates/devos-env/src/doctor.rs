use std::process::Command;
use crate::driver::{DiagnosticItem, DiagnosticStatus};

pub struct PreflightDoctor;

impl PreflightDoctor {
    pub fn diagnose_all() -> Vec<DiagnosticItem> {
        let mut results = Vec::new();
        results.push(Self::check_docker());
        results.push(Self::check_ddev());
        results.push(Self::check_devcontainer());
        results.push(Self::check_proxy_bypass());
        #[cfg(target_os = "windows")]
        results.push(Self::check_wsl());
        results
    }

    pub fn check_proxy_bypass() -> DiagnosticItem {
        let info = devos_core::diagnose_proxy_env();
        if !info.has_proxy {
            DiagnosticItem {
                key: "proxy".to_string(),
                title: "本地网络代理环境".to_string(),
                status: DiagnosticStatus::Ok,
                message: "未检测到代理劫持风险，本地直连正常".to_string(),
                fix_hint: None,
            }
        } else if info.is_bypassed_properly {
            DiagnosticItem {
                key: "proxy".to_string(),
                title: "本地网络代理环境".to_string(),
                status: DiagnosticStatus::Ok,
                message: "检测到代理软件，本地回环白名单已生效".to_string(),
                fix_hint: None,
            }
        } else {
            DiagnosticItem {
                key: "proxy".to_string(),
                title: "本地网络代理环境".to_string(),
                status: DiagnosticStatus::Warning,
                message: "检测到代理软件，DevOS 子进程将强制注入 NO_PROXY 规避劫持".to_string(),
                fix_hint: Some("若遇到容器无法访问，请检查代理客户端（如 Clash/v2rayN）是否勾选了绕过本地回环地址。".to_string()),
            }
        }
    }

    pub fn check_docker() -> DiagnosticItem {
        match Command::new("docker").arg("info").output() {
            Ok(out) if out.status.success() => DiagnosticItem {
                key: "docker".to_string(),
                title: "Docker 容器引擎".to_string(),
                status: DiagnosticStatus::Ok,
                message: "Docker 服务运行正常".to_string(),
                fix_hint: None,
            },
            Ok(_) => DiagnosticItem {
                key: "docker".to_string(),
                title: "Docker 容器引擎".to_string(),
                status: DiagnosticStatus::Error,
                message: "Docker 已安装但未启动服务".to_string(),
                fix_hint: Some("请启动 Docker Desktop、OrbStack 或 Colima 应用程序。".to_string()),
            },
            Err(_) => DiagnosticItem {
                key: "docker".to_string(),
                title: "Docker 容器引擎".to_string(),
                status: DiagnosticStatus::Error,
                message: "本机未检测到 Docker 可执行命令".to_string(),
                fix_hint: Some("请前往 https://www.docker.com 或 https://orbstack.dev 下载并安装 Docker 运行环境。".to_string()),
            },
        }
    }

    pub fn check_ddev() -> DiagnosticItem {
        match Command::new("ddev").arg("--version").output() {
            Ok(out) if out.status.success() => {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                DiagnosticItem {
                    key: "ddev".to_string(),
                    title: "DDEV 网页与数据库环境引擎".to_string(),
                    status: DiagnosticStatus::Ok,
                    message: format!("已安装: {}", ver),
                    fix_hint: None,
                }
            }
            _ => DiagnosticItem {
                key: "ddev".to_string(),
                title: "DDEV 网页与数据库环境引擎".to_string(),
                status: DiagnosticStatus::Warning,
                message: "未检测到 DDEV 命令".to_string(),
                fix_hint: Some("macOS 可执行 `brew install ddev/ddev/ddev` 安装；Windows 可通过 WSL2 或安装包安装。".to_string()),
            },
        }
    }

    pub fn check_devcontainer() -> DiagnosticItem {
        match Command::new("devcontainer").arg("--version").output() {
            Ok(out) if out.status.success() => {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                DiagnosticItem {
                    key: "devcontainer".to_string(),
                    title: "Dev Container 后端脚本引擎".to_string(),
                    status: DiagnosticStatus::Ok,
                    message: format!("已安装: {}", ver),
                    fix_hint: None,
                }
            }
            _ => DiagnosticItem {
                key: "devcontainer".to_string(),
                title: "Dev Container 后端脚本引擎".to_string(),
                status: DiagnosticStatus::Warning,
                message: "未检测到 @devcontainers/cli 命令".to_string(),
                fix_hint: Some("可通过执行 `npm install -g @devcontainers/cli` 或 `pnpm add -g @devcontainers/cli` 安装。".to_string()),
            },
        }
    }

    #[cfg(target_os = "windows")]
    pub fn check_wsl() -> DiagnosticItem {
        match Command::new("wsl").arg("--status").output() {
            Ok(out) if out.status.success() => DiagnosticItem {
                key: "wsl".to_string(),
                title: "Windows WSL2 运行环境".to_string(),
                status: DiagnosticStatus::Ok,
                message: "WSL2 环境正常".to_string(),
                fix_hint: None,
            },
            _ => DiagnosticItem {
                key: "wsl".to_string(),
                title: "Windows WSL2 运行环境".to_string(),
                status: DiagnosticStatus::Error,
                message: "WSL2 未启用或配置不完整".to_string(),
                fix_hint: Some("请在 PowerShell 管理员窗口执行 `wsl --install` 并重启电脑。".to_string()),
            },
        }
    }
}
