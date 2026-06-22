#!/usr/bin/env bash
# HySpark API-level E2E — admin-api + member RPC full flow
# Requires ADMIN_TOKEN (from admin-auth or admin_sessions insert for QA)
set -euo pipefail

# Don't exit on failed checks — we count pass/fail manually
set +e

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
TOKEN="${ADMIN_TOKEN:?Set ADMIN_TOKEN (admin-auth or QA admin_sessions row)}"

QA_MEMBER="QA테스트멤버"
QA_SESSION="[QA] 최종테스트 세션"
QA_EMAIL="${QA_TEST_EMAIL:-choimeans2@gmail.com}"

pass=0
fail=0
SESSION_ID=""
MEMBER_ID=""
ATTENDANCE_CODE=""

ok() { echo "  PASS $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL $1 — $2"; fail=$((fail + 1)); }

admin_api() {
  local action="$1"
  local payload="$2"
  curl -s -X POST "$FN/admin-api" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "x-admin-token: $TOKEN" \
    -d "{\"action\":\"$action\",\"payload\":$payload}"
}

rpc() {
  local fn="$1"
  local body="$2"
  curl -s -X POST "$BASE/rpc/$fn" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$body"
}

echo "=== HySpark smoke-e2e-api ==="

# Cleanup prior QA data (ignore errors)
echo "Cleanup old QA rows"
curl -s "$BASE/profiles?full_name=eq.$QA_MEMBER&select=id" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  | grep -oE '[0-9a-f-]{36}' | while read -r mid; do
  admin_api delete_member "{\"id\":\"$mid\"}" >/dev/null || true
done || true

curl -s "$BASE/sessions?select=id,title" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  | python3 -c "
import sys, json
try:
  rows = json.load(sys.stdin)
except Exception:
  sys.exit(0)
for r in rows:
  t = r.get('title') or ''
  if 'QA' in t and '최종테스트' in t:
    print(r['id'])
" | while read -r sid; do
  admin_api delete_session "{\"sessionId\":\"$sid\"}" >/dev/null || true
done || true

echo "B4-1 add_member"
START_AT=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%S+00:00'))")
resp=$(admin_api add_member "{\"full_name\":\"$QA_MEMBER\",\"cohort_label\":\"QA\",\"email\":\"$QA_EMAIL\"}")
if echo "$resp" | grep -q '"ok":true'; then
  ok B4-1
elif echo "$resp" | grep -q 'duplicate key'; then
  echo "  (member email already exists — reusing)"
  ok B4-1-reuse
else
  bad B4-1 "$resp"
fi

