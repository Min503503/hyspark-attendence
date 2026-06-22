# 스파크 어탠던스 — 최종 배포 정리본

하이스파크 학회 출결 서비스 코드입니다.  
정리·Firebase 재배포: **2026-06-19**

## 폴더 구조

```
스파크어탠던스_코드정리_20260610/
├── hyspark-attendence/    ← ★ 운영·배포용 (여기만 작업)
└── archive/               ← 이전 복사본 보관 (참고만)
```

## 운영 URL (Firebase)

| 용도 | 링크 |
|------|------|
| **학회원** | https://hysparkpre-member.web.app |
| **관리자** | https://hysparkpre-admin.web.app |

학회원·관리자는 **별도 Hosting 사이트**로 배포됩니다. 링크를 구분해서 공유하세요.

## 빠른 시작

```bash
cd hyspark-attendence
npm install
cp .env.example .env    # Supabase URL·키 입력
npm run dev:member      # 학회원 로컬
npm run dev:admin       # 관리자 로컬
```

## 배포

```bash
cd hyspark-attendence
npm run deploy
```

Firebase 프로젝트: **`hyspark-95182`**  
Hosting 사이트: **`hysparkpre-admin`**, **`hysparkpre-member`**

최초 설정·사이트 생성: `bash scripts/firebase-setup-and-deploy.sh`

## 백엔드

- **Supabase** — DB, Auth, Edge Functions (`hyspark-attendence/supabase/`)
- 프로젝트 ref: **`lwbjprzrnmlnmzlxiwrv`**
- 대시보드: https://supabase.com/dashboard/project/lwbjprzrnmlnmzlxiwrv

## archive/ 안내

`hyspark-attendence-live`(구 Vercel·네트워킹 포함), `hyspark-attendence-github`, `project-code`(초기본) 등은 `archive/`에 보관했습니다. **수정·배포하지 마세요.** 상세는 `archive/README.md` 참고.

## 레거시 URL (폐기됨 — 사용하지 마세요)

| 구분 | URL | 상태 |
|------|-----|------|
| 구 Firebase (`pi-shirt`) | `hyspark-attendance-admin.web.app`, `hyspark-attendance-member.web.app` | **404 / Site Not Found — 폐기** |
| 구 Vercel | https://hyspark-attendence.vercel.app/ | 참고용 archive만 |
