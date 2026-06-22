# HySpark 에이전트 회고 (2026-06)

사용자(민수)와의 대화에서 반복된 오해·실수를 정리했다.  
재발 방지 규칙:

- **전역 (모든 프로젝트):** `~/.cursor/rules/` — `agent-retrospective-global.mdc`, `user-requirements-global.mdc`, `delivery-verification.mdc`, `korean-short-commands.mdc` + `/Users/choiminsoo/Documents/docs/AGENT_RETROSPECTIVE_GLOBAL.md`
- **HySpark 전용:** `.cursor/rules/agent-retrospective.mdc`, `hyspark-session-retrospective.mdc`, `dual-portal-delivery.mdc`, `email-venue-card.mdc`

---

## 1. 명령 vs 실제로 한 일

| 사용자 명령 | 내가 잘못 이해하거나 늦게 한 것 | 올바른 해석 |
|-------------|--------------------------------|-------------|
| 멤버칸에 이메일 넣을 수 있게 ㄱㄱ | 소스에 이미 추가 다이얼로그 이메일이 있어 **10회 이상 탐색만** 하고 멈출 뻔함 | **목록에서 바로 입력·저장**(인라인) 또는 **배포 안 된 상태**일 수 있음 → 빠르게 UI 수정 후 배포 여부 확인 |
| ㄱㄱㄱ | (이번엔 잘함) 배포 실행 | 추가 질문 없이 `npm run deploy` |
| 학회원 출석 UI 재설계 | 코드는 맞게 했으나 **어느 URL에서 보는지** 안내 부족 | member 포털 + `dist-member` + 배포 URL까지 한 번에 안내 |
| 이거 안 보이는구만 | 처음에 “코드 문제”로만 생각할 여지 | **admin/member 포털 혼동**, `dist` vs `dist-member` 미빌드, **미배포**, 캐시 |
| 배포해 / 다 수정하고 최종 배포 ㄱㄱ | 가끔 로컬만 수정하고 끝냄 | Firebase `build:firebase` + `deploy`까지가 “끝” |
| Gmail 계정을 X로 바꿀게 | 계정을 여러 번 바꿀 때 **부분 수정**·Ask 모드에서 멈춤 | 코드·`.env`·OAuth·Supabase secrets·Function 배포 **한 세트** |
| Supabase는 다른 계정이어도 되지? | 처음에 “같은 계정”처럼 묶어 설명 | **Gmail 발송 계정 ≠ Supabase 프로젝트 소유 계정** 가능 |

---

## 2. 반복된 실수 패턴

### A. 탐색 과다, 실행 지연
- “이미 구현돼 있는 것 같다”고 **사용자 관점(배포된 화면)** 을 확인하지 않음.
- archive, dist, transcript까지 뒤지다가 첫 코드 수정이 늦어짐.
- **교훈**: UI 한 줄 요청 → 핵심 파일 1~2개 읽고 → 바로 수정 → 배포/URL 안내.

### B. 듀얼 포털 혼동 (가장 많이 반복)
- `VITE_PORTAL=admin` dev 서버에서 member UI를 찾음.
- `npm run build`만 해서 `dist/`만 갱신, Firebase는 `dist-member` / `dist-admin` 사용.
- **교훈**: `.cursor/rules/dual-portal-delivery.mdc` 준수. “안 보인다” = 포털·빌드·배포부터.

### C. “완료” 보고가 코드 수정에만 그침
- 사용자는 **https://hysparkpre-admin.web.app** / **https://hysparkpre-member.web.app** 에서 확인함.
- 로컬 `npm run dev` 안내만 하고 배포는 나중에 → “안 보인다” 피드백.
- **교훈**: UI 완료 보고 = **확인 URL(로컬 member/admin + 프로덕션) + 배포 여부** 필수.

### D. 짧은 한국어 명령을 과해석
- `ㄱㄱ` / `ㄱㄱㄱ` = 승인·즉시 실행 (배포, 적용, 계속).
- `멤버칸` = 관리자 **멤버 관리** 목록 행 UI (`AdminMembers.tsx`).
- **교훈**: 짧으면 실행 쪽으로 기울이고, 애매할 때만 한 가지만 확인.

### E. 외부 연동(Gmail) 설정의 산발적 변경
- 발송 계정을 여러 번 변경하면서 README·코드·secrets가 어긋날 뻔함.
- OAuth redirect URI, 홈페이지 검증(about.html) 이슈를 여러 턴에 나눠 해결.
- **교훈**: 계정/클라이언트 변경 시 **체크리스트 한 번에** 끝내기 (아래 규칙 파일 참고).

### F. Supabase 프로젝트 소유권 혼란
- `utwzwlowluxrdlifypzx` 링크 권한 없음 → 사용자가 어떤 계정인지 모름.
- 결국 새 프로젝트로 마이그레이션.
- **교훈**: `supabase link` 실패 시 계정/프로젝트 ref를 먼저 확인하고, 데이터 이전 스크립트 경로 안내.

---

## 3. 잘했던 것

- “안 보인다” 이후 **원인(포털·dist-member·배포)** 을 찾아 `dev:member` 추가 및 배포로 해결.
- 멤버 이메일: 인라인 입력 + blur 저장으로 **실사용 UX**에 맞게 구현.
- `ㄱㄱㄱ`에 바로 `npm run deploy` 실행.

## 4. 2026-06-17 회고 (수동 발송 HTML)

| 요청 | 결과 | 교훈 |
|------|------|------|
| 수동 발송도 HTML 틀 | `buildManualEmailHtml` + Edge `manual: true` | 클라이언트만 고치지 말고 **발송 경로(서버)** 에 래핑 |
| 배포 ㄱㄱ | `npm run gmail:deploy` 완료 | Edge만 변경 시 **프론트 재배포 불필요**라고 명시 |
| 회고 → 규칙 | `manual-email-html.mdc` + 전역 `~/.cursor/rules/` | 회고는 **규칙 파일**로 남겨야 재발 방지 |

---

## 5. 앞으로 에이전트가 할 일 (요약)

1. HySpark UI 작업 → member/admin **어느 쪽인지** 먼저 확정.
2. 기능 구현 → `build:firebase` 산출물 검증 → URL 안내 → (요청 시) 배포.
3. “멤버칸” = 목록 인라인 편집까지 고려.
4. Gmail/Supabase 설정 변경 = 전 파일·secrets·OAuth·deploy 일괄.
5. 탐색 3파일 넘기기 전에 **사용자가 보는 화면(배포 URL)** 부터 확인.

---

## 관련 규칙 파일

| 파일 | 용도 |
|------|------|
| `~/.cursor/rules/agent-retrospective-global.mdc` | **전 프로젝트** 공통 회고 (alwaysApply) |
| `Documents/docs/AGENT_RETROSPECTIVE_GLOBAL.md` | 범용 회고 상세 문서 |
| `Documents/AGENTS.md` | Documents 워크스페이스 전역 안내 |
| `.cursor/rules/agent-retrospective.mdc` | HySpark 전용 보조 |
| `.cursor/rules/hyspark-session-retrospective.mdc` | HySpark 이메일·배포·UI 상세 |
| `.cursor/rules/manual-email-html.mdc` | 수동 발송 HTML 틀 + Edge 래핑 |
| `.cursor/rules/dual-portal-delivery.mdc` | member/admin 빌드·배포 |
| `.cursor/rules/user-requirements.mdc` | 사용자 지시 누락 금지 |
