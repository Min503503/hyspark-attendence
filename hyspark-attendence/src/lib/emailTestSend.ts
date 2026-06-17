import { supabase } from '@/integrations/supabase/client';
import {
  EmailTemplateKind,
  buildEmailFromSession,
} from '@/lib/emailHtmlTemplates';
import type { MemberWithSummary, Session } from '@/types';

export async function sendTemplateEmails(params: {
  kind: EmailTemplateKind;
  session: Session;
  members: MemberWithSummary[];
  ruleId?: string | null;
  checkInExtra?: { checkedInAt: string; attendanceStatus: 'present' | 'late' | 'unexcused_absent' };
}) {
  const { kind, session, members, ruleId, checkInExtra } = params;
  const recipients = members.filter(m => m.status === 'active' && m.email);

  if (recipients.length === 0) {
    return { error: new Error('이메일이 등록된 수신자가 없습니다.'), sent: 0 };
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

  const messages = recipients.map(member => {
    const { subject, html } = buildEmailFromSession(
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
    );
    return {
      recipientId: member.id,
      subject,
      body: html,
      html: true,
    };
  });

  const { data, error } = await supabase.functions.invoke('send-member-email', {
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
  kind: EmailTemplateKind,
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
