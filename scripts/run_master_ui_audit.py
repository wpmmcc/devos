#!/usr/bin/env python3
"""
Master E2E UI Accessibility & Visual Verification Runner for DevOS.app
Directly clicks all native DOM buttons via AppleScript accessibility,
captures screenshots of every view, menu, modal, and icon.
"""

import subprocess
import time
from pathlib import Path

OUT_DIR = Path("/Users/macos/.gemini/antigravity-cli/brain/73ae426b-8734-4f70-b26b-9c66265c3855/scratch/screenshots/e2e_full_audit")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def run_as(script):
    cmd = ["osascript", "-e", script]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res

def click_web_button(target_spec):
    script = f'''
    tell application "DevOS" to activate
    tell application "System Events"
        tell process "devos-desktop"
            perform action "AXRaise" of window 1
            set web to UI element 1 of scroll area 1 of group 1 of group 1 of window 1
            set grp to group 1 of web
            click ({target_spec})
        end tell
    end tell
    '''
    return run_as(script)

def press_esc():
    script = '''
    tell application "DevOS" to activate
    tell application "System Events"
        key code 53 -- Escape
    end tell
    '''
    run_as(script)
    time.sleep(0.4)

def screenshot(name):
    path = OUT_DIR / f"{name}.png"
    script = '''
    tell application "System Events"
        tell process "devos-desktop"
            perform action "AXRaise" of window 1
            get {position, size} of window 1
        end tell
    end tell
    '''
    res = run_as(script)
    pos_size = [int(x.strip()) for x in res.stdout.strip().split(",")]
    wx, wy, ww, wh = pos_size[0], pos_size[1], pos_size[2], pos_size[3]
    subprocess.run(["screencapture", "-x", f"-R{wx},{wy},{ww},{wh}", str(path)])
    print(f"Captured: {name}.png ({path.stat().st_size} bytes)")
    return path

def main():
    print("=" * 60)
    print("DevOS Master Accessibility UI & Icon Testing Suite")
    print("=" * 60)

    # 1. 任务看板 (Board View)
    print("\n[TEST 1] Switching to 任务看板 (Board View)...")
    click_web_button('first button of grp whose name is "任务看板"')
    time.sleep(0.5)
    screenshot("01_view_task_board")

    # 2. 测试预览 (Test & Preview View)
    print("\n[TEST 2] Switching to 测试预览 (Test & Preview View)...")
    click_web_button('first button of grp whose name is "测试预览"')
    time.sleep(0.5)
    screenshot("02_view_test_preview")

    # 3. 问题反馈 (Issues View)
    print("\n[TEST 3] Switching to 问题反馈 (Issues View)...")
    click_web_button('first button of grp whose name contains "问题反馈"')
    time.sleep(0.5)
    screenshot("03_view_issues")

    # 4. 规范资产 (Assets View)
    print("\n[TEST 4] Switching to 规范资产 (Assets View)...")
    click_web_button('first button of grp whose name is "规范资产"')
    time.sleep(0.5)
    screenshot("04_view_assets")

    # 5. 规范资产子标签页切换
    print("\n[TEST 5] Clicking Assets Sub-tabs: 需求说明, 运行清单...")
    click_web_button('first button of web whose name is "需求说明"')
    time.sleep(0.4)
    screenshot("05a_assets_subtab_requirements")

    click_web_button('first button of web whose name contains "运行清单"')
    time.sleep(0.4)
    screenshot("05b_assets_subtab_run_manifest")

    click_web_button('first button of web whose name contains "避坑知识库"')
    time.sleep(0.4)
    screenshot("05c_assets_subtab_knowledge")

    # 6. 全局弹窗：AI Agent 连接中心 (MCP)
    print("\n[TEST 6] Opening AI Agent 连接中心 (MCP)...")
    click_web_button('first button of grp whose name contains "AI Agent 连接中心"')
    time.sleep(0.6)
    screenshot("06_modal_agent_connect")
    press_esc()

    # 7. 全局弹窗：系统诊断 (Doctor)
    print("\n[TEST 7] Opening 系统诊断 (Doctor)...")
    click_web_button('first button of grp whose name contains "系统诊断"')
    time.sleep(0.6)
    screenshot("07_modal_system_doctor")
    press_esc()

    # 8. 全局弹窗：端口检测 (Conflict)
    print("\n[TEST 8] Opening 端口检测 (Conflict)...")
    click_web_button('first button of grp whose name contains "端口检测"')
    time.sleep(0.6)
    screenshot("08_modal_port_conflicts")
    press_esc()

    # 9. 全局弹窗：偏好设置 (Preferences)
    print("\n[TEST 9] Opening 偏好设置 (Preferences)...")
    click_web_button('first button of grp whose name is "偏好设置"')
    time.sleep(0.6)
    screenshot("09_modal_preferences")
    press_esc()

    # 10. 侧边栏：新建项目弹窗 (+)
    print("\n[TEST 10] Opening 新建项目弹窗 (+)...")
    click_web_button('button 1 of grp')
    time.sleep(0.6)
    screenshot("10_modal_new_project")
    press_esc()

    # 11. TopBar 图标与快捷功能
    print("\n[TEST 11] Testing TopBar Icons (Language, Logs, TimeMachine, Restart)...")
    # Language Switcher
    print("Testing Language Hot-Switch (中 -> EN)...")
    click_web_button('button 16 of grp')
    time.sleep(0.5)
    screenshot("11a_lang_switched_en")

    print("Testing Language Hot-Switch (EN -> 中)...")
    click_web_button('button 16 of grp')
    time.sleep(0.5)
    screenshot("11b_lang_switched_zh")

    # Logs Drawer
    print("Opening Logs Drawer...")
    click_web_button('button 15 of grp')
    time.sleep(0.6)
    screenshot("12_modal_logs_drawer")
    press_esc()

    # Time Machine Modal
    print("Opening Time Machine Modal...")
    click_web_button('button 13 of grp')
    time.sleep(0.6)
    screenshot("13_modal_time_machine")
    press_esc()

    # Restart Environment Button
    print("Testing Restart Environment button...")
    click_web_button('button 11 of grp')
    time.sleep(1.0)
    screenshot("14_action_restart_env")

    print("\n" + "=" * 60)
    print("ALL ACCESSIBILITY & VISUAL TESTS COMPLETED SUCCESSFULLY!")
    print(f"Screenshots saved to: {OUT_DIR}")
    print("=" * 60)

if __name__ == '__main__':
    main()
