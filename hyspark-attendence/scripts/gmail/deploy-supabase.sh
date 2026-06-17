#!/usr/bin/env bash
# HySpark Gmail → Supabase Edge Function 배포
# 필요: utwzwlowluxrdlifypzx 프로젝트 Owner/Developer 권한 + supabase login (같은 계정)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_REF="lwbjprzrnmlnmzlxiwrv"
FUNCTION_NAME="send-member-email"
ENV_FILE="$ROOT/scripts/gmail/supabase-secrets.env"

cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE 없음. 먼저: npm run gmail:setup:fresh"
  exit 1
fi

echo "=== Supabase 프로젝트 확인 ==="
if ! supabase projects list 2>/dev/null | grep -q "$PROJECT_REF"; then
  echo ""
  echo "❌ 현재 Supabase CLI 계정에 $PROJECT_REF 가 없습니다."
  echo ""
  echo "대시보드(https://supabase.com/dashboard/project/$PROJECT_REF)와"
  echo "raw 계정으로 다시 로그인하세요:"
  echo ""
  echo "  supabase logout"
  echo "  supabase login"
  echo ""
  echo "또는 Access Token 사용:"
  echo "  https://supabase.com/dashboard/account/tokens"
  echo "  export SUPABASE_ACCESS_TOKEN=sbp_..."
  echo "  supabase login --token \"\$SUPABASE_ACCESS_TOKEN\""
  echo ""
  exit 1
fi

echo "=== Gmail secrets 등록 ==="
supabase secrets set --project-ref "$PROJECT_REF" --env-file "$ENV_FILE"

echo "=== Edge Function 배포 ==="
supabase functions deploy "$FUNCTION_NAME" --project-ref "$PROJECT_REF"

echo ""
echo "✅ 완료"
echo "테스트: https://hyspark-attendance-admin.web.app/#/admin/members"
