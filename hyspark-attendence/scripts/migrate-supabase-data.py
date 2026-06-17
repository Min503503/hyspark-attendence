#!/usr/bin/env python3
"""Old Supabase (utwzwlowluxrdlifypzx) → New (lwbjprzrnmlnmzlxiwrv) full data migration."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

OLD_URL = "https://utwzwlowluxrdlifypzx.supabase.co"
OLD_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d3p3bG93bHV4cmRsaWZ5cHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDkxMzksImV4cCI6MjA4OTc4NTEzOX0."
    "tPoto2eT-M1nDan2FxCq1uFhXTpRgMZRKNzC8kxYv-o"
)

NEW_URL = "https://lwbjprzrnmlnmzlxiwrv.supabase.co"
NEW_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3Ympwcnpybm1sbm16bHhpd3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDM4MjEsImV4cCI6MjA5NzIxOTgyMX0."
    "glWzmDujTiHzDq2roZzpN9te3M3ou8MFFTwHKajH0TA"
)

TABLES = ("cohorts", "profiles", "sessions", "attendance_records")
BATCH = 50


def request(method: str, url: str, key: str, body=None, extra_headers=None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        raise RuntimeError(f"{method} {url} → {e.code}: {detail}") from e


def fetch_all(base_url: str, key: str, table: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        url = f"{base_url}/rest/v1/{table}?select=*&order=created_at.asc&offset={offset}&limit={BATCH}"
        batch = request("GET", url, key)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < BATCH:
            break
        offset += BATCH
    return rows


def insert_batch(base_url: str, key: str, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    url = f"{base_url}/rest/v1/{table}"
    request(
        "POST",
        url,
        key,
        rows,
        {"Prefer": "resolution=merge-duplicates"},
    )


def clear_new_db() -> None:
    for table in reversed(TABLES):
        url = f"{NEW_URL}/rest/v1/{table}?id=not.is.null"
        request("DELETE", url, NEW_KEY)


def main() -> None:
    print("=== HySpark Supabase 데이터 이전 ===\n")

    exported: dict[str, list[dict]] = {}
    for table in TABLES:
        rows = fetch_all(OLD_URL, OLD_KEY, table)
        exported[table] = rows
        print(f"  읽음: {table} {len(rows)}건")

    total = sum(len(v) for v in exported.values())
    if total == 0:
        print("\n이전할 데이터가 없습니다.")
        sys.exit(0)

    print("\n  새 DB 비우는 중...")
    clear_new_db()

    print("  새 DB에 쓰는 중...")
    for table in TABLES:
        rows = exported[table]
        for i in range(0, len(rows), BATCH):
            insert_batch(NEW_URL, NEW_KEY, table, rows[i : i + BATCH])
        print(f"  ✓ {table} {len(rows)}건")

    print("\n=== 검증 ===")
    for table in TABLES:
        old_n = len(exported[table])
        new_n = len(fetch_all(NEW_URL, NEW_KEY, table))
        ok = "OK" if old_n == new_n else "MISMATCH"
        print(f"  {table}: {old_n} → {new_n} [{ok}]")
        if old_n != new_n:
            sys.exit(1)

    print("\n✅ 100% 이전 완료")


if __name__ == "__main__":
    main()
