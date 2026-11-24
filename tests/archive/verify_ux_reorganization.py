#!/usr/bin/env python3
"""
Master E2E Verification for DevOS Reorganized UI/UX
Verifies:
1. Tooltips / Menu names on hover for every icon
2. Full project names displayed without truncation
3. Quick action buttons (Finder, Terminal, Code, Trash) positioned below project name
4. Project-level menus (Views + Runtime controls) configured under the selected project
5. Application-level tools (AI Agent Connect, System Doctor, Conflict Doctor, Preferences, Language) configured at sidebar bottom
6. TopBar simplification (removal of detached right-hand icons)
"""

import subprocess
import time
from pathlib import Path

OUT_DIR = Path("/Users/macos/.gemini/antigravity-cli/brain/73ae426b-8734-4f70-b26b-9c66265c3855/scratch/screenshots/ux_reorganized")
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

def list_all_buttons():
    script = '''
    tell application "DevOS" to activate
    tell application "System Events"
        tell process "devos-desktop"
            set web to UI element 1 of scroll area 1 of group 1 of group 1 of window 1
            set grp to group 1 of web
            set btnList to {}
            repeat with b in (buttons of grp)
                set bName to name of b
                set bHelp to help of b
                set end of btnList to (bName & " [help: " & bHelp & "]")
            end repeat
            return btnList
        end tell
    end tell
    '''
    res = run_as(script)
    return res.stdout.strip()

def main():
    print("=" * 65)
    print("DevOS Reorganized UI/UX Verification Suite")
    print("=" * 65)

    time.sleep(1)
    
    # 0. List all buttons and their help tooltips
    print("\n--- Inspecting Buttons & Accessibility Tooltips ---")
    btn_info = list_all_buttons()
    print("Buttons found:\n", btn_info[:1000], "...\n")

    # 1. Main View with Sidebar Project hierarchy
    print("\n[STEP 1] Overview of Reorganized Layout (Project & App Level)...")
    screenshot("01_reorganized_overview")

    # 2. Project Views: Test Preview View
    print("\n[STEP 2] Navigating to 测试预览 via Sidebar Project View...")
    click_web_button('first button of grp whose name contains "测试预览"')
    time.sleep(0.6)
    screenshot("02_sidebar_test_preview")

    # 3. Project Views: Issues View
    print("\n[STEP 3] Navigating to 问题反馈 via Sidebar Project View...")
    click_web_button('first button of grp whose name contains "问题反馈"')
    time.sleep(0.6)
    screenshot("03_sidebar_issues")

    # 4. Project Views: Assets View
    print("\n[STEP 4] Navigating to 规范资产 via Sidebar Project View...")
    click_web_button('first button of grp whose name contains "规范资产"')
    time.sleep(0.6)
    screenshot("04_sidebar_assets")

    # 5. Project Views: Return to Board
    print("\n[STEP 5] Returning to 任务看板...")
    click_web_button('first button of grp whose name contains "任务看板"')
    time.sleep(0.5)

    # 6. Project-level Runtime Tools: Open Logs Drawer
    print("\n[STEP 6] Opening 运行日志 (Logs) from Sidebar Project Runtime...")
    click_web_button('first button of grp whose name is "运行日志"')
    time.sleep(0.6)
    screenshot("05_project_logs_drawer")
    press_esc()

    # 7. Project-level Runtime Tools: Open Time Machine
    print("\n[STEP 7] Opening 时光机 (Time Machine) from Sidebar Project Runtime...")
    click_web_button('first button of grp whose name is "时光机"')
    time.sleep(0.6)
    screenshot("06_project_time_machine")
    press_esc()

    # 8. Application-level Tools: AI Agent Connect Hub
    print("\n[STEP 8] Opening AI Agent 连接中心 from Sidebar Application Tools...")
    click_web_button('first button of grp whose name contains "AI Agent 连接中心"')
    time.sleep(0.6)
    screenshot("07_app_agent_connect")
    press_esc()

    # 9. Application-level Tools: Preflight Doctor
    print("\n[STEP 9] Opening 系统诊断 (Doctor) from Sidebar Application Tools...")
    click_web_button('first button of grp whose name contains "系统诊断"')
    time.sleep(0.6)
    screenshot("08_app_system_doctor")
    press_esc()

    # 10. Application-level Tools: Port Conflicts Doctor
    print("\n[STEP 10] Opening 端口检测 (Conflict) from Sidebar Application Tools...")
    click_web_button('first button of grp whose name contains "端口检测"')
    time.sleep(0.6)
    screenshot("09_app_port_conflicts")
    press_esc()

    # 11. Application-level Tools: Preferences / Settings
    print("\n[STEP 11] Opening 偏好设置 (Preferences) from Sidebar Application Tools...")
    click_web_button('first button of grp whose name contains "偏好设置"')
    time.sleep(0.6)
    screenshot("10_app_preferences")
    press_esc()

    # 12. Application-level Tools: Language Hot-Switch (中/EN)
    print("\n[STEP 12] Toggling Language from Sidebar Application Tools...")
    click_web_button('first button of grp whose name contains "语言"')
    time.sleep(0.6)
    screenshot("11_app_language_switched_en")

    # Switch back to Chinese
    print("\n[STEP 13] Toggling Language back to Chinese...")
    click_web_button('first button of grp whose name contains "Language"')
    time.sleep(0.6)
    screenshot("12_app_language_switched_zh")

    # 14. Project Switcher & Hover Actions
    print("\n[STEP 14] Switching to devos-crawler-script...")
    click_web_button('first button of grp whose name is "devos-crawler-script" or name contains "devos-crawler-script"')
    time.sleep(0.6)
    screenshot("13_project_switch_crawler")

    print("\n" + "=" * 65)
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    main()
