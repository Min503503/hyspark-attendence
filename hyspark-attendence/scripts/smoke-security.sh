#!/usr/bin/env bash
# HySpark security smoke tests — anon/edge/RPC regression
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

URL="${VITE_SUPABASE_URL:?missing VITE_SUPABASE_URL}"
KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:?missing VITE_SUPABASE_PUBLISHABLE_KEY}"
BASE="${URL}/rest/v1"
FN="${URL}/functions/v1"

pass=0
fail=0

check_http() {
  local id="$1" expected="$2" actual="$3" body="${4:-}"
  if echo "$actual" | grep -qE "$expected"; then
    echo "  PASS $id (HTTP $actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL $id (HTTP $actual) $body"
    fail=$((fail + 1))
  fi
}

check_json() {
  local id="$1" pattern="$2" body="$3"
  if echo "$body" | grep -qE "$pattern"; then
    echo "  PASS $id"
    pass=$((pass + 1))
  else
    echo "  FAIL $id — $body"
    fail=$((fail + 1))
  fi
}

echo "=== HySpark smoke-security ==="
echo "URL: $URL"
echo ""

echo "S1 anon profiles INSERT"
code=$(curl -s -o /tmp/smoke-body.txt -w "%{http_code}" -X POST "$BASE/profiles" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"role":"member","full_name":"smoke-hacker","status":"active"}')
check_http S1 '401|403' "$code"

echo "S2 anon sessions UPDATE (must not change row)"
REAL_SESSION="${SMOKE_SESSION_ID:-1f19912f-5fff-430d-89fc-13fc9634946f}"
before=$(curl -s "$BASE/sessions?id=eq.$REAL_SESSION&select=title" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
code=$(curl -s -o /tmp/smoke-body.txt -w "%{http_code}" -X PATCH "$BASE/sessions?id=eq.$REAL_SESSION" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title":"smoke-hacked-session"}')
after=$(curl -s "$BASE/sessions?id=eq.$REAL_SESSION&select=title" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
if [[ "$before" == "$after" ]]; then
  echo "  PASS S2 (HTTP $code, title unchanged)"
  pass=$((pass + 1))
else
  echo "  FAIL S2 — session was modified! before=$before after=$after"
  fail=$((fail + 1))
fi

echo "S3 anon attendance INSERT"
code=$(curl -s -o /tmp/smoke-body.txt -w "%{http_code}" -X POST "$BASE/attendance_records" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"session_id":"00000000-0000-0000-0000-000000000001","member_id":"00000000-0000-0000-0000-000000000002","member_name":"x","status":"present","checked_in_at":"2026-01-01T00:00:00Z","check_in_method":"code","code_verified":true,"location_verified":true,"demerit_points":0}')
check_http S3 '401|403' "$code"

echo "S4 anon email_rules UPDATE (must not change row)"
REAL_RULE="${SMOKE_RULE_ID:-a34b0fa1-6622-4de4-8a4c-0690cd41e515}"
before=$(curl -s "$BASE/email_automation_rules?id=eq.$REAL_RULE&select=enabled" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
code=$(curl -s -o /tmp/smoke-body.txt -w "%{http_code}" -X PATCH "$BASE/email_automation_rules?id=eq.$REAL_RULE" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"enabled":false}')
after=$(curl -s "$BASE/email_automation_rules?id=eq.$REAL_RULE&select=enabled" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
if [[ "$before" == "$after" ]]; then
  echo "  PASS S4 (HTTP $code, enabled unchanged)"
  pass=$((pass + 1))
else
  echo "  FAIL S4 — rule was modified! before=$before after=$after"
  fail=$((fail + 1))
fi

echo "S5 send-member-email no token"
body=$(curl -s -w "\n%{http_code}" -X POST "$FN/send-member-email" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"recipientIds":[],"subject":"x","body":"y"}')
http=$(echo "$body" | tail -1)
resp=$(echo "$body" | sed '$d')
check_http S5 '401' "$http" "$resp"
check_json S5-body 'Unauthorized' "$resp"

echo "S6 admin-api no token"
body=$(curl -s -w "\n%{http_code}" -X POST "$FN/admin-api" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"action":"open_check_in","payload":{"sessionId":"00000000-0000-0000-0000-000000000001"}}')
http=$(echo "$body" | tail -1)
resp=$(echo "$body" | sed '$d')
check_http S6 '401' "$http" "$resp"

echo "S7 auto-open-sessions no auth"
body=$(curl -s -w "\n%{http_code}" -X POST "$FN/auto-open-sessions" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{}')
http=$(echo "$body" | tail -1)
check_http S7 '401' "$http"

echo "S8 admin-auth wrong password"
body=$(curl -s -w "\n%{http_code}" -X POST "$FN/admin-auth" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"password":"wrong-smoke-password"}')
http=$(echo "$body" | tail -1)
resp=$(echo "$body" | sed '$d')
check_http S8 '401' "$http" "$resp"

echo "S9 admin-auth empty password"
body=$(curl -s -w "\n%{http_code}" -X POST "$FN/admin-auth" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{}')
http=$(echo "$body" | tail -1)
check_http S9 '400' "$http"

echo "S10 member_check_in bad code"
body=$(curl -s -X POST "$BASE/rpc/member_check_in" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"p_session_id":"00000000-0000-0000-0000-000000000001","p_member_id":"00000000-0000-0000-0000-000000000002","p_code":"99999"}')
check_json S10 '"success"[[:space:]]*:[[:space:]]*false' "$body"

echo "S12 maybe_open_due_sessions"
body=$(curl -s -X POST "$BASE/rpc/maybe_open_due_sessions" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{}')
if echo "$body" | grep -qE '^[0-9]+$'; then
  echo "  PASS S12 (opened=$body)"
  pass=$((pass + 1))
else
  echo "  FAIL S12 — $body"
  fail=$((fail + 1))
fi

echo ""
echo "=== Results: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
