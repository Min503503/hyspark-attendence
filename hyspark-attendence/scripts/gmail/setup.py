#!/usr/bin/env python3
"""Gmail 연동 1회 설정 — choimeans2@gmail.com 기준 OAuth + Supabase secrets 파일 생성."""

from __future__ import annotations

import json
import re
import secrets
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from _config import CREDENTIALS_FILE, DIR, SECRETS_FILE, TOKEN_FILE, load_config


def ensure_credentials() -> None:
    if CREDENTIALS_FILE.exists():
        return
    downloads = Path.home() / "Downloads"
    matches = sorted(downloads.glob("client_secret_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matches:
        CREDENTIALS_FILE.write_text(matches[0].read_text(encoding="utf-8"), encoding="utf-8")
        print(f"credentials.json ← {matches[0].name}")
        return
    raise SystemExit(
        "credentials.json 이 없습니다.\n"
        "Google Cloud → OAuth 클라이언트(데스크톱) JSON을 다운로드 후\n"
        f"{CREDENTIALS_FILE} 에 저장하세요."
    )


def authorize(scopes: list[str], fresh: bool) -> Credentials:
    if fresh and TOKEN_FILE.exists():
        TOKEN_FILE.unlink()
        print("기존 token.json 삭제")

    creds: Credentials | None = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            cfg = load_config()
            print(f"\n브라우저에서 **{cfg['sender']}** 으로 로그인·승인하세요.\n", flush=True)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), scopes)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")

    return creds


def _read_existing_secret(key: str) -> str | None:
    """Return the value of key from the existing secrets .env file, if present."""
    if not SECRETS_FILE.exists():
        return None
    for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line[len(key) + 1:].strip().strip('"')
    return None


def write_supabase_secrets(
    client_id: str,
    client_secret: str,
    refresh_token: str,
    sender: str,
    unsubscribe_secret: str,
) -> None:
    # Preserve EMAIL_LOGO_URL and MEMBER_SITE_URL from existing file if present
    logo_url = _read_existing_secret("EMAIL_LOGO_URL") or ""
    member_site_url = _read_existing_secret("MEMBER_SITE_URL") or ""

    content = f"""# 자동 생성 — git에 올리지 마세요.
EMAIL_LOGO_URL={logo_url}
MEMBER_SITE_URL={member_site_url}
GMAIL_FROM={sender}
GMAIL_SENDER_NAME=HySpark
GMAIL_CLIENT_ID={client_id}
GMAIL_CLIENT_SECRET={client_secret}
GMAIL_REFRESH_TOKEN={refresh_token}
GMAIL_READONLY_REFRESH_TOKEN={refresh_token}
UNSUBSCRIBE_SECRET={unsubscribe_secret}
"""
    SECRETS_FILE.write_text(content, encoding="utf-8")
    SECRETS_FILE.chmod(0o600)

    # Also update the .sh version for local sourcing
    sh_file = DIR / "supabase-secrets.local.sh"
    sh_content = f"""#!/bin/bash
# 자동 생성 — git에 올리지 마세요. 실행: source scripts/gmail/supabase-secrets.local.sh
export GMAIL_FROM="{sender}"
export GMAIL_CLIENT_ID="{client_id}"
export GMAIL_CLIENT_SECRET="{client_secret}"
export GMAIL_REFRESH_TOKEN="{refresh_token}"
export GMAIL_READONLY_REFRESH_TOKEN="{refresh_token}"
export UNSUBSCRIBE_SECRET="{unsubscribe_secret}"
"""
    sh_file.write_text(sh_content, encoding="utf-8")
    sh_file.chmod(0o600)


def main() -> None:
    fresh = "--fresh" in sys.argv
    cfg = load_config()
    sender = cfg["sender"]
    scopes = cfg["oauthScopes"]
    supabase_ref = cfg["supabaseProjectRef"]
    fn = cfg["edgeFunction"]

    print("=== HySpark Gmail 설정 ===", flush=True)
    print(f"발송 계정: {sender}", flush=True)
    print(f"Google Cloud: {cfg['googleCloudProject']}", flush=True)
    print(f"Supabase: {supabase_ref}", flush=True)
    print(f"OAuth 스코프: {', '.join(scopes)}", flush=True)
    consent = cfg.get("oauthConsent") or {}
    if consent:
        print("\nOAuth 동의 화면 (테스트 모드):", flush=True)
        print(f"  앱 이름: {cfg.get('appName', 'HySpark')}", flush=True)
        print(f"  홈페이지: {consent.get('homepageUrl', '')}", flush=True)
        print(f"  개인정보: {consent.get('privacyPolicyUrl', '')}", flush=True)
        print(f"  테스트 사용자: {sender}\n", flush=True)
    else:
        print(flush=True)

    ensure_credentials()
    creds = authorize(scopes, fresh)

    data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    refresh = data.get("refresh_token")
    if not refresh:
        raise SystemExit("refresh_token 없음. python setup.py --fresh 로 다시 시도하세요.")

    creds_json = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    installed = creds_json.get("installed") or creds_json.get("web") or {}
    client_id = data.get("client_id") or installed.get("client_id", "")
    client_secret = data.get("client_secret") or installed.get("client_secret", "")

    # Reuse existing UNSUBSCRIBE_SECRET so tokens issued before don't break
    unsubscribe_secret = _read_existing_secret("UNSUBSCRIBE_SECRET") or secrets.token_hex(32)
    if not _read_existing_secret("UNSUBSCRIBE_SECRET"):
        print(f"UNSUBSCRIBE_SECRET 신규 생성")

    write_supabase_secrets(client_id, client_secret, refresh, sender, unsubscribe_secret)

    print("\n=== OAuth 완료 ===\n")
    print(f"secrets 파일: {SECRETS_FILE.relative_to(DIR.parent.parent)}")
    print("\n다음 명령으로 Supabase에 반영:\n")
    print("  npm run gmail:deploy")
    print("")


if __name__ == "__main__":
    main()
