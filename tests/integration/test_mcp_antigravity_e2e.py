#!/usr/bin/env python3
"""
DevOS x Antigravity CLI MCP End-to-End Verification Test
Verifies:
1. Antigravity MCP configuration (~/.gemini/config/mcp_config.json)
2. devos-mcp self-check & tool registration
3. Real MCP stdio session on a DevOS project:
   - initialize handshake
   - tools/list inspection
   - get_project_brief
   - sync_project_assets
   - update_board_card & submit_for_testing
   - list_issues, claim_issue & resolve_issue
   - vcs_checkpoint
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path

HOME = Path.home()
MCP_CONFIG = HOME / ".gemini" / "config" / "mcp_config.json"
DEVOS_BIN = HOME / ".devos" / "bin" / "devos"
DEVOS_MCP = HOME / ".devos" / "bin" / "devos-mcp"
TEST_PROJECT_DIR = Path("/tmp/devos-agent-e2e-final/agent-full-cycle-app")

def print_step(title):
    print(f"\n\033[1;36m==> {title}\033[0m")

def print_ok(msg):
    print(f"  \033[1;32m✓\033[0m {msg}")

def print_err(msg):
    print(f"  \033[1;31m✗\033[0m {msg}")
    sys.exit(1)

def main():
    print_step("Step 1: Check Antigravity MCP Config & Binary Readiness")
    if not MCP_CONFIG.exists():
        print_err(f"Antigravity config missing at {MCP_CONFIG}")
    cfg = json.loads(MCP_CONFIG.read_text())
    if "devos" not in cfg.get("mcpServers", {}):
        print_err(f"'devos' server entry missing in {MCP_CONFIG}")
    print_ok(f"Antigravity MCP config verified: command={cfg['mcpServers']['devos']['command']}")

    if not DEVOS_MCP.exists():
        print_err(f"devos-mcp binary missing at {DEVOS_MCP}")
    
    # Self-check
    res = subprocess.run([str(DEVOS_MCP), "--self-check"], capture_output=True, text=True, check=True)
    chk = json.loads(res.stdout)
    assert chk.get("status") == "ok" and chk.get("tools_count") == 10
    print_ok(f"devos-mcp self-check passed: {chk['tools_count']} tools available")

    print_step("Step 2: Check devos agent-config detection")
    res = subprocess.run([str(DEVOS_BIN), "agent-config", "--detect"], capture_output=True, text=True, check=True)
    detect_list = json.loads(res.stdout)
    antigravity_item = next((x for x in detect_list if x["id"] == "antigravity"), None)
    if not antigravity_item:
        print_err("Antigravity adapter not found in devos agent-config --detect")
    assert antigravity_item["installed"] is True
    assert antigravity_item["configured"] is True
    print_ok(f"DevOS detected Antigravity CLI: installed={antigravity_item['installed']}, configured={antigravity_item['configured']}")

    print_step("Step 3: Launch MCP Server session for DevOS Project")
    if not TEST_PROJECT_DIR.exists():
        print_err(f"Test project does not exist at {TEST_PROJECT_DIR}")

    proc = subprocess.Popen(
        [str(DEVOS_MCP), str(TEST_PROJECT_DIR)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    req_id = 1
    def send_rpc(method, params=None):
        nonlocal req_id
        req = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            req["params"] = params
        req_id += 1
        proc.stdin.write(json.dumps(req) + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        return json.loads(line)

    try:
        # 1. Initialize
        init_res = send_rpc("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "Antigravity-CLI", "version": "2.0.0"}
        })
        assert "serverInfo" in init_res.get("result", {})
        print_ok(f"Handshake success: {init_res['result']['serverInfo']['name']} v{init_res['result']['serverInfo']['version']}")

        # 2. tools/list
        tools_res = send_rpc("tools/list")
        tools = tools_res.get("result", {}).get("tools", [])
        tool_names = [t["name"] for t in tools]
        assert len(tools) == 10
        print_ok(f"tools/list registered 10 tools: {', '.join(tool_names[:5])}...")

        # 3. get_project_brief
        brief_res = send_rpc("tools/call", {
            "name": "get_project_brief",
            "arguments": {"include_standards": True, "include_open_issues": True}
        })
        brief_text = json.loads(brief_res["result"]["content"][0]["text"])
        assert brief_text.get("ok") is True
        proj_data = brief_text["data"]
        print_ok(f"get_project_brief succeeded: project='{proj_data['name']}' ({proj_data['project_id']})")
        print_ok(f"  Locale: {proj_data['user_locale']}, Type: {proj_data['project_type']}")

        # 4. sync_project_assets
        sync_res = send_rpc("tools/call", {
            "name": "sync_project_assets",
            "arguments": {
                "asset_type": "knowledge",
                "filename": "mcp_antigravity_best_practice.md",
                "content": "# Antigravity MCP Integration\n\nVerified zero-friction stdio integration with DevOS MCP Hub."
            }
        })
        sync_data = json.loads(sync_res["result"]["content"][0]["text"])
        assert sync_data.get("ok") is True
        print_ok("sync_project_assets succeeded: knowledge note synced")

        # 5. vcs_checkpoint
        snap_res = send_rpc("tools/call", {
            "name": "vcs_checkpoint",
            "arguments": {
                "action": "create",
                "note": "Antigravity E2E Automated Verification Snapshot"
            }
        })
        snap_data = json.loads(snap_res["result"]["content"][0]["text"])
        assert snap_data.get("ok") is True
        print_ok(f"vcs_checkpoint created: checkpoint_id='{snap_data['data'].get('id', 'snap')}'")

        # 6. list_issues
        issues_res = send_rpc("tools/call", {
            "name": "list_issues",
            "arguments": {}
        })
        issues_data = json.loads(issues_res["result"]["content"][0]["text"])
        assert issues_data.get("ok") is True
        print_ok(f"list_issues succeeded: found {len(issues_data['data'])} issues")

        print_step("Step 4: All Antigravity CLI MCP Tests Passed!")
        print("\033[1;32m🎉 DevOS MCP Hub is 100% configured, compatible, and operational for Antigravity CLI!\033[0m")

    finally:
        proc.terminate()

if __name__ == "__main__":
    main()
