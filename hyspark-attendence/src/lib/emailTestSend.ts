import { supabase } from '@/integrations/supabase/client';
import { invokeWithAdminToken } from '@/lib/adminApi';
import {
  SessionEmailTemplateKind,
  buildEmailFromSession,
} from '@/lib/emailHtmlTemplates';
import { memberPortalUrlForProfile } from '@/lib/memberPortalToken';
import type { MemberWithSummary, Session } from '@/types';
import { filterTestEmailRecipients } from '@/lib/emailTestPolicy';

async function buildPersonalizedEmail(
  kind: SessionEmailTemplateKind,
  member: MemberWithSummary,
  session: Session,
  checkInExtra?: { checkedInAt: string; attendanceStatus: 'present' | 'late' | 'unexcused_absent' },
  { previewUnsubscribe = false } = {},
) {
  const [absenceLink, checkInLink] = await Promise.all([
    memberPortalUrlForProfile('absence', member.id),
    memberPortalUrlForProfile('checkin', member.id),
  ]);
  return buildEmailFromSession(
    kind,
    { full_name: member.full_name },
    {
      title: session.title,
      start_at: session.start_at,
      venue_name: session.venue_name,
      venue_map_url: session.venue_map_url,
      venue_lat: session.venue_lat,
      venue_lng: session.venue_lng,
      attendance_code: session.attendance_code,
      check_in_open_minutes: session.check_in_open_minutes,
    },
    {
      ...checkInExtra,
      absenceLink,
      checkInLink,
      unsubscribeUrl: previewUnsubscribe && kind !== 'checkin_complete' ? '#unsubscribe-preview' : undefined,
    },
  );
}

export async function sendTemplateEmails(params: {
  kind: SessionEmailTemplateKind;
  session: Session;
  members: MemberWithSummary[];
  ruleId?: string | null;
  checkInExtra?: { checkedInAt: string; attendanceStatus: 'present' | 'late' | 'unexcused_absent' };
}) {
  const { kind, session, members, ruleId, checkInExtra } = params;
  const recipients = filterTestEmailRecipients(
    members.filter(m => m.status === 'active' && m.email),
  );

  if (recipients.length === 0) {
    return { error: new Error('수신자를 선택해주세요.'), sent: 0 };
  }

  if (kind === 'checkin_complete') {
    const checkedInAt = checkInExtra?.checkedInAt || new Date().toISOString();
    const status = checkInExtra?.attendanceStatus || 'present';
    let sent = 0;
    const errors: string[] = [];

    for (const member of recipients) {
      const { data, error } = await supabase.functions.invoke('send-checkin-email', {
        body: {
          memberId: member.id,
          sessionId: session.id,
          checkedInAt,
          status,
        },
      });
      if (error) {
        errors.push(error.message);
        continue;
      }
      if (data?.error) {
        errors.push(data.error);
        continue;
      }
      if (data?.sent || data?.skipped) sent += data.sent ? 1 : 0;
    }

    if (sent === 0 && errors.length > 0) {
      return { error: new Error(errors[0]), sent: 0 };
    }
    return { error: null, sent };
  }

  const messages = await Promise.all(recipients.map(async member => {
    const { subject, html } = await buildPersonalizedEmail(kind, member, session);
    return {
      recipientId: member.id,
      subject,
      body: html,
      html: true,
    };
  }));

  const { data, error } = await invokeWithAdminToken<{ sent?: number; error?: string }>('send-member-email', {
    body: {
      messages,
      ruleId: ruleId || null,
      sessionId: session.id,
      manual: true,
    },
  });

  if (error) return { error: new Error(error.message), sent: 0 };
  if (data?.error) return { error: new Error(data.error), sent: 0 };
  return { error: null, sent: data.sent as number };
}

export function buildPreviewHtml(
  kind: SessionEmailTemplateKind,
  session: Session,
  memberName: string,
  checkInExtra?: { checkedInAt: string; attendanceStatus: 'present' | 'late' | 'unexcused_absent' },
) {
  return buildEmailFromSession(
    kind,
    { full_name: memberName },
    {
      title: session.title,
      start_at: session.start_at,
      venue_name: session.venue_name,
      venue_map_url: session.venue_map_url,
      venue_lat: session.venue_lat,
      venue_lng: session.venue_lng,
      attendance_code: session.attendance_code,
      check_in_open_minutes: session.check_in_open_minutes,
    },
    checkInExtra,
  ).html;
}

/** Admin 미리보기·테스트 발송용 — 수신 멤버별 m= 토큰 링크 포함 + 수신거부 링크 placeholder */
export async function buildPreviewHtmlAsync(
  kind: SessionEmailTemplateKind,
  session: Session,
  member: MemberWithSummary,
  checkInExtra?: { checkedInAt: string; attendanceStatus: 'present' | 'late' | 'unexcused_absent' },
) {
  const built = await buildPersonalizedEmail(kind, member, session, checkInExtra, { previewUnsubscribe: true });
  return built.html;
}
