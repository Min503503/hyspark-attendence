import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_SCHEDULE_POLICY,
  compute1DayReminderSendAt,
  compute5DayReminderSendAt,
  describeAutomationSendForSession,
  formatAutomationSendTime,
} from '@/lib/emailSchedule';

describe('emailSchedule', () => {
  it('5일 전 리마인드: 세션 5일 전 주 월요일 10:00 KST', () => {
    const sendAt = compute5DayReminderSendAt('2026-06-20T15:00:00+09:00');
    expect(sendAt.toISOString()).toBe('2026-06-15T01:00:00.000Z');
    expect(formatAutomationSendTime(sendAt)).toContain('10:00');
    expect(formatAutomationSendTime(sendAt)).toContain('월');
  });

  it('1일 전 리마인드: 세션 시작 24시간 전', () => {
    const sendAt = compute1DayReminderSendAt('2026-06-21T15:00:00+09:00');
    expect(sendAt.toISOString()).toBe('2026-06-20T06:00:00.000Z');
  });

  it('describes upcoming send time for each rule kind', () => {
    const session = {
      title: '6/21 정기 세션',
      start_at: '2026-06-21T15:00:00+09:00',
      check_in_open_minutes: 15,
      attendance_code_issued_at: null,
      status: 'scheduled' as const,
      attendance_code_status: 'inactive' as const,
    };

    expect(describeAutomationSendForSession('session_reminder_5d', session, new Date('2026-06-01T00:00:00+09:00')))
      .toContain('발송 예정');
    expect(describeAutomationSendForSession('session_reminder_1d', session, new Date('2026-06-01T00:00:00+09:00')))
      .toContain('발송 예정');
    expect(describeAutomationSendForSession('session_open', session, new Date('2026-06-01T00:00:00+09:00')))
      .toContain('예상 발송');
    expect(describeAutomationSendForSession('checkin_complete', session))
      .toContain('즉시');
  });

  it('exposes human-readable schedule policies', () => {
    expect(AUTOMATION_SCHEDULE_POLICY.session_reminder_5d).toContain('월요일');
    expect(AUTOMATION_SCHEDULE_POLICY.session_reminder_1d).toContain('24시간');
  });
});
