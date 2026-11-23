use std::path::{Path, PathBuf};
use serde_json::{json, Value};
pub use devos_schema::AgentDetection;
use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write_json, read_json};

pub struct AgentConfigManager;

impl AgentConfigManager {
    /// Resolve the devos-mcp executable binary path
    pub fn resolve_mcp_bin_path() -> PathBuf {
        // 1. Check if running alongside devos-mcp in same dir
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                let sibling = parent.join(if cfg!(windows) { "devos-mcp.exe" } else { "devos-mcp" });
                if sibling.exists() {
                    return sibling;
                }
            }
        }

        // 2. Check cargo target directories relative to current working directory
        let search_candidates = [
            "target/debug/devos-mcp",
            "target/release/devos-mcp",
            "../target/debug/devos-mcp",
            "../target/release/devos-mcp",
            "../../target/debug/devos-mcp",
            "../../target/release/devos-mcp",
        ];

        for cand in &search_candidates {
            let p = PathBuf::from(cand);
            if p.exists() {
                if let Ok(abs) = p.canonicalize() {
                    return abs;
                }
            }
        }

        // 3. Fallback to command name in PATH
        PathBuf::from("devos-mcp")
    }

    /// Detect supported AI agents installed on the host machine
    pub fn detect_agents(project_root: Option<&Path>) -> Vec<AgentDetection> {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let mut results = Vec::new();

        // 1. Claude Desktop
        #[cfg(target_os = "macos")]
        let claude_desktop_cfg = home
            .join("Library")
            .join("Application Support")
            .join("Claude")
            .join("claude_desktop_config.json");
        #[cfg(target_os = "windows")]
        let claude_desktop_cfg = dirs::config_dir()
            .map(|d| d.join("Claude").join("claude_desktop_config.json"))
            .unwrap_or_else(|| home.join("AppData").join("Roaming").join("Claude").join("claude_desktop_config.json"));
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let claude_desktop_cfg = home.join(".config").join("Claude").join("claude_desktop_config.json");

        let claude_parent = claude_desktop_cfg.parent().map(|p| p.exists()).unwrap_or(false);
        let claude_configured = Self::is_mcp_configured(&claude_desktop_cfg);
        results.push(AgentDetection {
            id: "claude_desktop".to_string(),
            name: "Claude Desktop".to_string(),
            installed: claude_parent || claude_desktop_cfg.exists(),
            config_path: claude_desktop_cfg.display().to_string(),
            configured: claude_configured,
            description: "Anthropic 官方桌面端应用，支持标准 MCP 协议扩展".to_string(),
        });

        // 2. Claude Code CLI (~/.claude.json)
        let claude_code_cfg = home.join(".claude.json");
        let claude_code_installed = claude_code_cfg.exists() || home.join(".claude").exists();
        let claude_code_configured = Self::is_mcp_configured(&claude_code_cfg);
        results.push(AgentDetection {
            id: "claude_code".to_string(),
            name: "Claude Code CLI".to_string(),
            installed: claude_code_installed,
            config_path: claude_code_cfg.display().to_string(),
            configured: claude_code_configured,
            description: "Anthropic 终端智能编程命令行 Agent".to_string(),
        });

        // 3. Cursor (~/.cursor/mcp.json)
        let cursor_dir = home.join(".cursor");
        let cursor_cfg = cursor_dir.join("mcp.json");
        let cursor_installed = cursor_dir.exists();
        let cursor_configured = Self::is_mcp_configured(&cursor_cfg);
        results.push(AgentDetection {
            id: "cursor".to_string(),
            name: "Cursor AI 编辑器".to_string(),
            installed: cursor_installed,
            config_path: cursor_cfg.display().to_string(),
            configured: cursor_configured,
            description: "集成了 AI Agent 的现代代码编辑器".to_string(),
        });

        // 4. Factory Droid (~/.factory/mcp.json)
        let factory_dir = home.join(".factory");
        let factory_cfg = factory_dir.join("mcp.json");
        let factory_installed = factory_dir.exists();
        let factory_configured = Self::is_mcp_configured(&factory_cfg);
        results.push(AgentDetection {
            id: "factory_droid".to_string(),
            name: "Factory Droid".to_string(),
            installed: factory_installed,
            config_path: factory_cfg.display().to_string(),
            configured: factory_configured,
            description: "企业级高自主自治 AI Agent 执行引擎".to_string(),
        });

        // 5. Project-level MCP config (.mcp.json in workspace)
        if let Some(root) = project_root {
            let proj_mcp = root.join(".mcp.json");
            let proj_configured = Self::is_mcp_configured(&proj_mcp);
            results.push(AgentDetection {
                id: "project_mcp".to_string(),
                name: "项目通用 MCP 配置".to_string(),
                installed: true,
                config_path: proj_mcp.display().to_string(),
                configured: proj_configured,
                description: "存放在项目根目录的 .mcp.json，供任意兼容客户端使用".to_string(),
            });
        }

        results
    }

    /// Check if 'devos' mcp server is already configured in a given config file
    pub fn is_mcp_configured(cfg_path: &Path) -> bool {
        if !cfg_path.exists() {
            return false;
        }
        if let Ok(val) = read_json::<_, Value>(cfg_path) {
            if let Some(mcp) = val.get("mcpServers") {
                return mcp.get("devos").is_some();
            }
        }
        false
    }

    /// Configure an agent by injecting devos-mcp into its configuration file
    pub fn configure_agent(
        agent_id: &str,
        mcp_bin_override: Option<&Path>,
        project_root: Option<&Path>,
    ) -> Result<String> {
        let mcp_bin = mcp_bin_override
            .map(|p| p.to_path_buf())
            .unwrap_or_else(Self::resolve_mcp_bin_path);

        let bin_str = mcp_bin.display().to_string();

        let detections = Self::detect_agents(project_root);
        let target = detections.into_iter().find(|d| d.id == agent_id).ok_or_else(|| {
            DevosError::Custom {
                code: "AGENT_NOT_FOUND".to_string(),
                message: format!("Unknown or unsupported agent ID: {}", agent_id),
                hint: Some("Supported IDs: claude_desktop, claude_code, cursor, factory_droid, project_mcp".to_string()),
                plain_message: Some(format!("未识别的 AI 工具类型: {}", agent_id)),
            }
        })?;

        let cfg_path = PathBuf::from(&target.config_path);

        // Ensure parent directory exists
        if let Some(parent) = cfg_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(DevosError::Io)?;
            }
        }

        let mut config_val = if cfg_path.exists() {
            read_json::<_, Value>(&cfg_path).unwrap_or_else(|_| json!({}))
        } else {
            json!({})
        };

        if !config_val.is_object() {
            config_val = json!({});
        }

        let root_map = config_val.as_object_mut().unwrap();
        let mcp_servers = root_map
            .entry("mcpServers".to_string())
            .or_insert_with(|| json!({}));

        if let Some(servers_obj) = mcp_servers.as_object_mut() {
            servers_obj.insert(
                "devos".to_string(),
                json!({
                    "command": bin_str,
                    "args": []
                }),
            );
        }

        atomic_write_json(&cfg_path, &config_val)?;

        Ok(format!(
            "成功为 {} 配置 DevOS MCP 服务（配置文件：{}）",
            target.name, target.config_path
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_project_mcp_configure() {
        let dir = tempdir().unwrap();
        let detections = AgentConfigManager::detect_agents(Some(dir.path()));
        assert!(detections.iter().any(|d| d.id == "project_mcp"));

        let res = AgentConfigManager::configure_agent("project_mcp", Some(&PathBuf::from("/usr/local/bin/devos-mcp")), Some(dir.path()));
        assert!(res.is_ok());

        let cfg = dir.path().join(".mcp.json");
        assert!(cfg.exists());
        assert!(AgentConfigManager::is_mcp_configured(&cfg));
    }
}
