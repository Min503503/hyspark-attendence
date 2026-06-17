#!/usr/bin/env python3
"""Generate SQL INSERT batches from exported JSON for MCP execute_sql import."""

from __future__ import annotations

import json
from pathlib import Path

DIR = Path(__file__).resolve().parent / ".migration-export"
TABLES = ("cohorts", "profiles", "sessions", "attendance_records")
BATCH = 40


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def row_to_values(row: dict, columns: list[str]) -> str:
    return "(" + ", ".join(sql_literal(row.get(c)) for c in columns) + ")"


def main() -> None:
    batches: list[tuple[str, str, int]] = []
    for table in TABLES:
        rows = json.loads((DIR / f"{table}.json").read_text())
        if not rows:
            continue
        columns = list(rows[0].keys())
        cols_sql = ", ".join(columns)
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            values_sql = ",\n".join(row_to_values(r, columns) for r in chunk)
            sql = (
                f"INSERT INTO public.{table} ({cols_sql}) VALUES\n{values_sql}\n"
                f"ON CONFLICT (id) DO NOTHING;"
            )
            batches.append((table, sql, len(chunk)))

    out = Path(__file__).resolve().parent / ".migration-import-batches.json"
    out.write_text(
        json.dumps([{"table": t, "sql": s, "count": c} for t, s, c in batches], ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(batches)} batches to {out.name}")
    for t, _, c in batches:
        print(f"  {t}: +{c}")


if __name__ == "__main__":
    main()
