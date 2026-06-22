#!/usr/bin/env bash
# HySpark Firebase Hosting — hyspark-95182 (admin + member 사이트 생성 후 배포)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="hyspark-95182"
export NODE_TLS_REJECT_UNAUTHORIZED=0
FB="npx -y firebase-tools@latest"

cd "$ROOT"

if grep -q 'pi-shirt' .firebaserc 2>/dev/null; then
  echo "❌ .firebaserc still references legacy project pi-shirt. Use hyspark-95182 only."
  exit 1
fi

if [[ "$PROJECT" != "hyspark-95182" ]]; then
  echo "❌ PROJECT must be hyspark-95182 (got: $PROJECT)"
  exit 1
fi

echo "=== Firebase 프로젝트: $PROJECT ==="
$FB use "$PROJECT"

echo "=== Hosting 사이트 확인/생성 ==="
for SITE in hysparkpre-admin hysparkpre-member; do
  if $FB hosting:sites:get "$SITE" --project "$PROJECT" >/dev/null 2>&1; then
    echo "  ✓ $SITE 이미 존재"
  else
    echo "  + $SITE 생성 중..."
    $FB hosting:sites:create "$SITE" --project "$PROJECT"
  fi
done

echo "=== target 연결 ==="
$FB target:clear hosting admin --project "$PROJECT" 2>/dev/null || true
$FB target:clear hosting member --project "$PROJECT" 2>/dev/null || true
$FB target:apply hosting admin hysparkpre-admin --project "$PROJECT"
$FB target:apply hosting member hysparkpre-member --project "$PROJECT"

echo "=== 빌드 + 배포 ==="
npm run deploy

echo ""
echo "✅ 완료"
echo "  Admin:  https://hysparkpre-admin.web.app"
echo "  Member: https://hysparkpre-member.web.app"
