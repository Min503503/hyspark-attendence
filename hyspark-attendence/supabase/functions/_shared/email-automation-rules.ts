/** Canonical 4 email automation rules — keep in sync with migration 20260619150000 */

export type EmailRuleSeed = {
  name: string;
  trigger_type: "session_before" | "session_open" | "checkin_complete";
  offset_minutes: number;
  audience: "all_members" | "staff";
  subject_template: string;
  body_template: string;
  require_networking: boolean;
  enabled: boolean;
  sort_order: number;
};

export const DEFAULT_EMAIL_RULES: EmailRuleSeed[] = [
  {
    name: "5일 전 리마인드",
    trigger_type: "session_before",
    offset_minutes: -7200,
    audience: "all_members",
    subject_template: "[HySpark] 5일 후 세션 안내 — {세션제목}",
    body_template: "html:session_reminder_5d",
    require_networking: false,
    enabled: true,
    sort_order: 1,
  },
  {
    name: "1일 전 리마인드",
    trigger_type: "session_before",
    offset_minutes: -1440,
    audience: "all_members",
    subject_template: "[HySpark] 내일 세션 안내 — {세션제목}",
    body_template: "html:session_reminder_1d",
    require_networking: false,
    enabled: true,
    sort_order: 2,
  },
  {
    name: "출석 오픈",
    trigger_type: "session_open",
    offset_minutes: 0,
    audience: "all_members",
    subject_template: "[HySpark] 지금 출석체크 — {세션제목}",
    body_template: "html:session_open",
    require_networking: false,
    enabled: true,
    sort_order: 3,
  },
  {
    name: "출석 완료",
    trigger_type: "checkin_complete",
    offset_minutes: 0,
    audience: "all_members",
    subject_template: "[HySpark] 출석 완료 — {세션제목}",
    body_template: "html:checkin_complete",
    require_networking: false,
    enabled: true,
    sort_order: 4,
  },
];

export function ruleKey(trigger: string, offsetMinutes: number) {
  return trigger === "session_before" ? `${trigger}:${offsetMinutes}` : trigger;
}
