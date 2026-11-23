use crate::error::{DevosError, Result};
use crate::fs_utils::{atomic_write, atomic_write_json, read_json, read_to_string};
pub use devos_schema::AgentDetection;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use toml_edit::{value, DocumentMut, Item};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConfigFormat {
    StandardJson,
    OpenCodeJson,
    VsCodeJson,
    CodexToml,
}

#[derive(Debug, Clone)]
pub struct AgentAdapterMeta {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub format: ConfigFormat,
    pub is_global_only: bool,
    pub manual_guide_needed: bool,
}

pub struct AgentConfigManager;

impl AgentConfigManager {
    /// Resolve the devos-mcp executable binary path
    pub fn resolve_mcp_bin_path() -> PathBuf {
        // 1. Check ~/.devos/bin/devos-mcp
        if let Some(home) = dirs::home_dir() {
            let devos_bin = home.join(".devos").join("bin").join(if cfg!(windows) {
                "devos-mcp.exe"
            } else {
                "devos-mcp"
            });
            if devos_bin.exists() {
                return devos_bin;
            }
        }

        // 2. Check if running alongside devos-mcp in same dir
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                let sibling = parent.join(if cfg!(windows) {
                    "devos-mcp.exe"
                } else {
                    "devos-mcp"
                });
                if sibling.exists() {
                    return sibling;
                }
            }
        }

        // 3. Check cargo target directories relative to current working directory
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

        // 4. Fallback to command name in PATH
        PathBuf::from("devos-mcp")
    }

    /// List adapter metadata for all supported agents
    pub fn supported_adapters() -> &'static [AgentAdapterMeta] {
        &[
            AgentAdapterMeta {
                id: "codebuddy",
                name: "腾讯 CodeBuddy / WorkBuddy",
                description: "腾讯自主研发的 AI 编程助手与智能体环境",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "trae",
                name: "字节跳动 TRAE",
                description: "字节跳动全流程 AI 原生集成开发环境",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: true,
            },
            AgentAdapterMeta {
                id: "qoder",
                name: "阿里 Qoder",
                description: "阿里巴巴 AI 研发助手，支持自动化提测与代码审查",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "kimi_code",
                name: "Kimi Code",
                description: "月之暗面大模型代码助手，具备超长上下文理解能力",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "claude_code",
                name: "Claude Code CLI",
                description: "Anthropic 官方终端深度智能编程命令行 Agent",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "claude_desktop",
                name: "Claude Desktop",
                description: "Anthropic 官方桌面端应用，原生支持 MCP 协议扩展",
                format: ConfigFormat::StandardJson,
                is_global_only: true,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "codex",
                name: "OpenAI Codex CLI",
                description: "OpenAI 编程命令行工具，使用标准 TOML 格式管理 MCP",
                format: ConfigFormat::CodexToml,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "factory_droid",
                name: "Factory Droid",
                description: "企业级高自主自治 AI Agent 执行引擎",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "opencode",
                name: "OpenCode",
                description: "开源终端 AI Agent 平台，支持 JSONC 声明式工具接入",
                format: ConfigFormat::OpenCodeJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "cursor",
                name: "Cursor AI 编辑器",
                description: "集成了 AI Agent 的现代代码编辑器",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "windsurf",
                name: "Codeium Windsurf",
                description: "Codeium 打造的 Cascade 协同 AI IDE",
                format: ConfigFormat::StandardJson,
                is_global_only: true,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "vscode",
                name: "VS Code",
                description: "微软 Visual Studio Code 及通用项目 MCP 规范",
                format: ConfigFormat::VsCodeJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
            AgentAdapterMeta {
                id: "project_mcp",
                name: "项目通用 MCP 配置",
                description: "存放在项目根目录的 .mcp.json，供任意兼容客户端使用",
                format: ConfigFormat::StandardJson,
                is_global_only: false,
                manual_guide_needed: false,
            },
        ]
    }

    /// Resolve configuration file path for a given agent
    pub fn resolve_config_path(agent_id: &str, project_root: Option<&Path>) -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

        match agent_id {
            "codebuddy" => home.join(".codebuddy").join(".mcp.json"),
            "trae" => {
                if let Some(root) = project_root {
                    root.join(".trae").join("mcp.json")
                } else {
                    home.join(".trae").join("mcp.json")
                }
            }
            "qoder" => home.join(".qoder").join("settings.json"),
            "kimi_code" => home.join(".kimi-code").join("mcp.json"),
            "claude_code" => home.join(".claude.json"),
            "claude_desktop" => {
                #[cfg(target_os = "macos")]
                {
                    home.join("Library/Application Support/Claude/claude_desktop_config.json")
                }
                #[cfg(target_os = "windows")]
                {
                    dirs::config_dir()
                        .map(|d| d.join("Claude").join("claude_desktop_config.json"))
                        .unwrap_or_else(|| {
                            home.join("AppData/Roaming/Claude/claude_desktop_config.json")
                        })
                }
                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                {
                    home.join(".config/Claude/claude_desktop_config.json")
                }
            }
            "codex" => home.join(".codex").join("config.toml"),
            "factory_droid" => home.join(".factory").join("mcp.json"),
            "opencode" => home.join(".config").join("opencode").join("opencode.json"),
            "cursor" => home.join(".cursor").join("mcp.json"),
            "windsurf" => home
                .join(".codeium")
                .join("windsurf")
                .join("mcp_config.json"),
            "vscode" => {
                if let Some(root) = project_root {
                    root.join(".vscode").join("mcp.json")
                } else {
                    home.join(".vscode").join("mcp.json")
                }
            }
            _ => {
                if let Some(root) = project_root {
                    root.join(".mcp.json")
                } else {
                    home.join(".mcp.json")
                }
            }
        }
    }

    /// Detect supported AI agents installed on the host machine
    pub fn detect_agents(project_root: Option<&Path>) -> Vec<AgentDetection> {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let mut results = Vec::new();

        for meta in Self::supported_adapters() {
            let cfg_path = Self::resolve_config_path(meta.id, project_root);

            let is_installed = match meta.id {
                "codebuddy" => home.join(".codebuddy").exists() || cfg_path.exists(),
                "trae" => {
                    #[cfg(target_os = "macos")]
                    {
                        Path::new("/Applications/TRAE.app").exists() || home.join(".trae").exists()
                    }
                    #[cfg(target_os = "windows")]
                    {
                        home.join("AppData/Local/Programs/TRAE").exists()
                            || home.join(".trae").exists()
                    }
                    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                    {
                        home.join(".trae").exists()
                    }
                }
                "qoder" => home.join(".qoder").exists() || cfg_path.exists(),
                "kimi_code" => home.join(".kimi-code").exists() || cfg_path.exists(),
                "claude_code" => {
                    home.join(".claude.json").exists() || home.join(".claude").exists()
                }
                "claude_desktop" => {
                    cfg_path.parent().map(|p| p.exists()).unwrap_or(false) || cfg_path.exists()
                }
                "codex" => home.join(".codex").exists() || cfg_path.exists(),
                "factory_droid" => home.join(".factory").exists() || cfg_path.exists(),
                "opencode" => home.join(".config/opencode").exists() || cfg_path.exists(),
                "cursor" => home.join(".cursor").exists() || cfg_path.exists(),
                "windsurf" => home.join(".codeium/windsurf").exists() || cfg_path.exists(),
                "vscode" => project_root
                    .map(|r| r.join(".vscode").exists())
                    .unwrap_or(false),
                "project_mcp" => project_root.is_some(),
                _ => cfg_path.exists(),
            };

            let is_configured = Self::is_mcp_configured(&cfg_path, meta.format);

            results.push(AgentDetection {
                id: meta.id.to_string(),
                name: meta.name.to_string(),
                installed: is_installed,
                config_path: cfg_path.display().to_string(),
                configured: is_configured,
                description: meta.description.to_string(),
            });
        }

        results
    }

    /// Check if 'devos' mcp server is configured in a given config file
    pub fn is_mcp_configured(cfg_path: &Path, format: ConfigFormat) -> bool {
        if !cfg_path.exists() {
            return false;
        }

        match format {
            ConfigFormat::CodexToml => {
                if let Ok(content) = read_to_string(cfg_path) {
                    if let Ok(doc) = content.parse::<DocumentMut>() {
                        if let Some(mcp) = doc.get("mcp_servers") {
                            return mcp.get("devos").is_some();
                        }
                    }
                }
                false
            }
            ConfigFormat::OpenCodeJson => {
                if let Ok(val) = read_json::<_, Value>(cfg_path) {
                    if let Some(mcp) = val.get("mcp") {
                        return mcp.get("devos").is_some();
                    }
                }
                false
            }
            ConfigFormat::VsCodeJson => {
                if let Ok(val) = read_json::<_, Value>(cfg_path) {
                    if let Some(servers) = val.get("servers").or_else(|| val.get("mcpServers")) {
                        return servers.get("devos").is_some();
                    }
                }
                false
            }
            ConfigFormat::StandardJson => {
                if let Ok(val) = read_json::<_, Value>(cfg_path) {
                    if let Some(mcp) = val.get("mcpServers") {
                        return mcp.get("devos").is_some();
                    }
                }
                false
            }
        }
    }

    /// Step 1: Create an automatic backup in ~/.devos/backups/<agent_id>/, retaining up to 5 copies
    pub fn create_backup(agent_id: &str, file_path: &Path) -> Result<Option<PathBuf>> {
        if !file_path.exists() {
            return Ok(None);
        }

        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let backup_dir = home.join(".devos").join("backups").join(agent_id);
        fs::create_dir_all(&backup_dir)?;

        let filename = file_path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("config");
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let backup_file = backup_dir.join(format!("{}.{}.bak", filename, timestamp));

        fs::copy(file_path, &backup_file)?;

        // Maintain only recent 5 backups
        if let Ok(entries) = fs::read_dir(&backup_dir) {
            let mut backups: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("bak"))
                .collect();
            backups.sort();
            while backups.len() > 5 {
                let oldest = backups.remove(0);
                let _ = fs::remove_file(oldest);
            }
        }

        Ok(Some(backup_file))
    }

    /// Step 2: Perform surgical merge for TOML (Codex) preserving original comments
    fn merge_codex_toml(cfg_path: &Path, bin_path: &str) -> Result<()> {
        let content = if cfg_path.exists() {
            read_to_string(cfg_path).unwrap_or_default()
        } else {
            String::new()
        };

        let mut doc = content
            .parse::<DocumentMut>()
            .unwrap_or_else(|_| DocumentMut::new());

        // Ensure [mcp_servers] table exists
        if !doc.contains_key("mcp_servers") {
            doc["mcp_servers"] = Item::Table(toml_edit::Table::new());
        }

        let mcp_servers =
            doc["mcp_servers"]
                .as_table_like_mut()
                .ok_or_else(|| DevosError::Custom {
                    code: "INVALID_TOML_STRUCTURE".to_string(),
                    message: "Expected mcp_servers to be a table in Codex config".to_string(),
                    hint: None,
                    plain_message: Some("Codex 配置文件结构异常，无法合并 MCP 节点".to_string()),
                })?;

        // Surgically insert [mcp_servers.devos]
        let mut devos_table = toml_edit::Table::new();
        devos_table.insert("command", value(bin_path));
        let args_arr = toml_edit::Array::new();
        devos_table.insert("args", Item::Value(toml_edit::Value::Array(args_arr)));

        mcp_servers.insert("devos", Item::Table(devos_table));

        atomic_write(cfg_path, doc.to_string())?;
        Ok(())
    }

    /// Step 2: Perform surgical merge for OpenCode JSON
    fn merge_opencode_json(cfg_path: &Path, bin_path: &str) -> Result<()> {
        let mut config_val = if cfg_path.exists() {
            read_json::<_, Value>(cfg_path).unwrap_or_else(|_| json!({}))
        } else {
            json!({})
        };

        if !config_val.is_object() {
            config_val = json!({});
        }

        let root_map = config_val.as_object_mut().unwrap();
        let mcp = root_map
            .entry("mcp".to_string())
            .or_insert_with(|| json!({}));

        if let Some(mcp_obj) = mcp.as_object_mut() {
            mcp_obj.insert(
                "devos".to_string(),
                json!({
                    "type": "local",
                    "command": [bin_path]
                }),
            );
        }

        atomic_write_json(cfg_path, &config_val)?;
        Ok(())
    }

    /// Step 2: Perform surgical merge for VS Code JSON
    fn merge_vscode_json(cfg_path: &Path, bin_path: &str) -> Result<()> {
        let mut config_val = if cfg_path.exists() {
            read_json::<_, Value>(cfg_path).unwrap_or_else(|_| json!({}))
        } else {
            json!({})
        };

        if !config_val.is_object() {
            config_val = json!({});
        }

        let root_map = config_val.as_object_mut().unwrap();
        // VS Code mcp.json supports "servers" or "mcpServers"
        let servers = if root_map.contains_key("servers") {
            root_map.get_mut("servers").unwrap()
        } else {
            root_map
                .entry("servers".to_string())
                .or_insert_with(|| json!({}))
        };

        if let Some(obj) = servers.as_object_mut() {
            obj.insert(
                "devos".to_string(),
                json!({
                    "command": bin_path,
                    "args": []
                }),
            );
        }

        atomic_write_json(cfg_path, &config_val)?;
        Ok(())
    }

    /// Step 2: Perform surgical merge for Standard JSON (Claude, Cursor, CodeBuddy, TRAE, Qoder, etc.)
    fn merge_standard_json(cfg_path: &Path, bin_path: &str, agent_id: &str) -> Result<()> {
        let mut config_val = if cfg_path.exists() {
            read_json::<_, Value>(cfg_path).unwrap_or_else(|_| json!({}))
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
            let mut devos_node = json!({
                "command": bin_path,
                "args": []
            });

            // Qoder & CodeBuddy allow alwaysAllow whitelist for read-only tools
            if agent_id == "qoder" || agent_id == "codebuddy" {
                devos_node["alwaysAllow"] = json!([
                    "get_project_brief",
                    "list_board_cards",
                    "list_issues",
                    "get_run_manifest"
                ]);
            }

            servers_obj.insert("devos".to_string(), devos_node);
        }

        atomic_write_json(cfg_path, &config_val)?;
        Ok(())
    }

    /// Step 3: Inject standard .agents/skills/devos/SKILL.md into project workspace
    pub fn inject_project_skill(project_root: &Path) -> Result<()> {
        let skill_dir = project_root.join(".agents").join("skills").join("devos");
        fs::create_dir_all(&skill_dir)?;

        let skill_content = r#"# DevOS Agent 协作标准化技能 (DevOS Skill)

## 技能定位与核心职责
本技能为 AI Agent 接入 DevOS 本地标准化环境与验收工作台提供规范指导：
1. **优先获取项目上下文：** 会话启动首选调用 MCP 工具 `get_project_brief`，了解项目架构类型、环境约束与未结任务。
2. **严禁在宿主机直接跑业务：** 构建、运行后端脚本与装包必须调用 `env_control(action: "exec")` 调度隔离容器。
3. **保持运行清单同步：** 若新增后端运行脚本，必须调用 `sync_project_assets` 登记到 `devos.run.json`。
4. **标准化提测：** 业务逻辑开发完成后，严禁自作主张移至 done，必须调用 `submit_for_testing` 附带 3~5 条小白验收步骤提请机器与用户测试。
5. **闭环修复缺陷：** 用户验收驳回的问题，调用 `list_issues` 获取完整上下文排障，修复后调用 `resolve_issue`。
"#;

        atomic_write(skill_dir.join("SKILL.md"), skill_content)?;
        Ok(())
    }

    /// Step 4: Verify post-install by running devos-mcp --self-check
    pub fn verify_mcp_self_check(mcp_bin: &Path) -> Result<()> {
        let output = Command::new(mcp_bin)
            .arg("--self-check")
            .output()
            .map_err(|e| DevosError::Custom {
                code: "MCP_EXEC_FAILED".to_string(),
                message: format!("Failed to spawn devos-mcp --self-check: {}", e),
                hint: Some("Verify executable permissions for devos-mcp.".to_string()),
                plain_message: Some("启动 devos-mcp 自检失败，请检查文件执行权限".to_string()),
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DevosError::Custom {
                code: "MCP_SELF_CHECK_FAILED".to_string(),
                message: stderr.to_string(),
                hint: None,
                plain_message: Some("devos-mcp 自检未通过，服务可能损坏".to_string()),
            });
        }

        Ok(())
    }

    /// Complete 5-step safe installation pipeline for any supported Agent
    pub fn configure_agent(
        agent_id: &str,
        mcp_bin_override: Option<&Path>,
        project_root: Option<&Path>,
    ) -> Result<String> {
        let mcp_bin = mcp_bin_override
            .map(|p| p.to_path_buf())
            .unwrap_or_else(Self::resolve_mcp_bin_path);

        // Step 4 preflight: check that mcp_bin can run --self-check
        Self::verify_mcp_self_check(&mcp_bin)?;

        let bin_str = mcp_bin.display().to_string();

        let meta = Self::supported_adapters()
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| DevosError::Custom {
                code: "AGENT_NOT_FOUND".to_string(),
                message: format!("Unknown or unsupported agent ID: {}", agent_id),
                hint: None,
                plain_message: Some(format!("未识别的 AI 工具类型: {}", agent_id)),
            })?;

        let cfg_path = Self::resolve_config_path(agent_id, project_root);

        // Ensure parent folder exists
        if let Some(parent) = cfg_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Step 1: Backup First
        let backup_info = Self::create_backup(agent_id, &cfg_path)?;

        // Step 2: Surgical Merge based on format
        match meta.format {
            ConfigFormat::CodexToml => {
                Self::merge_codex_toml(&cfg_path, &bin_str)?;
            }
            ConfigFormat::OpenCodeJson => {
                Self::merge_opencode_json(&cfg_path, &bin_str)?;
            }
            ConfigFormat::VsCodeJson => {
                Self::merge_vscode_json(&cfg_path, &bin_str)?;
            }
            ConfigFormat::StandardJson => {
                Self::merge_standard_json(&cfg_path, &bin_str, agent_id)?;
            }
        }

        // Step 3: Project-level skill injection
        if let Some(root) = project_root {
            let _ = Self::inject_project_skill(root);
        }

        let backup_msg = backup_info
            .map(|b| format!("（已自动备份原配置至 {}）", b.display()))
            .unwrap_or_default();

        Ok(format!(
            "已成功为 {} 接入 DevOS MCP 服务！{}",
            meta.name, backup_msg
        ))
    }

    /// Step 5: Clean uninstall, surgically removing only 'devos' from the config
    pub fn uninstall_agent_config(agent_id: &str, project_root: Option<&Path>) -> Result<String> {
        let meta = Self::supported_adapters()
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| DevosError::Custom {
                code: "AGENT_NOT_FOUND".to_string(),
                message: format!("Unknown agent ID: {}", agent_id),
                hint: None,
                plain_message: Some(format!("未识别的 AI 工具类型: {}", agent_id)),
            })?;

        let cfg_path = Self::resolve_config_path(agent_id, project_root);
        if !cfg_path.exists() {
            return Ok(format!("{} 尚未配置 DevOS，无需卸载", meta.name));
        }

        // Backup before removal
        Self::create_backup(agent_id, &cfg_path)?;

        match meta.format {
            ConfigFormat::CodexToml => {
                if let Ok(content) = read_to_string(&cfg_path) {
                    if let Ok(mut doc) = content.parse::<DocumentMut>() {
                        if let Some(servers) = doc
                            .get_mut("mcp_servers")
                            .and_then(|i| i.as_table_like_mut())
                        {
                            servers.remove("devos");
                        }
                        atomic_write(&cfg_path, doc.to_string())?;
                    }
                }
            }
            ConfigFormat::OpenCodeJson => {
                if let Ok(mut val) = read_json::<_, Value>(&cfg_path) {
                    if let Some(mcp) = val.get_mut("mcp").and_then(|v| v.as_object_mut()) {
                        mcp.remove("devos");
                    }
                    atomic_write_json(&cfg_path, &val)?;
                }
            }
            ConfigFormat::VsCodeJson => {
                if let Ok(mut val) = read_json::<_, Value>(&cfg_path) {
                    if let Some(servers) = val.get_mut("servers").and_then(|v| v.as_object_mut()) {
                        servers.remove("devos");
                    }
                    if let Some(mcp) = val.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
                        mcp.remove("devos");
                    }
                    atomic_write_json(&cfg_path, &val)?;
                }
            }
            ConfigFormat::StandardJson => {
                if let Ok(mut val) = read_json::<_, Value>(&cfg_path) {
                    if let Some(servers) = val.get_mut("mcpServers").and_then(|v| v.as_object_mut())
                    {
                        servers.remove("devos");
                    }
                    atomic_write_json(&cfg_path, &val)?;
                }
            }
        }

        // Remove project skill if in project
        if let Some(root) = project_root {
            let skill_dir = root.join(".agents").join("skills").join("devos");
            if skill_dir.exists() {
                let _ = fs::remove_dir_all(&skill_dir);
            }
        }

        Ok(format!(
            "已成功为 {} 卸载 DevOS MCP 服务，未修改其他配置",
            meta.name
        ))
    }

    /// Generate manual configuration snippet for closed or manual tools (e.g. TRAE)
    pub fn get_manual_config_snippet(agent_id: &str, mcp_bin: Option<&Path>) -> String {
        let bin = mcp_bin
            .map(|p| p.to_path_buf())
            .unwrap_or_else(Self::resolve_mcp_bin_path);
        let bin_str = bin.display().to_string();

        if agent_id == "codex" {
            format!(
                r#"[mcp_servers.devos]
command = "{}"
args = []
"#,
                bin_str
            )
        } else if agent_id == "opencode" {
            format!(
                r#"{{
  "mcp": {{
    "devos": {{
      "type": "local",
      "command": ["{}"]
    }}
  }}
}}"#,
                bin_str
            )
        } else {
            format!(
                r#"{{
  "mcpServers": {{
    "devos": {{
      "command": "{}",
      "args": []
    }}
  }}
}}"#,
                bin_str
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_supported_adapters_matrix() {
        let adapters = AgentConfigManager::supported_adapters();
        assert!(adapters.len() >= 9);
        assert!(adapters.iter().any(|a| a.id == "codebuddy"));
        assert!(adapters.iter().any(|a| a.id == "trae"));
        assert!(adapters.iter().any(|a| a.id == "qoder"));
        assert!(adapters.iter().any(|a| a.id == "kimi_code"));
        assert!(adapters.iter().any(|a| a.id == "codex"));
        assert!(adapters.iter().any(|a| a.id == "opencode"));
    }

    #[test]
    fn test_surgical_codex_toml() {
        let dir = tempdir().unwrap();
        let cfg = dir.path().join("config.toml");
        atomic_write(&cfg, "# Original user comments\n[theme]\ndark = true\n").unwrap();

        AgentConfigManager::merge_codex_toml(&cfg, "/usr/bin/devos-mcp").unwrap();

        let updated = read_to_string(&cfg).unwrap();
        assert!(updated.contains("Original user comments"));
        assert!(updated.contains("[mcp_servers.devos]"));
        assert!(updated.contains("command = \"/usr/bin/devos-mcp\""));
        assert!(AgentConfigManager::is_mcp_configured(
            &cfg,
            ConfigFormat::CodexToml
        ));
    }

    #[test]
    fn test_surgical_standard_json_backup_and_uninstall() {
        let dir = tempdir().unwrap();
        let cfg = dir.path().join(".mcp.json");
        atomic_write_json(
            &cfg,
            &json!({
                "mcpServers": {
                    "other_tool": { "command": "other" }
                }
            }),
        )
        .unwrap();

        AgentConfigManager::merge_standard_json(&cfg, "/usr/bin/devos-mcp", "qoder").unwrap();
        assert!(AgentConfigManager::is_mcp_configured(
            &cfg,
            ConfigFormat::StandardJson
        ));

        let content: Value = read_json(&cfg).unwrap();
        assert!(content["mcpServers"]["other_tool"].is_object());
        assert!(content["mcpServers"]["devos"].is_object());

        // Test skill injection
        AgentConfigManager::inject_project_skill(dir.path()).unwrap();
        assert!(dir.path().join(".agents/skills/devos/SKILL.md").exists());

        // Test uninstall
        AgentConfigManager::uninstall_agent_config("project_mcp", Some(dir.path())).unwrap();
        let uninstalled: Value = read_json(&cfg).unwrap();
        assert!(uninstalled["mcpServers"]["other_tool"].is_object());
        assert!(uninstalled["mcpServers"]["devos"].is_null());
        assert!(!dir.path().join(".agents/skills/devos").exists());
    }
}
