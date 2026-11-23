import argparse
import json
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="DevOS Script Task")
    parser.add_argument("--self-check", action="store_true", help="Run smoke self-check")
    parser.add_argument("--input", default="Sample")
    parser.add_argument("--out", default=".devos/artifacts/result.json")

    args = parser.parse_args()

    if args.self_check:
        print("Self-check passed: Python runtime & imports are healthy.")
        sys.exit(0)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    result = {
        "status": "success",
        "input_received": args.input,
        "processed_by": "DevOS Python Worker"
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Task finished successfully. Result written to {args.out}")

if __name__ == "__main__":
    main()
