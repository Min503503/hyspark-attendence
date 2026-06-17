from __future__ import annotations

import json
from pathlib import Path

DIR = Path(__file__).resolve().parent
CONFIG_FILE = DIR / "gmail.config.json"
CREDENTIALS_FILE = DIR / "credentials.json"
TOKEN_FILE = DIR / "token.json"
SECRETS_FILE = DIR / "supabase-secrets.local.sh"


def load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
