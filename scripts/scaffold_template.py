#!/usr/bin/env python3
"""
DevOS Template Scaffolder
Copies built-in templates to a destination directory and substitutes project metadata.
"""

import argparse
import json
import os
import shutil
from pathlib import Path

def scaffold(template_name: str, dest_dir: Path, slug: str, name: str, description: str):
    root_dir = Path(__file__).resolve().parent.parent
    template_dir = root_dir / "templates" / template_name

    if not template_dir.exists():
        raise ValueError(f"Template '{template_name}' not found at {template_dir}")

    dest_dir = Path(dest_dir).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)

    print(f"Scaffolding '{template_name}' into {dest_dir}...")

    # Copy template files
    for item in template_dir.iterdir():
        dest_item = dest_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest_item, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest_item)

    # Update devos.json
    devos_json_path = dest_dir / "devos.json"
    if devos_json_path.exists():
        with open(devos_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["slug"] = slug
        data["name"] = name
        data["description"] = description
        if "web" in data.get("environments", {}) and data["environments"]["web"]:
            data["environments"]["web"]["primary_url"] = f"https://{slug}.ddev.site"
            if "health_check" in data["environments"]["web"] and data["environments"]["web"]["health_check"]:
                data["environments"]["web"]["health_check"]["url"] = f"https://{slug}.ddev.site/health"
        with open(devos_json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # Create empty directories required by DevOS
    for sub in ["board", "issues", "requirements", "standards", "docs", "knowledge", ".devos/artifacts"]:
        (dest_dir / sub).mkdir(parents=True, exist_ok=True)

    print(f"✓ Project '{name}' ({slug}) initialized successfully at {dest_dir}")

def main():
    parser = argparse.ArgumentParser(description="Scaffold DevOS Project Template")
    parser.add_argument("--template", choices=["web-ddev", "script-python", "hybrid-starter"], default="hybrid-starter")
    parser.add_argument("--dest", required=True, help="Destination directory path")
    parser.add_argument("--slug", required=True, help="Project slug")
    parser.add_argument("--name", required=True, help="Project display name")
    parser.add_argument("--desc", default="", help="Project description")

    args = parser.parse_args()
    scaffold(args.template, Path(args.dest), args.slug, args.name, args.desc)

if __name__ == "__main__":
    main()
