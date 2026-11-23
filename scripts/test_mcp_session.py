#!/usr/bin/env python3
"""
Simulate an external Agent session communicating with devos-mcp via stdio JSON-RPC 2.0.
"""

import json
import subprocess
import sys
from pathlib import Path

def run_mcp_test(project_dir: Path):
    mcp_binary = Path("/Users/macos/devos/target/debug/devos-mcp")
    if not mcp_binary.exists():
        print(f"Building devos-mcp first...")
        subprocess.run(["cargo", "build", "-p", "devos-mcp"], cwd="/Users/macos/devos", check=True)

    proc = subprocess.Popen(
        [str(mcp_binary)],
        cwd=str(project_dir),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    def send(msg):
        payload = json.dumps(msg)
        proc.stdin.write(payload + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        return json.loads(line)

    print("1. Sending 'initialize'...")
    resp = send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
    assert resp.get("result", {}).get("serverInfo", {}).get("name") == "devos-mcp"
    print("   ✓ Server initialized successfully.")

    print("2. Sending 'tools/list'...")
    resp = send({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    tools = resp.get("result", {}).get("tools", [])
    tool_names = [t["name"] for t in tools]
    print(f"   ✓ Available tools ({len(tool_names)}): {', '.join(tool_names)}")
    assert "get_project_brief" in tool_names
    assert "submit_for_testing" in tool_names
    assert "resolve_issue" in tool_names

    print("3. Calling 'get_project_brief'...")
    resp = send({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "get_project_brief",
            "arguments": {"include_standards": True}
        }
    })
    raw_text = resp["result"]["content"][0]["text"]
    brief_data = json.loads(raw_text)
    assert brief_data["ok"] is True
    print(f"   ✓ Brief received: Project '{brief_data['data']['name']}' (type: {brief_data['data']['project_type']})")

    print("4. Calling 'update_board_card' (Create new task)...")
    resp = send({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "update_board_card",
            "arguments": {
                "title": "测试自动化生成的看板任务",
                "column": "doing",
                "note": "由 Agent 经由 MCP 创建并开发中"
            }
        }
    })
    raw_text = resp["result"]["content"][0]["text"]
    card_data = json.loads(raw_text)
    assert card_data["ok"] is True
    card_id = card_data["data"]["card_id"]
    print(f"   ✓ Card created on board: {card_id}")

    print("5. Calling 'submit_for_testing' (Submit验收单)...")
    resp = send({
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "submit_for_testing",
            "arguments": {
                "card_id": card_id,
                "summary_plain": "核心接口开发完成，包含 3 项冒烟自检",
                "test_checklist": [
                    {"step": 1, "action": "检查输入参数", "expected": "格式合法校验通过"},
                    {"step": 2, "action": "执行计算逻辑", "expected": "耗时小于 200ms"},
                    {"step": 3, "action": "查看返回结果", "expected": "包含预期字段"}
                ]
            }
        }
    })
    raw_text = resp["result"]["content"][0]["text"]
    submit_data = json.loads(raw_text)
    assert submit_data["ok"] is True
    assert submit_data["data"]["column"] == "testing"
    print(f"   ✓ Card {card_id} successfully moved to 'testing' with 3 checklist steps.")

    print("6. Simulating user feedback (create Issue ISS-001)...")
    # Using devos CLI to create an issue
    subprocess.run([
        "cargo", "run", "-p", "devos-cli", "--",
        "--project-dir", str(project_dir),
        "issue", "create",
        "--title", "测试发票解析日期格式异常",
        "--description", "在测试第 3 步时发现日期未转换为 YYYY-MM-DD",
    ], cwd="/Users/macos/devos", check=False)

    print("7. Agent calling 'list_issues'...")
    resp = send({
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": {
            "name": "list_issues",
            "arguments": {"status": "all"}
        }
    })
    raw_text = resp["result"]["content"][0]["text"]
    issues_data = json.loads(raw_text)
    assert issues_data["ok"] is True
    print(f"   ✓ Agent retrieved {len(issues_data['data'])} issues from workspace.")

    if len(issues_data['data']) > 0:
        first_issue_id = issues_data['data'][0]["issue_id"]
        print(f"8. Agent calling 'resolve_issue' for {first_issue_id}...")
        resp = send({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "resolve_issue",
                "arguments": {
                    "issue_id": first_issue_id,
                    "fix_summary_plain": "已标准化日期解析为 ISO-8601 格式，并在容器内通过校验",
                    "changed_files": ["scripts/parse.py"],
                    "knowledge_note": {
                        "title": "发票日期字段解析避坑规范",
                        "content": "多地税控系统发票日期存在斜杠与中杠混用情况，统一使用 dateutil 解析并规范化为 YYYY-MM-DD。"
                    }
                }
            }
        })
        raw_text = resp["result"]["content"][0]["text"]
        resolve_data = json.loads(raw_text)
        assert resolve_data["ok"] is True
        assert resolve_data["data"]["status"] == "ready_for_retest"
        print(f"   ✓ Issue {first_issue_id} marked as 'ready_for_retest' with knowledge note deposited.")

    proc.terminate()
    print("\n🎉 MCP 端到端仿真会话全部验证通过！")

if __name__ == "__main__":
    test_dir = Path("/tmp/test-scaffold")
    if not test_dir.exists():
        subprocess.run([
            "python3", "/Users/macos/devos/scripts/scaffold_template.py",
            "--template", "hybrid-starter",
            "--dest", str(test_dir),
            "--slug", "demo-app",
            "--name", "Demo App"
        ], check=True)

    run_mcp_test(test_dir)
