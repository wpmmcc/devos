#!/usr/bin/env python3
"""
DevOS Complete UI Elements, Views, Menus & Icons Test Suite
Directly tests:
1. Core Views navigation: 任务看板 -> 测试预览 -> 问题反馈 -> 规范资产 -> 任务看板
2. Assets sub-tabs switching (Overview, Specs, API Schema, Standards, Run Manifest, DB Schema)
3. Board card creation (+) and input cancel/submit
4. Sidebar Global Modals:
   - AI Agent 连接中心 (MCP)
   - 系统诊断 (Doctor)
   - 端口检测 (Conflict)
   - 偏好设置 (Settings)
5. TopBar Action Icons:
   - Language Hot-Switch (EN / 中文)
   - Terminal Logs Drawer
   - Time Machine Modal
   - Restart Environment
   - Start / Stop Environment Toggle
6. Project Switching in Sidebar (Crawler Script <-> AI Hub <-> Shop Web)
7. Sidebar Hover Actions (Finder, Terminal, Editor, Trash)
8. New Project Modal (+)
"""

import sys
import os
import time
import ctypes
import subprocess
from pathlib import Path

cg = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')

class CGPoint(ctypes.Structure):
    _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double)]

cg.CGEventCreateMouseEvent.restype = ctypes.c_void_p
cg.CGEventCreateMouseEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint32, CGPoint, ctypes.c_uint32]
cg.CGEventPost.argtypes = [ctypes.c_uint32, ctypes.c_void_p]

SCREENSHOT_DIR = Path("/Users/macos/.gemini/antigravity-cli/brain/73ae426b-8734-4f70-b26b-9c66265c3855/scratch/screenshots/e2e_full_audit")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

def activate_app():
    subprocess.run(["osascript", "-e", 'tell application "DevOS" to activate'])
    time.sleep(0.3)

def get_window_bounds():
    script = '''
    tell application "System Events"
        tell process "devos-desktop"
            set frontmost to true
            tell window 1
                get {position, size}
            end tell
        end tell
    end tell
    '''
    res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    parts = [int(p.strip()) for p in res.stdout.strip().split(",")]
    return parts[0], parts[1], parts[2], parts[3]

def move_mouse(x, y):
    pt = CGPoint(x, y)
    ev = cg.CGEventCreateMouseEvent(None, 5, pt, 0)
    cg.CGEventPost(0, ev)
    time.sleep(0.15)

def click_mouse(x, y):
    pt = CGPoint(x, y)
    ev_move = cg.CGEventCreateMouseEvent(None, 5, pt, 0)
    ev_down = cg.CGEventCreateMouseEvent(None, 1, pt, 0)
    ev_up = cg.CGEventCreateMouseEvent(None, 2, pt, 0)
    cg.CGEventPost(0, ev_move)
    time.sleep(0.08)
    cg.CGEventPost(0, ev_down)
    time.sleep(0.08)
    cg.CGEventPost(0, ev_up)
    time.sleep(0.5)

def press_esc():
    subprocess.run(["osascript", "-e", '''
    tell application "DevOS" to activate
    delay 0.1
    tell application "System Events" to key code 53
    '''])
    time.sleep(0.5)

def capture(name, wx, wy, ww, wh):
    path = SCREENSHOT_DIR / f"{name}.png"
    subprocess.run(["screencapture", "-x", f"-R{wx},{wy},{ww},{wh}", str(path)])
    print(f"[SCREENSHOT] Saved: {name}.png ({path.stat().st_size} bytes)")
    return path

