import { invokeWithAdminToken } from '@/lib/adminApi';
import { buildCampSurveyReminderEmail } from '@/lib/emailHtmlTemplates';
import { memberPortalUrlForProfile } from '@/lib/memberPortalToken';
import { filterTestEmailRecipients } from '@/lib/emailTestPolicy';
import type { MemberWithSummary } from '@/types';

export function formatCampTodayLabel(date = new Date()) {
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function buildCampSurveyPreviewHtml(params: {
  memberName: string;
  campTitle: string;
  campDateRange: string;
  todayLabel?: string;
  campSurveyLink?: string;
}) {
  return buildCampSurveyReminderEmail({
    memberName: params.memberName,
    campTitle: params.campTitle,
    campDateRange: params.campDateRange,
    todayLabel: params.todayLabel || formatCampTodayLabel(),
    campSurveyLink: params.campSurveyLink,
  }).html;
}

export async function buildCampSurveyPreviewHtmlAsync(params: {
  memberId: string;
  memberName: string;
  campTitle: string;
  campDateRange: string;
  todayLabel?: string;
}) {
  const campSurveyLink = await memberPortalUrlForProfile('camp-survey', params.memberId);
  return buildCampSurveyPreviewHtml({
    memberName: params.memberName,
    campTitle: params.campTitle,
    campDateRange: params.campDateRange,
    todayLabel: params.todayLabel,
    campSurveyLink,
  });
}

export async function sendCampSurveyTestEmails(params: {
  members: MemberWithSummary[];
  campTitle: string;
  campDateRange: string;
}) {
  const recipients = filterTestEmailRecipients(
    params.members.filter(member => member.status === 'active' && member.email),
  );

  if (recipients.length === 0) {
    return { error: new Error('테스트 발송은 cmins1@naver.com 등록 멤버만 가능합니다.'), sent: 0 };
  }

  const todayLabel = formatCampTodayLabel();
  const messages = await Promise.all(recipients.map(async member => {
    const campSurveyLink = await memberPortalUrlForProfile('camp-survey', member.id);
    const { subject, html } = buildCampSurveyReminderEmail({
      memberName: member.full_name,
      campTitle: params.campTitle,
      campDateRange: params.campDateRange,
      todayLabel,
      campSurveyLink,
    });
    return {
      recipientId: member.id,
      subject,
      body: html,
      html: true,
    };
  }));

  const { data, error } = await invokeWithAdminToken('send-member-email', {
    body: {
      messages,
      manual: true,
    },
  });

  if (error) return { error: new Error(error.message), sent: 0 };
  if (data?.error) return { error: new Error(data.error), sent: 0 };
  return { error: null, sent: data.sent as number };
}
