#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCHES = ROOT / "scripts/.migration-import-batches.json"
SQL_DIR = ROOT / "scripts/.migration-import-sql"


def main() -> None:
    batches = json.loads(BATCHES.read_text(encoding="utf-8"))
    SQL_DIR.mkdir(parents=True, exist_ok=True)

    for i, batch in enumerate(batches):
        path = SQL_DIR / f"{i:02d}_{batch['table']}.sql"
        path.write_text(batch["sql"], encoding="utf-8")
        print(f"→ {path.name} ({batch['count']} rows)")
        subprocess.run(
            ["supabase", "db", "query", "--linked", "-f", str(path), "--output", "json"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        )

    print("\n✅ Import complete")


if __name__ == "__main__":
    main()
