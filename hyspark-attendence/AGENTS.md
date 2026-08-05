# HySpark Attendance — Agent Notes

## 세션 회고 (2026-06)

| 범위 | 위치 |
|------|------|
| **모든 프로젝트** | `~/.cursor/rules/` (4개 alwaysApply) · `/Users/choiminsoo/Documents/docs/AGENT_RETROSPECTIVE_GLOBAL.md` · `Documents/AGENTS.md` |
| **HySpark 전용** | `.cursor/rules/agent-retrospective.mdc`, `hyspark-session-retrospective.mdc`, `browser-security-review.mdc`, `cross-tool-git.mdc`, `docs/AGENT_RETROSPECTIVE.md` |

**HySpark 핵심:** 4종 자동화 · 장소 카드 · 프론트↔엣지 메일 동기화 · `intent=absence|checkin` · 배포 명시 요청 후

## 사용자 요구사항

사용자가 명시한 기능·UI·문구·데이터는 **임의로 제거하지 않는다**. 리팩터 후에도 요구 항목이 그대로 있는지 확인한다.

## 자동 발송 메일 (4종)

1. 5일 전 리마인드
2. 1일 전 리마인드
3. 출석 오픈
4. 체크인 완료

5일 전 / 1일 전 / 출석 오픈 메일에는 **세션 장소 카드가 항상** 포함되어야 한다 (`src/lib/sessionVenue.ts`).

## 멤버 포털 링크

메일 CTA는 `/#/member`로 보내지 않는다. `memberPortalUrl()` 사용:

- 결석 신청: `/#/?intent=absence` → 이름 입력 화면 → 로그인 후 결석 다이얼로그
- 출석체크: `/#/?intent=checkin`
- 멤버 앱 기본 사용자는 `null` (운영진 더미 계정 금지)

`/member` 경로는 레거시 리다이렉트만 유지한다.

## 수동 발송 메일

- 공지 등 자유 형식 본문도 `buildManualEmailHtml` / `emailShell` 틀로 HTML 발송 (`manual: true`).
- 래핑은 `send-member-email` Edge Function에서 수행. 규칙: `.cursor/rules/manual-email-html.mdc`
- Edge만 변경 시 프론트 재배포 **불필요**.

## 배포

- Admin: `npm run deploy:admin`
- Member+Admin: `npm run deploy`
- 로컬: `npm run dev:member` / `npm run dev:admin`
- Edge functions: `npm run gmail:deploy` (send-member-email) 또는 `supabase functions deploy … --project-ref lwbjprzrnmlnmzlxiwrv`

사용자가 배포를 명시적으로 요청하거나 **ㄱㄱ** 할 때까지 임의 배포하지 않는다.

## UI 작업 후 회고에서 나온 실수 방지

- `npm run build`만 하고 끝내지 않는다. 프로덕션은 `dist-member` / `dist-admin`이다.
- 멤버 UI를 바꿨으면 완료 보고에 **확인 URL**(로컬 member dev 또는 member.web.app)을 반드시 적는다.
- admin dev 서버(5173 등)만 켜진 상태에서 member UI가 “안 보인다”고 하면, 포털 혼동부터 점검한다.

자세한 체크리스트: `.cursor/rules/dual-portal-delivery.mdc`

## Cursor ↔ Antigravity Git

- 전역: `~/.cursor/rules/cross-tool-version-control.mdc`
- HySpark: `.cursor/rules/cross-tool-git.mdc` · `docs/CROSS_TOOL_GIT.md`
- Antigravity 프롬프트: `Documents/docs/CROSS_TOOL_GIT.md`
- **세션 종료 시 자동 commit + push** (「커밋하지마」 등 예외)
- **push ≠ Firebase/Edge 배포**
