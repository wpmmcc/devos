#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

DEVOS_BIN = "/usr/local/bin/devos"

def run_devos(args):
    cmd = [DEVOS_BIN] + args + ["--json"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        data = json.loads(p.stdout)
        return p.returncode, data
    except Exception:
        return p.returncode, {"raw_stdout": p.stdout, "raw_stderr": p.stderr}

def main():
    print("==================================================")
    print("DevOS Trash Subsystem Full Lifecycle Test")
    print("==================================================")

    test_dir = Path.home() / "DevOSProjects" / "devos-trash-test-lifecycle"
    if test_dir.exists():
        shutil.rmtree(test_dir)

    # 1. Initialize a test project
    print("\n[Step 1] Initializing disposable test project at:", test_dir)
    code, res = run_devos(["init", "--slug", "trash-test", "--name", "回收站全生命周期验证项目", "--project-type", "script", "--project-dir", str(test_dir)])
    assert code == 0, f"Init failed: {res}"
    assert test_dir.joinpath("devos.json").exists(), "devos.json was not created"
    print("  -> Project successfully initialized.")

    # 2. Trash the project
    print("\n[Step 2] Trashing project via `devos project trash`...")
    code, res = run_devos(["project", "trash", "--path", str(test_dir)])
    assert code == 0, f"Trash failed: {res}"
    data = res.get("data", {})
    trash_path = data.get("trash_path")
    assert trash_path, "No trash_path returned"
    assert not test_dir.exists(), "Original project directory still exists after trash!"
    assert Path(trash_path).exists(), f"Trashed folder not found at {trash_path}"
    print(f"  -> Project safely trashed to: {trash_path}")

    # Check .trash_meta.json inside
    meta_file = Path(trash_path) / ".trash_meta.json"
    assert meta_file.exists(), ".trash_meta.json was not generated in trash folder!"
    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)
    print("  -> .trash_meta.json contents:", json.dumps(meta, ensure_ascii=False))
    assert meta["original_path"] == str(test_dir), f"Mismatch original_path: {meta}"
    assert meta["slug"] == "trash-test", f"Mismatch slug: {meta}"

    trash_id = Path(trash_path).name

    # 3. List trash
    print("\n[Step 3] Listing trash via `devos project list-trash`...")
    code, res = run_devos(["project", "list-trash"])
    assert code == 0, f"List trash failed: {res}"
    trash_list = res.get("data", [])
    matching = [it for it in trash_list if it.get("trash_id") == trash_id]
    assert len(matching) == 1, f"Expected 1 matching trash item, got {matching}"
    item = matching[0]
    print("  -> Found item in list-trash:")
    print(f"     trash_id: {item.get('trash_id')}")
    print(f"     name: {item.get('name')}")
    print(f"     original_path: {item.get('original_path')}")
    print(f"     size_bytes: {item.get('size_bytes')}")
    assert item.get("size_bytes", 0) > 0, "Item size should be > 0"

    # 4. Test collision handling during restore
    print("\n[Step 4] Testing destination collision during restore...")
    # Intentionally re-create a dummy directory at original path
    os.makedirs(test_dir, exist_ok=True)
    with open(test_dir / "blocking.txt", "w") as f:
        f.write("collision")

    code, res = run_devos(["project", "restore", "--trash-id", trash_id])
    assert code == 0 and res.get("ok") is False, f"Expected error when destination exists, got: {res}"
    err_code = res.get("error", {}).get("code")
    assert err_code == "DESTINATION_ALREADY_EXISTS", f"Expected DESTINATION_ALREADY_EXISTS, got {err_code}"
    print(f"  -> Correctly prevented overwriting! Error: {res.get('error', {}).get('plain_message')}")

    # Remove the blocking directory
    shutil.rmtree(test_dir)

    # 5. Restore project
    print("\n[Step 5] Restoring project via `devos project restore`...")
    code, res = run_devos(["project", "restore", "--trash-id", trash_id])
    assert code == 0, f"Restore failed: {res}"
    assert res.get("ok") is True, f"Restore response not ok: {res}"
    restored_path = res.get("data", {}).get("restored_path")
    assert restored_path == str(test_dir), f"Restored path mismatch: {restored_path}"
    assert test_dir.exists(), "Restored directory does not exist!"
    assert test_dir.joinpath("devos.json").exists(), "devos.json missing after restore!"
    assert not (test_dir / ".trash_meta.json").exists(), ".trash_meta.json was not cleaned up!"
    assert not Path(trash_path).exists(), "Old trash directory still exists after restore!"
    print(f"  -> Project successfully restored to {restored_path}")

    # 6. Test delete-trash permanent removal
    print("\n[Step 6] Testing permanent deletion via `delete-trash`...")
    code, res = run_devos(["project", "trash", "--path", str(test_dir)])
    trash_id2 = Path(res["data"]["trash_path"]).name
    print(f"  -> Trashed again: {trash_id2}")

    code, res = run_devos(["project", "delete-trash", "--trash-id", trash_id2])
    assert code == 0 and res.get("ok") is True, f"delete-trash failed: {res}"
    code, res = run_devos(["project", "list-trash"])
    trash_list = res.get("data", [])
    assert not any(it.get("trash_id") == trash_id2 for it in trash_list), f"{trash_id2} still in list!"
    print("  -> Permanently deleted item confirmed removed.")

    # 7. Test empty-trash
    print("\n[Step 7] Testing `empty-trash`...")
    # Create two disposable folders and trash them
    temp1 = Path.home() / "DevOSProjects" / "trash-temp-1"
    temp2 = Path.home() / "DevOSProjects" / "trash-temp-2"
    os.makedirs(temp1, exist_ok=True)
    os.makedirs(temp2, exist_ok=True)
    with open(temp1 / "sample.bin", "wb") as f:
        f.write(b"x" * 1024 * 100)
    with open(temp2 / "sample.bin", "wb") as f:
        f.write(b"y" * 1024 * 200)

    run_devos(["project", "trash", "--path", str(temp1)])
    run_devos(["project", "trash", "--path", str(temp2)])

    code, res = run_devos(["project", "list-trash"])
    assert len(res.get("data", [])) >= 2, "Expected at least 2 items in trash"

    code, res = run_devos(["project", "empty-trash"])
    assert code == 0 and res.get("ok") is True, f"empty-trash failed: {res}"
    freed = res.get("data", {}).get("freed_bytes", 0)
    print(f"  -> Trash emptied, freed {freed} bytes")
    assert freed > 0, "freed_bytes should be > 0"

    code, res = run_devos(["project", "list-trash"])
    assert len(res.get("data", [])) == 0, f"Trash list should be empty, got {res.get('data')}"
    print("  -> Confirmed trash is completely empty.")

    print("\n==================================================")
    print("ALL TRASH LIFECYCLE TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    main()
