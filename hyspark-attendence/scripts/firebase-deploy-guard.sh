#!/usr/bin/env bash
# Guard against deploying to legacy Firebase project
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if grep -q 'pi-shirt' .firebaserc 2>/dev/null; then
  echo "❌ Refusing deploy: .firebaserc references legacy pi-shirt project."
  exit 1
fi
