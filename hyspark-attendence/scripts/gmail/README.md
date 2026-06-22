# Gmail 발송 (`choimeans2@gmail.com`)

관리자 **멤버 관리** → 메일 발송. Supabase `send-member-email` → Gmail API.

## 빠른 설정 (테스트 모드 — 추천)

Production 검증 **없이** Gmail만 쓰려면:

1. Google Cloud → **`hyspark`** → OAuth 동의 화면 → **테스트** 모드
2. **테스트 사용자**: `choimeans2@gmail.com`
3. ```bash
   npm run gmail:setup:fresh
   ```

---

## OAuth 동의 화면 (Production 검증 시)

| 항목 | 값 |
|------|-----|
| 앱 이름 | **HySpark** |
| **홈페이지** | `https://hysparkpre-member.web.app/about.html` ← `/` 아님 |
| 개인정보 | `https://hysparkpre-member.web.app/privacy.html` |
| 서비스 약관 | `https://hysparkpre-member.web.app/terms.html` |
| 승인된 도메인 | `hysparkpre-member.web.app`, `hysparkpre-admin.web.app` |

> `/` 는 학회원 **이름 입력(로그인)** 화면이라 Google이 거절합니다. **반드시 `/about.html`** 을 홈페이지로 등록하세요.

### Search Console (도메인 소유)

1. **choimeans2@gmail.com** 으로 Search Console + Cloud Console **동일 계정**
2. 속성: `https://hysparkpre-member.web.app` (URL 접두어)
3. 소유권 확인: https://hysparkpre-member.web.app/google4c418dbf064f5b42.html
4. Search Console → **설정 → 연결** → Google Cloud 프로젝트 **`hyspark`** 연결
5. OAuth 저장 후 **몇 시간** 기다렸다가 재제출

## Supabase 반영

```bash
npm run gmail:deploy
```

또는 수동:

```bash
supabase login   # 대시보드와 같은 계정
npm run gmail:deploy
```

**403 권한 오류** → CLI/MCP가 `copper-fountain` 계정으로 로그인된 상태입니다.  
대시보드 우측 상단 이메일과 **같은 계정**으로 `supabase logout` → `supabase login` 하세요.

Access Token 방식:

```bash
# https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...
supabase login --token "$SUPABASE_ACCESS_TOKEN"
npm run gmail:deploy
```

### 대시보드에서 secrets만 (CLI 없을 때)

1. https://supabase.com/dashboard/project/lwbjprzrnmlnmzlxiwrv/settings/functions
2. Secrets → `GMAIL_FROM`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` 추가  
   (값: `scripts/gmail/supabase-secrets.local.sh`)
3. Function 배포는 CLI `npm run gmail:deploy` 필요

## OAuth 오류

| 증상 | 해결 |
|------|------|
| 홈페이지 미등록 | Search Console 소유 확인 + Cloud **`hyspark`** 연결 |
| 로그인 페이지가 먼저 | 홈페이지를 **`/about.html`** 로 변경 (루트 `/` 금지) |
| 앱 목적 설명 없음 | `/about.html` 사용 (로그인 없는 정적 페이지) |
| `403 access_denied` | 테스트 사용자 `choimeans2@gmail.com` |

## 테스트

```bash
npm run gmail:test -- --to someone@example.com
```
