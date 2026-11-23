use devos_core::{BoardManager, DevosError, IssueManager, ProjectManager, Result};
use devos_env::{DdevDriver, DevcontainerDriver, EnvDriver};
use devos_schema::{ApiResponse, BoardColumn, ChecklistStep, DevosProject, ProjectType};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<Value>,
}

fn get_project_context() -> Result<(PathBuf, DevosProject)> {
    let curr = std::env::current_dir().unwrap_or_default();
    ProjectManager::find_and_load(curr)
}

fn tool_definitions() -> Value {
    json!([
        {
            "name": "get_project_brief",
            "description": "获取项目元信息、运行环境、项目标准与未结任务概要。Agent 会话开始时首选调用。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "include_standards": { "type": "boolean", "description": "是否包含完整的 standards/ 规范内容" },
                    "include_open_issues": { "type": "boolean", "description": "是否包含当前未解决的 Issue 列表" }
                }
            }
        },
        {
            "name": "env_control",
            "description": "统一操控隔离容器环境（DDEV 或 Dev Container），支持状态查询、启动、停止、容器内执行命令与快照。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "target": { "type": "string", "enum": ["web", "script"], "description": "目标环境类型" },
                    "action": { "type": "string", "enum": ["status", "up", "down", "exec", "snapshot", "restore"] },
                    "command": { "type": "string", "description": "action 为 exec 时在容器内执行的命令" },
                    "snapshot_name": { "type": "string", "description": "快照名称" }
                },
                "required": ["action"]
            }
        },
        {
            "name": "sync_project_assets",
            "description": "写入或更新需求文档、开发规范、使用文档、避坑知识库或 devos.run.json 脚本声明。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "asset_type": { "type": "string", "enum": ["requirement", "doc", "knowledge", "run_manifest"] },
                    "title": { "type": "string" },
                    "content": { "type": "string" },
                    "id": { "type": "string" }
                },
                "required": ["asset_type", "title", "content"]
            }
        },
        {
            "name": "update_board_card",
            "description": "创建或流转看板任务卡片。护栏规定：Agent 禁止直接将卡片移至 done，必须先调用 submit_for_testing 提测。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "card_id": { "type": "string", "description": "卡片 ID，如 CARD-001。不填则创建新卡片" },
                    "title": { "type": "string" },
                    "column": { "type": "string", "enum": ["todo", "doing", "testing", "done"] },
                    "note": { "type": "string" }
                },
                "required": ["column"]
            }
        },
        {
            "name": "submit_for_testing",
            "description": "标准化提测交接：机器先执行烟雾检查，通过后自动将卡片移入 testing 并向用户桌面推送白话验收清单。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "card_id": { "type": "string" },
                    "summary_plain": { "type": "string", "description": "面向小白用户的白话交付总结" },
                    "test_checklist": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step": { "type": "number" },
                                "action": { "type": "string" },
                                "expected": { "type": "string" }
                            },
                            "required": ["step", "action", "expected"]
                        },
                        "description": "3~5条供用户在界面逐条操作打勾的验收清单"
                    },
                    "run_target_ids": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["card_id", "summary_plain", "test_checklist"]
            }
        },
        {
            "name": "list_issues",
            "description": "拉取用户提交或测试失败的标准化 Issue，含小白描述、截图、控制台报错堆栈或脚本退出码。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "status": { "type": "string", "enum": ["open", "reopened", "in_progress", "all"] }
                }
            }
        },
        {
            "name": "resolve_issue",
            "description": "提交 Issue 修复说明并将 Issue 置为 ready_for_retest，提醒用户复测，并可选沉淀避坑知识。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "issue_id": { "type": "string" },
                    "fix_summary_plain": { "type": "string", "description": "面向小白的白话修复说明" },
                    "changed_files": { "type": "array", "items": { "type": "string" } },
                    "knowledge_note": {
                        "type": "object",
                        "properties": {
                            "title": { "type": "string" },
                            "content": { "type": "string" }
                        }
                    }
                },
                "required": ["issue_id", "fix_summary_plain"]
            }
        },
        {
            "name": "request_user_decision",
            "description": "遇到方案二选一或需求歧义时，向用户发起结构化决策询问，支持桌面与终端交互。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question_plain": { "type": "string" },
                    "context_plain": { "type": "string" },
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": { "type": "string" },
                                "label": { "type": "string" },
                                "tradeoff": { "type": "string" }
                            },
                            "required": ["id", "label"]
                        }
                    }
                },
                "required": ["question_plain", "options"]
            }
        }
    ])
}

