#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BATCHES="$ROOT/scripts/.migration-import-batches.json"
TMPDIR="$ROOT/scripts/.migration-import-sql"
rm -rf "$TMPDIR"
mkdir -p "$TMPDIR"

python3 - <<'PY'
import json
from pathlib import Path
root = Path(__file__).resolve().parent if False else Path("'"$ROOT"'")
batches = json.loads((root / "scripts/.migration-import-batches.json").read_text())
out = root / "scripts/.migration-import-sql"
for i, b in enumerate(batches):
    (out / f"{i:02d}_{b['table']}.sql").write_text(b["sql"], encoding="utf-8")
    print(f"  {i:02d} {b['table']} ({b['count']} rows)")
PY

cd "$ROOT"
echo "=== Importing to lwbjprzrnmlnmzlxiwrv ==="
for f in "$TMPDIR"/*.sql; do
  echo "→ $(basename "$f")"
  supabase db query --linked -f "$f" --output json > /dev/null
done
echo "✅ Import complete"
