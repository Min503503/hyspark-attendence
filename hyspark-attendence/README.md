# 하이스파크 출결 (Spark Attendance)

Firebase Hosting에 배포하는 운영용 소스입니다.

## 운영 URL

| 용도 | URL |
|------|-----|
| 학회원 | https://hysparkpre-member.web.app |
| 관리자 | https://hysparkpre-admin.web.app |

## 로컬 실행

```bash
npm install
cp .env.example .env   # Supabase 키 입력
npm run dev:member     # 학회원 포털
npm run dev:admin      # 관리자 포털
```

## 배포

```bash
npm run deploy
```

또는 단계별:

```bash
npm run build:firebase
NODE_TLS_REJECT_UNAUTHORIZED=0 npx -y firebase-tools@latest deploy --only hosting:admin,hosting:member --project hyspark-95182
```

- `dist-member` → 학회원 (`hysparkpre-member`)
- `dist-admin` → 관리자 (`hysparkpre-admin`, `VITE_PORTAL=admin` 빌드)

최초 Hosting 사이트 생성: `bash scripts/firebase-setup-and-deploy.sh`

## 학회원 메일 (Gmail)

발송: **choimeans2@gmail.com** · 관리자 **멤버 관리** / **이메일** 탭

```bash
npm run gmail:setup:fresh   # OAuth (테스트 사용자 등록 후)
npm run gmail:deploy        # Edge Function + secrets
```

OAuth 동의 화면: 앱명 **HySpark**, 홈페이지 `https://hysparkpre-member.web.app/about.html`  
상세: [`scripts/gmail/README.md`](scripts/gmail/README.md)

## 주요 경로

- `src/App.tsx` — 라우팅, 포털 분기
- `src/contexts/AppContext.tsx` — 출결/회원 데이터
- `src/pages/Index.tsx` — 학회원 이름 입력
- `src/pages/AdminEmail.tsx` — 메일 자동화·수동 발송
- `src/components/AdminGate.tsx` — 관리자 비밀번호
- `src/lib/emailHtmlTemplates.ts` — 메일 HTML (Edge `_shared/`와 동기화)
- `supabase/` — DB 마이그레이션, Edge Functions
- `firebase.json` — Hosting 멀티사이트 설정