fn execute_tool(name: &str, arguments: &Value) -> Value {
    let res: Result<Value> = (|| {
        let (root, project) = get_project_context()?;
        match name {
            "get_project_brief" => {
                let include_standards = arguments["include_standards"].as_bool().unwrap_or(true);
                let include_issues = arguments["include_open_issues"].as_bool().unwrap_or(true);

                let cards = BoardManager::list_cards(&root, &project)?;
                let issues = IssueManager::list_issues(&root, &project, Some("open"))?;

                let locale = std::env::var("DEVOS_LOCALE").unwrap_or_else(|_| "zh-CN".to_string());
                let mut brief = json!({
                    "project_id": project.project_id,
                    "slug": project.slug,
                    "name": project.name,
                    "description": project.description,
                    "project_type": project.project_type,
                    "mode": project.mode,
                    "environments": project.environments,
                    "board_cards_count": cards.len(),
                    "open_issues_count": issues.len(),
                    "user_locale": locale,
                    "agent_instructions": format!(
                        "请使用当前用户的语言 ({}) 编写白话总结、提测清单与问题排查说明。所有依赖安装与测试命令必须调用 env_control 在容器内执行。",
                        locale
                    ),
                });

                if include_standards {
                    let standards_dir = root.join(&project.workspace_paths.standards);
                    let mut list = Vec::new();
                    if standards_dir.exists() {
                        for e in std::fs::read_dir(standards_dir)?.flatten() {
                            if let Ok(s) = std::fs::read_to_string(e.path()) {
                                list.push(s);
                            }
                        }
                    }
                    brief["standards"] = json!(list);
                }

                if include_issues {
                    brief["open_issues"] = json!(issues);
                }

                Ok(brief)
            }

            "env_control" => {
                let action = arguments["action"].as_str().unwrap_or("status");
                let target = arguments["target"].as_str().unwrap_or("auto");
                let driver: Box<dyn EnvDriver> = match (target, &project.project_type) {
                    ("script", _) => Box::new(DevcontainerDriver::new()),
                    ("web", _) => Box::new(DdevDriver::new()),
                    (_, ProjectType::Script) => Box::new(DevcontainerDriver::new()),
                    _ => Box::new(DdevDriver::new()),
                };

                match action {
                    "status" => Ok(serde_json::to_value(driver.status(&root)?)?),
                    "up" => Ok(serde_json::to_value(driver.up(&root)?)?),
                    "down" => {
                        devos_core::Guardrails::check_destructive_allowed(&project, "down")?;
                        driver.down(&root)?;
                        Ok(json!({ "stopped": true }))
                    }
                    "exec" => {
                        let cmd = arguments["command"].as_str().ok_or_else(|| DevosError::Custom {
                            code: "MISSING_COMMAND".to_string(),
                            message: "Missing 'command' argument".to_string(),
                            hint: None,
                            plain_message: None,
                        })?;
                        let exec_res = driver.exec(&root, cmd, 60, &[])?;
                        Ok(serde_json::to_value(exec_res)?)
                    }
                    "snapshot" => {
                        let name = arguments["snapshot_name"].as_str().unwrap_or("mcp_snap");
                        driver.snapshot(&root, name)?;
                        Ok(json!({ "snapshot": name }))
                    }
                    "restore" => {
                        let name = arguments["snapshot_name"].as_str().unwrap_or("mcp_snap");
                        devos_core::Guardrails::check_destructive_allowed(&project, "restore")?;
                        driver.restore(&root, name)?;
                        Ok(json!({ "restored": name }))
                    }
                    _ => Err(DevosError::Custom {
                        code: "UNKNOWN_ACTION".to_string(),
                        message: format!("Unknown env action {}", action),
                        hint: None,
                        plain_message: None,
                    }),
                }
            }

            "update_board_card" => {
                let card_id = arguments["card_id"].as_str().map(|s| s.to_string());
                let title = arguments["title"].as_str().map(|s| s.to_string());
                let col = match arguments["column"].as_str() {
                    Some("doing") => BoardColumn::Doing,
                    Some("testing") => BoardColumn::Testing,
                    Some("done") => BoardColumn::Done,
                    _ => BoardColumn::Todo,
                };
                let note = arguments["note"].as_str().map(|s| s.to_string());
                let card = BoardManager::upsert_card(
                    &root,
                    &project,
                    card_id,
                    title,
                    col,
                    "agent",
                    None,
                    note,
                )?;
                Ok(serde_json::to_value(card)?)
            }

            "submit_for_testing" => {
                let card_id = arguments["card_id"].as_str().ok_or_else(|| DevosError::Custom {
                    code: "MISSING_CARD_ID".to_string(),
                    message: "card_id is required".to_string(),
                    hint: None,
                    plain_message: None,
                })?;
                let summary = arguments["summary_plain"].as_str().unwrap_or("功能提测");
                let steps: Vec<ChecklistStep> = serde_json::from_value(
                    arguments["test_checklist"].clone()
                ).unwrap_or_default();
                let targets: Vec<String> = serde_json::from_value(
                    arguments["run_target_ids"].clone()
                ).unwrap_or_default();

                // Check smoke & requirements before submission
                devos_core::Guardrails::check_smoke_before_testing(&root, &project)?;

                let card = BoardManager::submit_for_testing(
                    &root,
                    &project,
                    card_id,
                    summary,
                    steps,
                    targets,
                )?;
                Ok(serde_json::to_value(card)?)
            }

            "list_issues" => {
                let status = arguments["status"].as_str();
                let issues = IssueManager::list_issues(&root, &project, status)?;
                Ok(serde_json::to_value(issues)?)
            }

            "resolve_issue" => {
                let issue_id = arguments["issue_id"].as_str().ok_or_else(|| DevosError::Custom {
                    code: "MISSING_ISSUE_ID".to_string(),
                    message: "issue_id is required".to_string(),
                    hint: None,
                    plain_message: None,
                })?;
                let fix_summary = arguments["fix_summary_plain"].as_str().unwrap_or("");
                let changed_files: Vec<String> = serde_json::from_value(
                    arguments["changed_files"].clone()
                ).unwrap_or_default();

                let k_note = if let Some(kn) = arguments.get("knowledge_note") {
                    let title = kn["title"].as_str().unwrap_or("避坑指南").to_string();
                    let content = kn["content"].as_str().unwrap_or("").to_string();
                    Some((title, content))
                } else {
                    None
                };

                let issue = IssueManager::resolve_issue(
                    &root,
                    &project,
                    issue_id,
                    fix_summary,
                    changed_files,
                    k_note,
                )?;
                Ok(serde_json::to_value(issue)?)
            }

            "sync_project_assets" => {
                let asset_type = arguments["asset_type"].as_str().unwrap_or("doc");
                let title = arguments["title"].as_str().unwrap_or("Untitled");
                let content = arguments["content"].as_str().unwrap_or("");
                let subfolder = match asset_type {
                    "requirement" => &project.workspace_paths.requirements,
                    "knowledge" => &project.workspace_paths.knowledge,
                    _ => &project.workspace_paths.docs,
                };
                let id = arguments["id"].as_str().map(|s| s.to_string()).unwrap_or_else(|| {
                    format!("{}_{}", asset_type, uuid::Uuid::new_v4().simple())
                });
                let file_path = root.join(subfolder).join(format!("{}.md", id));
                devos_core::atomic_write(&file_path, format!("# {}\n\n{}", title, content))?;
                Ok(json!({ "saved": true, "path": file_path.display().to_string() }))
            }

            "request_user_decision" => {
                let q = arguments["question_plain"].as_str().unwrap_or("");
                let c = arguments["context_plain"].as_str().unwrap_or("");
                let opts = arguments["options"].clone();
                let decision_id = format!("DEC-{}", uuid::Uuid::new_v4().simple());
                Ok(json!({
                    "decision_id": decision_id,
                    "status": "pending",
                    "question": q,
                    "context": c,
                    "options": opts
                }))
            }

            _ => Err(DevosError::Custom {
                code: "UNKNOWN_TOOL".to_string(),
                message: format!("Unknown tool: {}", name),
                hint: None,
                plain_message: None,
            }),
        }
    })();

    let api_response = match res {
        Ok(data) => ApiResponse::success(data),
        Err(e) => ApiResponse::error(
            e.error_code(),
            e.to_string(),
            e.hint(),
            Some(e.plain_message()),
        ),
    };

    let text_content = serde_json::to_string_pretty(&api_response).unwrap_or_default();
    json!({
        "content": [
            {
                "type": "text",
                "text": text_content
            }
        ]
    })
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--self-check") {
        let check_result = json!({
            "status": "ok",
            "name": "devos-mcp",
            "version": env!("CARGO_PKG_VERSION"),
            "protocolVersion": "2024-11-05",
            "tools_count": 8,
            "executable_ok": true
        });
        println!("{}", serde_json::to_string_pretty(&check_result).unwrap());
        return Ok(());
    }

    if args.iter().any(|a| a == "--version" || a == "-V") {
        println!("devos-mcp {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = stdout.lock();

    let mut line = String::new();
    while reader.read_line(&mut line)? > 0 {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            line.clear();
            continue;
        }

        if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(trimmed) {
            let id = req.id.unwrap_or(Value::Null);

            match req.method.as_str() {
                "initialize" => {
                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(json!({
                            "protocolVersion": "2024-11-05",
                            "capabilities": {
                                "tools": {}
                            },
                            "serverInfo": {
                                "name": "devos-mcp",
                                "version": env!("CARGO_PKG_VERSION")
                            }
                        })),
                        error: None,
                    };
                    writeln!(writer, "{}", serde_json::to_string(&resp)?)?;
                    writer.flush()?;
                }

                "notifications/initialized" => {
                    // Ack notification, no response required
                }

                "tools/list" => {
                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(json!({
                            "tools": tool_definitions()
                        })),
                        error: None,
                    };
                    writeln!(writer, "{}", serde_json::to_string(&resp)?)?;
                    writer.flush()?;
                }

                "tools/call" => {
                    let params = req.params.unwrap_or_default();
                    let tool_name = params["name"].as_str().unwrap_or("");
                    let arguments = &params["arguments"];
                    let tool_result = execute_tool(tool_name, arguments);

                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(tool_result),
                        error: None,
                    };
                    writeln!(writer, "{}", serde_json::to_string(&resp)?)?;
                    writer.flush()?;
                }

                _ => {
                    let resp = JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: None,
                        error: Some(json!({
                            "code": -32601,
                            "message": format!("Method not found: {}", req.method)
                        })),
                    };
                    writeln!(writer, "{}", serde_json::to_string(&resp)?)?;
                    writer.flush()?;
                }
            }
        }

        line.clear();
    }

    Ok(())
}
