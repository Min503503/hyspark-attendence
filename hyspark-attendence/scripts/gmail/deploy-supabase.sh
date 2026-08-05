#!/usr/bin/env bash
# HySpark 전체 배포: DB 마이그레이션 + Edge Functions + 프론트엔드 (Firebase Hosting)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_REF="lwbjprzrnmlnmzlxiwrv"
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
  echo "  supabase logout && supabase login"
  echo "  또는: export SUPABASE_ACCESS_TOKEN=sbp_..."
  echo ""
  exit 1
fi

echo "=== Supabase 링크 확인 ==="
supabase link --project-ref "$PROJECT_REF" 2>/dev/null || true

echo ""
echo "=== DB 마이그레이션 적용 ==="
supabase db push --linked --yes

echo ""
echo "=== Gmail secrets 등록 ==="
supabase secrets set --project-ref "$PROJECT_REF" --env-file "$ENV_FILE"

echo ""
echo "=== Edge Functions 배포 ==="
FUNCTIONS=(
  "send-member-email"
  "send-checkin-email"
  "send-camp-survey-reminder"
  "process-email-automation"
  "admin-api"
  "email-unsubscribe"
  "bounce-sync"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "  → $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo ""
echo "=== 프론트엔드 빌드 & 배포 (Firebase) ==="
bash scripts/firebase-deploy-guard.sh
npm run build:firebase
NODE_TLS_REJECT_UNAUTHORIZED=0 npx -y firebase-tools@latest deploy \
  --only hosting:admin,hosting:member \
  --project hyspark-95182

echo ""
echo "✅ 전체 배포 완료"
echo "   관리자: https://hysparkpre-admin.web.app"
echo "   멤버:   https://hysparkpre-member.web.app"
