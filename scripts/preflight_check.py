#!/usr/bin/env python3
"""
DevOS Quick Preflight Check Script
"""

import shutil
import subprocess
import sys

def check(name: str, cmd: list, fix_hint: str) -> bool:
    exe = cmd[0]
    if not shutil.which(exe):
        print(f"❌ {name}: 未找到可执行文件 '{exe}'")
        print(f"   💡 建议: {fix_hint}")
        return False
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            version_str = res.stdout.strip().split("\n")[0]
            print(f"✅ {name}: 正常就绪 ({version_str})")
            return True
        else:
            print(f"⚠️  {name}: 命令可执行但返回非零退出码")
            print(f"   💡 建议: {fix_hint}")
            return False
    except Exception as e:
        print(f"❌ {name}: 执行探测出错: {e}")
        return False

def main():
    print("DevOS 本地环境体检报告:")
    print("=" * 40)
    docker_ok = check("Docker 容器引擎", ["docker", "info"], "启动 Docker Desktop / OrbStack")
    ddev_ok = check("DDEV 网页引擎", ["ddev", "--version"], "macOS 执行 brew install ddev/ddev/ddev")
    dc_ok = check("DevContainer 脚本引擎", ["devcontainer", "--version"], "执行 npm i -g @devcontainers/cli")
    print("=" * 40)
    if docker_ok and ddev_ok:
        print("🎉 核心容器环境已完全就绪！")
        sys.exit(0)
    else:
        print("⚠️ 存在待修复的环境依赖项，请参考上述建议操作。")
        sys.exit(1)

if __name__ == "__main__":
    main()
