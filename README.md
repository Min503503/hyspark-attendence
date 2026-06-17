# 스파크 어탠던스 — 최종 배포 정리본

하이스파크 학회 출결·네트워킹 서비스 코드입니다.  
정리일: **2026-06-16** (Firebase 배포 기준)

## 폴더 구조

```
스파크어탠던스_코드정리_20260610/
├── hyspark-attendence/    ← ★ 운영·배포용 (여기만 작업)
└── archive/               ← 이전 복사본 보관 (참고만)
```

## 운영 URL (Firebase)

| 용도 | 링크 |
|------|------|
| **학회원** | https://hyspark-attendance-member.web.app |
| **관리자** | https://hyspark-attendance-admin.web.app |
| 네트워킹 관리 | https://hyspark-attendance-admin.web.app/#/admin/networking |

학회원·관리자는 **별도 Hosting 사이트**로 배포됩니다. 링크를 구분해서 공유하세요.

## 빠른 시작

```bash
cd hyspark-attendence
npm install
cp .env.example .env    # Supabase URL·키 입력
npm run dev             # http://localhost:8080
```

## 배포

```bash
cd hyspark-attendence
npm run deploy
```

Firebase 프로젝트: `pi-shirt`  
Hosting 사이트: `hyspark-attendance-admin`, `hyspark-attendance-member`

## 백엔드

- **Supabase** — DB, Auth, Edge Functions (`hyspark-attendence/supabase/`)
- 프로젝트 ID: `utwzwlowluxrdlifypzx`

## archive/ 안내

`hyspark-attendence-live`(구 Vercel), `hyspark-attendence-github`, `project-code`(초기본), 원본 zip 등은 `archive/`에 보관했습니다. 상세는 `archive/README.md` 참고.

## 이전 운영 URL (참고)

- Vercel: https://hyspark-attendence.vercel.app/ — **Firebase로 이전 완료**
