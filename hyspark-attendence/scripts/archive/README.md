# scripts/archive — 일회성 마이그레이션 도구

2026-06 초기 Supabase 데이터 이전용 스크립트입니다. **운영 배포·일상 실행에 사용하지 마세요.**

| 파일 | 용도 |
|------|------|
| `migrate-supabase-data.py` | 구→신 프로젝트 데이터 복사 |
| `generate-migration-sql.py` | SQL 덤프 생성 |
| `run-migration-import.py` / `.sh` | 일괄 import |

현재 운영 QA·배포 스크립트: `smoke-security.sh`, `smoke-e2e-api.sh`, `firebase-setup-and-deploy.sh`
