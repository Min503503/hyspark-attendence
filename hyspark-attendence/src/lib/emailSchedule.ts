import type { SessionEmailTemplateKind } from '@/lib/emailHtmlTemplates';
import type { EmailAutomationRule } from '@/lib/emailAutomation';
import type { Session } from '@/types';

const KST = 'Asia/Seoul';

type Ymd = { year: number; month: number; day: number };

function getKstYmd(date: Date): Ymd {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const read = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function getKstWeekday(date: Date): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: KST, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return map[label] ?? 0;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function dateAtKst(ymd: Ymd, hour: number, minute = 0): Date {
  return new Date(`${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}T${pad2(hour)}:${pad2(minute)}:00+09:00`);
}

function addDays(ymd: Ymd, days: number): Ymd {
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day + days);
  const shifted = new Date(utc);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function mondayOfWeek(ymd: Ymd): Ymd {
  const weekday = getKstWeekday(dateAtKst(ymd, 12));
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(ymd, -daysFromMonday);
}

/** 5일 전 리마인드: 세션 5일 전 날짜가 속한 주의 월요일 오전 10시 (KST) */
export function compute5DayReminderSendAt(sessionStartAt: string | Date): Date {
  const sessionYmd = getKstYmd(new Date(sessionStartAt));
  const anchor = addDays(sessionYmd, -5);
  const monday = mondayOfWeek(anchor);
  return dateAtKst(monday, 10, 0);
}

/** 1일 전 리마인드: 세션 시작 정확히 24시간 전 */
export function compute1DayReminderSendAt(sessionStartAt: string | Date): Date {
  const start = new Date(sessionStartAt);
  return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

export function computeSessionOpenSendAt(session: Pick<Session, 'start_at' | 'check_in_open_minutes' | 'attendance_code_issued_at' | 'status' | 'attendance_code_status'>): Date | null {
  if (session.attendance_code_issued_at) {
    return new Date(session.attendance_code_issued_at);
  }
  if (session.status !== 'scheduled' && session.status !== 'open') return null;
  const openMinutes = session.check_in_open_minutes ?? 15;
  return new Date(new Date(session.start_at).getTime() - openMinutes * 60 * 1000);
}

export function computeAutomationSendAt(
  kind: SessionEmailTemplateKind,
  session: Pick<Session, 'start_at' | 'check_in_open_minutes' | 'attendance_code_issued_at' | 'status' | 'attendance_code_status'>,
): Date | null {
  switch (kind) {
    case 'session_reminder_5d':
      return compute5DayReminderSendAt(session.start_at);
    case 'session_reminder_1d':
      return compute1DayReminderSendAt(session.start_at);
    case 'session_open':
      return computeSessionOpenSendAt(session);
    case 'checkin_complete':
      return null;
  }
}

export function computeAutomationSendAtFromRule(
  rule: Pick<EmailAutomationRule, 'trigger_type' | 'offset_minutes'>,
  session: Pick<Session, 'start_at' | 'check_in_open_minutes' | 'attendance_code_issued_at' | 'status' | 'attendance_code_status'>,
): Date | null {
  if (rule.trigger_type === 'session_before') {
    if (rule.offset_minutes === -7200) return compute5DayReminderSendAt(session.start_at);
    if (rule.offset_minutes === -1440) return compute1DayReminderSendAt(session.start_at);
    return null;
  }
  if (rule.trigger_type === 'session_open') return computeSessionOpenSendAt(session);
  return null;
}

export const AUTOMATION_SCHEDULE_POLICY: Record<SessionEmailTemplateKind, string> = {
  session_reminder_5d: '세션 5일 전 주 월요일 오전 10:00',
  session_reminder_1d: '세션 시작 24시간 전',
  session_open: '출석 코드 활성화 직후',
  checkin_complete: '체크인 완료 직후 (해당 멤버)',
};

export function formatAutomationSendTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    timeZone: KST,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function describeAutomationSendForSession(
  kind: SessionEmailTemplateKind,
  session: Pick<Session, 'title' | 'start_at' | 'check_in_open_minutes' | 'attendance_code_issued_at' | 'status' | 'attendance_code_status'>,
  now = new Date(),
): string {
  if (kind === 'checkin_complete') {
    return '멤버 체크인 시 즉시 발송';
  }

  const sendAt = computeAutomationSendAt(kind, session);
  if (!sendAt) return '발송 시점 미정';

  const formatted = formatAutomationSendTime(sendAt);
  if (sendAt.getTime() <= now.getTime()) {
    return `발송 완료 · ${formatted}`;
  }
  if (kind === 'session_open' && !session.attendance_code_issued_at) {
    return `예상 발송 · ${formatted} (출석 오픈 시)`;
  }
  return `발송 예정 · ${formatted}`;
}

export function nextRelevantSessionForAutomation(
  sessions: Session[],
  now = new Date(),
): Session | null {
  const candidates = sessions
    .filter(session => session.status === 'scheduled' || session.status === 'open')
    .filter(session => new Date(session.start_at).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return candidates[0] ?? null;
}

export function upcomingAutomationSessions(sessions: Session[], now = new Date(), limit = 3): Session[] {
  return sessions
    .filter(session => session.status === 'scheduled' || session.status === 'open')
    .filter(session => new Date(session.start_at).getTime() > now.getTime() - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, limit);
}
