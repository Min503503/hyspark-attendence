#!/usr/bin/env python3
"""Gmail 발송 테스트 — CLI."""

from __future__ import annotations

import argparse
import base64
from email.message import EmailMessage

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from _config import CREDENTIALS_FILE, TOKEN_FILE, load_config


def get_credentials(scopes: list[str]) -> Credentials:
    creds: Credentials | None = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), scopes)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), scopes)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return creds


def main() -> None:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Gmail 발송 테스트")
    parser.add_argument("--to", required=True, help="수신 이메일")
    parser.add_argument("--subject", default="HySpark 테스트 메일")
    parser.add_argument("--body", default="Gmail API 연동 테스트입니다.")
    args = parser.parse_args()

    sender = cfg["sender"]
    sender_name = cfg["senderName"]

    try:
        service = build("gmail", "v1", credentials=get_credentials(cfg["oauthScopes"]))
        message = EmailMessage()
        message["From"] = f"{sender_name} <{sender}>"
        message["To"] = args.to
        message["Subject"] = args.subject
        message.set_content(args.body)
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8").rstrip("=")
        result = service.users().messages().send(userId="me", body={"raw": raw}).execute()
        print(f"발송 완료 ({sender} → {args.to}): message_id={result['id']}")
    except HttpError as error:
        raise SystemExit(f"발송 실패: {error}") from error


if __name__ == "__main__":
    main()
