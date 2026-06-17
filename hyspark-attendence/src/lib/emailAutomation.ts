import type { EmailTemplateKind } from '@/lib/emailHtmlTemplates';
import type { SupabaseClient } from '@supabase/supabase-js';

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

export type EmailRuleDraft = Omit<EmailAutomationRule, 'id' | 'created_at' | 'updated_at'>;

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

/** DB에 upsert할 4종 표준 자동화 규칙 */
export const DEFAULT_EMAIL_RULES: EmailRuleDraft[] = [
  {
    name: '5일 전 리마인드',
    trigger_type: 'session_before',
    offset_minutes: -7200,
    audience: 'all_members',
    subject_template: '[HySpark] 5일 후 세션 안내 — {세션제목}',
    body_template: 'html:session_reminder_5d',
    require_networking: false,
    enabled: true,
    sort_order: 1,
  },
  {
    name: '1일 전 리마인드',
    trigger_type: 'session_before',
    offset_minutes: -1440,
    audience: 'all_members',
    subject_template: '[HySpark] 내일 세션 안내 — {세션제목}',
    body_template: 'html:session_reminder_1d',
    require_networking: false,
    enabled: true,
    sort_order: 2,
  },
  {
    name: '출석 오픈',
    trigger_type: 'session_open',
    offset_minutes: 0,
    audience: 'all_members',
    subject_template: '[HySpark] 지금 출석체크 — {세션제목}',
    body_template: 'html:session_open',
    require_networking: false,
    enabled: true,
    sort_order: 3,
  },
  {
    name: '출석 완료',
    trigger_type: 'checkin_complete',
    offset_minutes: 0,
    audience: 'all_members',
    subject_template: '[HySpark] 출석 완료 — {세션제목}',
    body_template: 'html:checkin_complete',
    require_networking: false,
    enabled: true,
    sort_order: 4,
  },
];

function ruleKey(trigger: EmailTriggerType, offsetMinutes: number) {
  return trigger === 'session_before' ? `${trigger}:${offsetMinutes}` : trigger;
}

/** 운영 콘솔 진입 시 4종 표준 규칙 동기화 + 중복·비표준 규칙 정리 */
export async function syncDefaultAutomationRules(client: SupabaseClient) {
  const { data: existing, error } = await client
    .from('email_automation_rules')
    .select('id, trigger_type, offset_minutes');

  if (error) return { error };

  const standardKeys = new Set(
    DEFAULT_EMAIL_RULES.map(rule => ruleKey(rule.trigger_type, rule.offset_minutes)),
  );

  const byKey = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const row of existing || []) {
    const key = ruleKey(row.trigger_type as EmailTriggerType, row.offset_minutes);
    if (!standardKeys.has(key)) {
      duplicateIds.push(row.id);
      continue;
    }
    if (byKey.has(key)) {
      duplicateIds.push(row.id);
    } else {
      byKey.set(key, row.id);
    }
  }

  if (duplicateIds.length > 0) {
    await client.from('email_automation_rules').delete().in('id', duplicateIds);
  }

  for (const rule of DEFAULT_EMAIL_RULES) {
    const key = ruleKey(rule.trigger_type, rule.offset_minutes);
    const id = byKey.get(key);
    const now = new Date().toISOString();

    if (id) {
      const { enabled: _enabled, ...syncFields } = rule;
      const { error: updateError } = await client
        .from('email_automation_rules')
        .update({ ...syncFields, updated_at: now })
        .eq('id', id);
      if (updateError) return { error: updateError };
    } else {
      const { error: insertError } = await client
        .from('email_automation_rules')
        .insert({ ...rule, updated_at: now });
      if (insertError) return { error: insertError };
    }
  }

  return { error: null };
}

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

export const TRIGGER_LABELS: Record<EmailTriggerType, string> = {
  session_before: '세션 N일 전',
  session_open: '출석 오픈 시',
  checkin_complete: '체크인 완료 시',
};

export function formatOffsetLabel(minutes: number) {
  const abs = Math.abs(minutes);
  if (abs >= 1440 && abs % 1440 === 0) return `${abs / 1440}일 ${minutes < 0 ? '전' : '후'}`;
  if (abs >= 60 && abs % 60 === 0) return `${abs / 60}시간 ${minutes < 0 ? '전' : '후'}`;
  return `${abs}분 ${minutes < 0 ? '전' : '후'}`;
}

export const DEFAULT_MANUAL_SUBJECT = '[HySpark] 공지';