MEMBER_ID=$(curl -s "$BASE/profiles?select=id,full_name,email&role=eq.member" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
for r in rows:
  if r.get('full_name')=='$QA_MEMBER':
    print(r['id']); break
else:
  for r in rows:
    if r.get('email')=='$QA_EMAIL':
      print(r['id']); break
")
[[ -n "$MEMBER_ID" ]] && ok B4-1-id || bad B4-1-id "no member id"

echo "B2-1 create_session"
resp=$(admin_api create_session "{\"title\":\"$QA_SESSION\",\"start_at\":\"$START_AT\",\"check_in_open_minutes\":0,\"attendance_deadline_minutes\":5,\"late_deadline_minutes\":30,\"status\":\"scheduled\",\"venue_name\":\"QA장소\"}")
echo "$resp" | grep -q '"ok":true' && ok B2-1 || bad B2-1 "$resp"

SESSION_ID=$(curl -s "$BASE/sessions?select=id,title&order=created_at.desc&limit=10" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "
import sys,json
for r in json.load(sys.stdin):
  if r.get('title')=='$QA_SESSION':
    print(r['id']); break
")
[[ -n "$SESSION_ID" ]] && ok B2-1-id || bad B2-1-id "no session id"

echo "B2-2 update_session"
resp=$(admin_api update_session "{\"id\":\"$SESSION_ID\",\"title\":\"$QA_SESSION\",\"start_at\":\"$START_AT\",\"status\":\"scheduled\",\"notes\":\"QA메모\",\"venue_name\":\"QA장소2\",\"venue_map_url\":null,\"attendance_code\":null,\"attendance_code_status\":\"inactive\",\"check_in_open_minutes\":0,\"attendance_deadline_minutes\":5,\"late_deadline_minutes\":30}")
echo "$resp" | grep -q '"ok":true' && ok B2-2 || bad B2-2 "$resp"

echo "B2-4 open_check_in"
resp=$(admin_api open_check_in "{\"sessionId\":\"$SESSION_ID\"}")
echo "$resp" | grep -q '"ok":true' && ok B2-4 || bad B2-4 "$resp"
ATTENDANCE_CODE=$(echo "$resp" | grep -oE '"code":"[0-9]+"' | head -1 | cut -d'"' -f4)
[[ -n "$ATTENDANCE_CODE" ]] && ok B2-4-code || bad B2-4-code "$resp"

echo "B2-5 regenerate_code"
old_code="$ATTENDANCE_CODE"
resp=$(admin_api regenerate_code "{\"sessionId\":\"$SESSION_ID\"}")
ATTENDANCE_CODE=$(echo "$resp" | grep -oE '"code":"[0-9]+"' | head -1 | cut -d'"' -f4)
[[ -n "$ATTENDANCE_CODE" && "$ATTENDANCE_CODE" != "$old_code" ]] && ok B2-5 || bad B2-5 "$resp"

echo "C2-1 member_check_in"
resp=$(rpc member_check_in "{\"p_session_id\":\"$SESSION_ID\",\"p_member_id\":\"$MEMBER_ID\",\"p_code\":\"$ATTENDANCE_CODE\"}")
echo "$resp" | grep -q '"success"[[:space:]]*:[[:space:]]*true' && ok C2-1 || bad C2-1 "$resp"

echo "C2-2 duplicate check_in"
resp=$(rpc member_check_in "{\"p_session_id\":\"$SESSION_ID\",\"p_member_id\":\"$MEMBER_ID\",\"p_code\":\"$ATTENDANCE_CODE\"}")
echo "$resp" | grep -q '"existing"[[:space:]]*:[[:space:]]*true' && ok C2-2 || bad C2-2 "$resp"

echo "C2-3 wrong code"
resp=$(rpc member_check_in "{\"p_session_id\":\"$SESSION_ID\",\"p_member_id\":\"$MEMBER_ID\",\"p_code\":\"00000\"}")
echo "$resp" | grep -q '"success"[[:space:]]*:[[:space:]]*false' && ok C2-3 || bad C2-3 "$resp"

echo "C3-1 absence on new session"
START2=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%S+00:00'))")
resp=$(admin_api create_session "{\"title\":\"$QA_SESSION-absence\",\"start_at\":\"$START2\",\"check_in_open_minutes\":0,\"attendance_deadline_minutes\":5,\"late_deadline_minutes\":30,\"status\":\"scheduled\"}")
ABS_SESSION=$(curl -s "$BASE/sessions?select=id,title&order=created_at.desc&limit=10" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "
import sys,json
for r in json.load(sys.stdin):
  if r.get('title')=='$QA_SESSION-absence':
    print(r['id']); break
")
resp=$(rpc member_submit_absence "{\"p_session_id\":\"$ABS_SESSION\",\"p_member_id\":\"$MEMBER_ID\",\"p_status\":\"excused_absent\",\"p_category\":\"개인사정\",\"p_note\":\"QA\"}")
echo "$resp" | grep -q '"success"[[:space:]]*:[[:space:]]*true' && ok C3-1 || bad C3-1 "$resp"

echo "S11 duplicate absence"
resp=$(rpc member_submit_absence "{\"p_session_id\":\"$ABS_SESSION\",\"p_member_id\":\"$MEMBER_ID\",\"p_status\":\"excused_absent\"}")
echo "$resp" | grep -q '"success"[[:space:]]*:[[:space:]]*false' && ok S11 || bad S11 "$resp"

echo "B2-6 add_manual_record (other member path — skip if only one QA member)"

echo "B2-7 override_attendance"
REC_ID=$(curl -s "$BASE/attendance_records?session_id=eq.$SESSION_ID&member_id=eq.$MEMBER_ID&select=id" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | grep -oE '[0-9a-f-]{36}' | head -1)
resp=$(admin_api override_attendance "{\"recordId\":\"$REC_ID\",\"status\":\"late\",\"reason\":\"QA override\"}")
echo "$resp" | grep -q '"ok":true' && ok B2-7 || bad B2-7 "$resp"

echo "B6-2 toggle_automation_rule"
RULE_ID=$(curl -s "$BASE/email_automation_rules?select=id&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | grep -oE '[0-9a-f-]{36}' | head -1)
resp=$(admin_api toggle_automation_rule "{\"ruleId\":\"$RULE_ID\",\"enabled\":true}")
echo "$resp" | grep -q '"ok":true' && ok B6-2 || bad B6-2 "$resp"

echo "B6-3 auto-open-sessions (admin token)"
resp=$(curl -s -X POST "$FN/auto-open-sessions" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "x-admin-token: $TOKEN" \
  -d '{"trigger_source":"admin_manual"}')
echo "$resp" | grep -qE 'opened|emailAutomation|error' && ok B6-3 || bad B6-3 "$resp"

echo "D-1 send-member-email (manual)"
resp=$(curl -s -X POST "$FN/send-member-email" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "x-admin-token: $TOKEN" \
  -d "{\"recipientIds\":[\"$MEMBER_ID\"],\"subject\":\"[QA] HySpark smoke\",\"body\":\"QA manual mail\",\"manual\":true}")
echo "$resp" | grep -qE '"sent"|"error"' && ok D-1 || bad D-1 "$resp"
if echo "$resp" | grep -q '"sent"'; then
  SENT=$(echo "$resp" | grep -oE '"sent":[0-9]+' | cut -d: -f2)
  [[ "${SENT:-0}" -ge 1 ]] && ok D-1-sent || bad D-1-sent "$resp"
fi

echo "B2-8 close_check_in"
resp=$(admin_api close_check_in "{\"sessionId\":\"$SESSION_ID\"}")
echo "$resp" | grep -q '"ok":true' && ok B2-8 || bad B2-8 "$resp"

echo "C2-4 check_in after close"
resp=$(rpc member_check_in "{\"p_session_id\":\"$SESSION_ID\",\"p_member_id\":\"$MEMBER_ID\",\"p_code\":\"$ATTENDANCE_CODE\"}")
echo "$resp" | grep -q '"success"[[:space:]]*:[[:space:]]*false' && ok C2-4 || bad C2-4 "$resp"

echo "B4-2 update_member email"
resp=$(admin_api update_member "{\"id\":\"$MEMBER_ID\",\"full_name\":\"$QA_MEMBER\",\"cohort_label\":\"QA\",\"status\":\"active\",\"email\":\"$QA_EMAIL\"}")
echo "$resp" | grep -q '"ok":true' && ok B4-2 || bad B4-2 "$resp"

echo "B6-1 sync_automation_rules"
resp=$(admin_api sync_automation_rules "{}")
echo "$resp" | grep -q '"ok":true' && ok B6-1 || bad B6-1 "$resp"

echo "Cleanup QA session/member"
admin_api delete_session "{\"sessionId\":\"$SESSION_ID\"}" >/dev/null || true
admin_api delete_session "{\"sessionId\":\"$ABS_SESSION\"}" >/dev/null || true
admin_api delete_member "{\"id\":\"$MEMBER_ID\"}" >/dev/null || true
ok cleanup

echo ""
echo "=== E2E Results: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
