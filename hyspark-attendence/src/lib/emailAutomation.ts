import type { EmailTemplateKind } from '@/lib/emailHtmlTemplates';

export type EmailTriggerType = 'session_before' | 'session_open' | 'checkin_complete';
export type EmailAudience = 'all_members' | 'staff';

export interface EmailAutomationRule {
  id: string;
  name: string;
  trigger_type: EmailTriggerType;
  offset_minutes: number;
  audience: EmailAudience;
  subject_template: string;
  body_template: string;
  require_networking: boolean;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmailSendLog {
  id: string;
  rule_id: string | null;
  session_id: string | null;
  profile_id: string | null;
  email: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  message_id: string | null;
  error_message: string | null;
  dedupe_key: string;
  sent_at: string;
}

export interface EmailAutomationRun {
  id: string;
  checked_at: string;
  opened: number;
  closed: number;
  sent: number;
  skipped: number;
  failed: number;
  rules_checked: number;
  trigger_source: string;
  error_message: string | null;
  raw_response: Record<string, unknown> | null;
}

export const FIXED_AUTOMATIONS: Array<{
  trigger: EmailTriggerType;
  kind: EmailTemplateKind;
  name: string;
  description: string;
  offsetMinutes?: number;
}> = [
  {
    trigger: 'session_before',
    kind: 'session_reminder_5d',
    name: '5일 전 리마인드',
    description: '월요일 오전 10:00 — 장소·일정 안내 + 미리 결석 신청',
    offsetMinutes: -7200,
  },
  {
    trigger: 'session_before',
    kind: 'session_reminder_1d',
    name: '1일 전 리마인드',
    description: '세션 24시간 전 — 장소·일정 안내 + 미리 결석 신청',
    offsetMinutes: -1440,
  },
  {
    trigger: 'session_open',
    kind: 'session_open',
    name: '출석 오픈',
    description: '출석 오픈 시 — 강의실 코드 확인 후 체크인',
  },
  {
    trigger: 'checkin_complete',
    kind: 'checkin_complete',
    name: '출석 완료',
    description: '체크인 직후 — 체크인 시간·결과 발송',
  },
];

export const AUTOMATION_TIMING: Record<EmailTemplateKind, string> = {
  session_reminder_5d: '세션 5일 전 주 월요일 오전 10:00에 활성 학회원 전원에게 자동 발송',
  session_reminder_1d: '세션 시작 24시간 전에 활성 학회원 전원에게 자동 발송',
  session_open: '출석 코드가 활성화되는 순간 활성 학회원 전원에게 자동 발송',
  checkin_complete: '멤버가 체크인을 완료한 직후 해당 멤버에게 자동 발송',
};

export function findRuleForKind(rules: EmailAutomationRule[], kind: EmailTemplateKind) {
  const fixed = FIXED_AUTOMATIONS.find(item => item.kind === kind);
  if (!fixed) return undefined;
  return rules.find(rule =>
    rule.trigger_type === fixed.trigger
    && (fixed.offsetMinutes === undefined || rule.offset_minutes === fixed.offsetMinutes),
  );
}

export function orderedStandardRules(rules: EmailAutomationRule[]) {
  return FIXED_AUTOMATIONS.map(fixed => {
    const rule = findRuleForKind(rules, fixed.kind);
    return { fixed, rule };
  });
}