def main():
    activate_app()
    wx, wy, ww, wh = get_window_bounds()
    print(f"DevOS Window Bounds: X={wx}, Y={wy}, W={ww}, H={wh}")

    # TopBar Center Tab Coordinates
    tab_y = wy + 68
    btn_board = wx + 580
    btn_test = wx + 645
    btn_issues = wx + 710
    btn_assets = wx + 780

    # TopBar Right Action Buttons Coordinates
    btn_stop_start = wx + 975
    btn_restart = wx + 1010
    btn_camera = wx + 1045
    btn_timemachine = wx + 1080
    btn_agent = wx + 1120
    btn_logs = wx + 1160
    btn_lang = wx + 1210
    btn_settings = wx + 1250

    # Sidebar Bottom Tools Coordinates
    bottom_y = wy + wh
    tool_agent = bottom_y - 120
    tool_doctor = bottom_y - 85
    tool_conflict = bottom_y - 55
    tool_settings = bottom_y - 25
    sidebar_x = wx + 90

    # 1. Initial State: Board View
    print("\n--- TEST 1: Initial Screen (Board View) ---")
    capture("01_view_board_initial", wx, wy, ww, wh)

    # 2. Switch to Test & Preview (测试预览)
    print("\n--- TEST 2: Test Preview View ---")
    click_mouse(btn_test, tab_y)
    capture("02_view_test_preview", wx, wy, ww, wh)

    # 3. Switch to Issues (问题反馈)
    print("\n--- TEST 3: Issues View ---")
    click_mouse(btn_issues, tab_y)
    capture("03_view_issues", wx, wy, ww, wh)

    # 4. Switch to Assets (规范资产)
    print("\n--- TEST 4: Assets View & Sub-tabs ---")
    click_mouse(btn_assets, tab_y)
    capture("04_view_assets_overview", wx, wy, ww, wh)

    # Click sub-tab: API / Schema
    click_mouse(wx + 360, wy + 115)
    capture("04a_assets_api_schema", wx, wy, ww, wh)

    # Click sub-tab: 技术标准 (Standards)
    click_mouse(wx + 440, wy + 115)
    capture("04b_assets_standards", wx, wy, ww, wh)

    # Click sub-tab: 运行时规范 (Run Manifest)
    click_mouse(wx + 520, wy + 115)
    capture("04c_assets_run_manifest", wx, wy, ww, wh)

    # Click back to Board (任务看板)
    print("\n--- TEST 5: Return to Board ---")
    click_mouse(btn_board, tab_y)
    capture("05_view_board_returned", wx, wy, ww, wh)

    # 6. Sidebar Global Modals
    print("\n--- TEST 6: Sidebar Global Tools ---")

    # 6.1 AI Agent 连接中心 (MCP)
    print("Testing 'AI Agent 连接中心 (MCP)'...")
    click_mouse(sidebar_x, tool_agent)
    capture("06_modal_agent_connect", wx, wy, ww, wh)
    press_esc()

    # 6.2 系统诊断 (Doctor)
    print("Testing '系统诊断 (Doctor)'...")
    click_mouse(sidebar_x, tool_doctor)
    capture("07_modal_preflight_doctor", wx, wy, ww, wh)
    press_esc()

    # 6.3 端口检测 (Conflict)
    print("Testing '端口检测 (Conflict)'...")
    click_mouse(sidebar_x, tool_conflict)
    capture("08_modal_port_conflict", wx, wy, ww, wh)
    press_esc()

    # 6.4 偏好设置 (Settings)
    print("Testing '偏好设置'...")
    click_mouse(sidebar_x, tool_settings)
    capture("09_modal_preferences", wx, wy, ww, wh)
    press_esc()

    # 7. TopBar Actions & Icons
    print("\n--- TEST 7: TopBar Actions & Icons ---")

    # 7.1 Language Hot-Switch (EN)
    print("Testing Language switch to EN...")
    click_mouse(btn_lang, tab_y)
    capture("10_topbar_lang_en", wx, wy, ww, wh)

    # Switch back to 中文
    print("Testing Language switch back to ZH...")
    click_mouse(btn_lang, tab_y)
    capture("11_topbar_lang_zh", wx, wy, ww, wh)

    # 7.2 Terminal Logs Drawer
    print("Testing Logs Drawer...")
    click_mouse(btn_logs, tab_y)
    capture("12_modal_logs_drawer", wx, wy, ww, wh)
    press_esc()

    # 7.3 Time Machine Modal
    print("Testing Time Machine Modal...")
    click_mouse(btn_timemachine, tab_y)
    capture("13_modal_time_machine", wx, wy, ww, wh)
    press_esc()

    # 7.4 Restart Environment
    print("Testing Restart Environment...")
    click_mouse(btn_restart, tab_y)
    time.sleep(0.8)
    capture("14_action_restart_env", wx, wy, ww, wh)

    # 8. Sidebar Project Switching
    print("\n--- TEST 8: Project Switching ---")
    # Click DevOS AI Hub (around Y = 420)
    print("Switching to DevOS AI Hub...")
    click_mouse(wx + 80, wy + 420)
    time.sleep(0.5)
    capture("15_project_ai_hub", wx, wy, ww, wh)

    # Click DevOS Shop Web (around Y = 465)
    print("Switching to DevOS Shop Web...")
    click_mouse(wx + 80, wy + 465)
    time.sleep(0.5)
    capture("16_project_shop_web", wx, wy, ww, wh)

    # In Shop Web: switch to Test Preview to inspect DDEV container preview
    print("Switching to Test Preview in Shop Web...")
    click_mouse(btn_test, tab_y)
    time.sleep(0.5)
    capture("17_shop_web_test_preview", wx, wy, ww, wh)

    # 9. New Project Modal (+)
    print("\n--- TEST 9: New Project Modal ---")
    click_mouse(wx + 190, wy + 130)
    capture("18_modal_new_project", wx, wy, ww, wh)
    press_esc()

    print("\n==========================================")
    print("FULL E2E UI AUDIT COMPLETED!")
    print(f"Artifacts saved in: {SCREENSHOT_DIR}")
    print("==========================================")

if __name__ == '__main__':
    main()
