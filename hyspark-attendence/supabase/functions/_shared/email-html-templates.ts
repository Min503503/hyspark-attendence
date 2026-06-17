/** Deno mirror of src/lib/emailHtmlTemplates.ts */
import {
  VENUE_MISSING_PLACEHOLDER,
  isVenueMissing,
  resolveVenueDisplayName,
  resolveVenueMapsUrl,
} from "./session-venue.ts";

export { resolveVenueDisplayName, resolveVenueMapsUrl, VENUE_MISSING_PLACEHOLDER } from "./session-venue.ts";

const APP_NAME = "HySpark";
function memberSiteUrl() { return Deno.env.get("MEMBER_SITE_URL") || "https://hyspark-attendance-member.web.app"; }
function memberPortalUrl(intent?: "absence" | "checkin") {
  const base = memberSiteUrl();
  if (!intent) return `${base}/#/`;
  return `${base}/#/?intent=${intent}`;
}
function emailLogoUrl() {
  return Deno.env.get("EMAIL_LOGO_URL") || "https://hyspark-attendance-admin.web.app/hyspark-logo.png";
}



export type EmailTemplateKind =
  | 'session_reminder_5d'
  | 'session_reminder_1d'
  | 'session_open'
  | 'checkin_complete';

export type AttendanceStatusLabel = 'present' | 'late' | 'unexcused_absent';

export interface EmailTemplateData {
  memberName: string;
  sessionTitle: string;
  sessionDateTime: string;
  memberLink?: string;
  absenceLink?: string;
  checkInLink?: string;
  venueName?: string;
  venueMapsUrl?: string;
  attendanceCode?: string;
  checkInOpenMinutes?: number;
  checkedInAt?: string;
  attendanceStatus?: AttendanceStatusLabel;
}

export const EMAIL_KIND_LABELS: Record<EmailTemplateKind, string> = {
  session_reminder_5d: '5일 전 리마인드',
  session_reminder_1d: '1일 전 리마인드',
  session_open: '출석 오픈',
  checkin_complete: '출석 완료',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusLabel, string> = {
  present: '출석',
  late: '지각',
  unexcused_absent: '결석',
};

/** Logo PNG is 638×326 — keep aspect ratio */
const LOGO_WIDTH = 108;
const LOGO_HEIGHT = 55;

/** Toss-style typography — Pretendard first, loaded via inline @font-face for email + preview */
const FONT_STACK = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const PRETENDARD_WOFF2 =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2';

function emailFontHead() {
  return `
  <style>
    @font-face {
      font-family: 'Pretendard';
      font-weight: 400;
      font-style: normal;
      font-display: swap;
      src: url('${PRETENDARD_WOFF2}/Pretendard-Regular.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Pretendard';
      font-weight: 600;
      font-style: normal;
      font-display: swap;
      src: url('${PRETENDARD_WOFF2}/Pretendard-SemiBold.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Pretendard';
      font-weight: 700;
      font-style: normal;
      font-display: swap;
      src: url('${PRETENDARD_WOFF2}/Pretendard-Bold.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Pretendard';
      font-weight: 800;
      font-style: normal;
      font-display: swap;
      src: url('${PRETENDARD_WOFF2}/Pretendard-ExtraBold.woff2') format('woff2');
    }
    body, table, td, p, a, h1, div, span {
      font-family: ${FONT_STACK};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    a.email-btn {
      display: block !important;
      width: 100% !important;
      min-height: 52px !important;
      box-sizing: border-box !important;
      padding: 18px 28px !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-decoration: none !important;
      text-align: center !important;
      -webkit-text-size-adjust: none !important;
    }
  </style>`;
}

const C = {
  pageBg: '#F2F4F6',
  cardBg: '#FFFFFF',
  title: '#191F28',
  body: '#4E5968',
  caption: '#8B95A1',
  primary: '#3182F6',
  primaryDark: '#1B64DA',
  primarySoft: '#E8F3FF',
  border: '#E5E8EB',
  softBg: '#F9FAFB',
};

export const SAMPLE_EMAIL_DATA: Record<EmailTemplateKind, EmailTemplateData> = {
  session_reminder_5d: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: memberSiteUrl(),
    absenceLink: memberPortalUrl("absence"),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  session_reminder_1d: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: memberSiteUrl(),
    absenceLink: memberPortalUrl("absence"),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  session_open: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: memberSiteUrl(),
    checkInLink: memberPortalUrl("checkin"),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  checkin_complete: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: memberSiteUrl(),
    checkedInAt: '2026년 6월 17일 (화) 15:03',
    attendanceStatus: 'present',
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bodyText(html: string) {
  return `<p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:16px;line-height:1.65;color:${C.body};font-weight:400;letter-spacing:-0.02em;">${html}</p>`;
}

function primaryButton(href: string, label: string) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 12px;border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${C.primaryDark}" style="border-radius:14px;background-color:${C.primaryDark};padding:0;">
          <a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="email-btn" style="display:block;width:100%;min-height:52px;box-sizing:border-box;padding:18px 28px;font-family:${FONT_STACK};font-size:18px;font-weight:700;line-height:1.45;color:#ffffff;background-color:${C.primaryDark};text-decoration:none;text-align:center;border-radius:14px;letter-spacing:-0.02em;-webkit-text-size-adjust:none;word-break:keep-all;mso-line-height-rule:exactly;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

function textLink(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;font-family:${FONT_STACK};font-size:14px;font-weight:600;line-height:1.4;color:${C.primary};text-decoration:underline;text-underline-offset:3px;letter-spacing:-0.02em;">${escapeHtml(label)}</a>`;
}

function venueInlineMapLink(href: string) {
  return ` (<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="font-family:${FONT_STACK};font-size:16px;font-weight:600;line-height:1.5;color:${C.primary};text-decoration:underline;text-underline-offset:3px;letter-spacing:-0.02em;">네이버 지도에서 보기</a>)`;
}

function venueInfoValueHtml(venueName: string, mapsUrl?: string) {
  const missing = isVenueMissing(venueName);
  const mapSuffix = mapsUrl ? venueInlineMapLink(mapsUrl) : '';
  return `<span style="font-family:${FONT_STACK};font-size:16px;font-weight:700;line-height:1.5;color:${missing ? C.caption : C.title};letter-spacing:-0.03em;word-break:keep-all;">${escapeHtml(venueName)}</span>${mapSuffix}`;
}

function sessionVenueRow(venueName?: string, mapsUrl?: string) {
  return {
    label: '세션 장소',
    valueHtml: venueInfoValueHtml(venueName || VENUE_MISSING_PLACEHOLDER, mapsUrl),
  };
}

function infoCard(rows: Array<{ label: string; value?: string; valueHtml?: string; accent?: string }>) {
  const items = rows.map((row, index) => `
    <tr>
      <td style="padding:14px 16px;${index < rows.length - 1 ? `border-bottom:1px solid ${C.border};` : ''}">
        <div style="font-family:${FONT_STACK};font-size:13px;font-weight:800;line-height:1.4;color:${C.title};margin-bottom:6px;letter-spacing:-0.02em;"><strong style="font-weight:800;color:${C.title};">${escapeHtml(row.label)}</strong></div>
        ${row.valueHtml
          ? `<div style="line-height:1.5;">${row.valueHtml}</div>`
          : `<div style="font-family:${FONT_STACK};font-size:16px;font-weight:700;line-height:1.5;color:${row.accent || C.title};letter-spacing:-0.03em;">${escapeHtml(row.value || '')}</div>`
        }
      </td>
    </tr>`).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${C.cardBg};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
      ${items}
    </table>`;
}

function checkInActionCard(href: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${C.primarySoft};border:1px solid ${C.primary};border-radius:20px;">
      <tr>
        <td style="padding:16px 16px 18px;">
          ${primaryButton(href, '바로 출석체크하기')}
        </td>
      </tr>
    </table>`;
}

function emailShell(params: {
  headline: string;
  salutation: string;
  body: string;
  logoUrl?: string;
}) {
  const logoUrl = params.logoUrl || emailLogoUrl();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.headline)}</title>
  ${emailFontHead()}
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${C.cardBg};border-radius:24px;overflow:hidden;border:1px solid ${C.border};">
          <tr>
            <td style="padding:28px 28px 0;">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(APP_NAME)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;max-width:100%;border:0;outline:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0;">
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:24px;font-weight:800;line-height:1.35;color:${C.title};letter-spacing:-0.04em;">${escapeHtml(params.headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;">
              ${bodyText(`<span style="font-weight:700;color:${C.title};">${escapeHtml(params.salutation)}</span>님,`)}
              ${params.body}
              <p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${C.caption};letter-spacing:-0.01em;">— ${escapeHtml(APP_NAME)} Attendance</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin-top:16px;">
          <tr>
            <td style="padding:0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${C.caption};text-align:center;letter-spacing:-0.01em;">
              © ${new Date().getFullYear()} ${escapeHtml(APP_NAME)} · 하이스파크 학회 출결 시스템
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSessionReminderHtml(data: EmailTemplateData, daysBefore: 5 | 1) {
  const absenceLink = data.absenceLink || memberPortalUrl("absence");
  const headline = daysBefore === 5 ? '다가오는 세션 안내' : '내일 세션이 있어요';
  const leadText = daysBefore === 5
    ? `<strong style="color:${C.title};">${escapeHtml(data.sessionDateTime)}</strong> 세션이 5일 뒤 예정되어 있어요.`
    : `<strong style="color:${C.title};">${escapeHtml(data.sessionDateTime)}</strong> 세션이 내일이에요.`;

  return emailShell({
    headline,
    salutation: data.memberName,
    body: [
      bodyText(leadText),
      bodyText('아래 일정과 장소를 확인해 주세요.'),
      infoCard([
        { label: '세션', value: data.sessionTitle },
        { label: '일시', value: data.sessionDateTime },
        sessionVenueRow(data.venueName, data.venueMapsUrl),
        { label: '출석 오픈', value: `세션 시작 ${data.checkInOpenMinutes ?? 15}분 전` },
      ]),
      bodyText('이번 주에 결석 예정이신 분들은 아래 출결 사이트에 접속하셔서 미리 등록 부탁드립니다.'),
      primaryButton(absenceLink, '미리 결석 신청하기'),
    ].filter(Boolean).join(''),
  });
}

export function buildEmailSubject(kind: EmailTemplateKind, data: EmailTemplateData) {
  switch (kind) {
    case 'session_reminder_5d':
      return `[${APP_NAME}] 5일 후 세션 안내 — ${data.sessionTitle}`;
    case 'session_reminder_1d':
      return `[${APP_NAME}] 내일 세션 안내 — ${data.sessionTitle}`;
    case 'session_open':
      return `[${APP_NAME}] 지금 출석체크 — ${data.sessionTitle}`;
    case 'checkin_complete':
      return `[${APP_NAME}] 출석 완료 — ${data.sessionTitle}`;
  }
}

export function buildEmailHtml(kind: EmailTemplateKind, data: EmailTemplateData) {
  const checkInLink = data.checkInLink || memberPortalUrl("checkin");

  switch (kind) {
    case 'session_reminder_5d':
      return buildSessionReminderHtml(data, 5);
    case 'session_reminder_1d':
      return buildSessionReminderHtml(data, 1);

    case 'session_open':
      return emailShell({
        headline: '지금 출석할 수 있어요',
        salutation: data.memberName,
        body: [
          bodyText(`<strong style="color:${C.title};">${escapeHtml(data.sessionTitle)}</strong> 출석이 시작됐어요. 강의실 화면의 코드를 입력해 주세요.`),
          checkInActionCard(checkInLink),
          infoCard([
            { label: '일시', value: data.sessionDateTime },
            sessionVenueRow(data.venueName, data.venueMapsUrl),
          ]),
        ].filter(Boolean).join(''),
      });

    case 'checkin_complete': {
      const status = data.attendanceStatus || 'present';
      const statusLabel = ATTENDANCE_STATUS_LABELS[status];
      const statusColor = status === 'present' ? C.primary : status === 'late' ? C.primaryDark : C.caption;
      return emailShell({
        headline: '출석이 완료됐어요',
        salutation: data.memberName,
        body: [
          bodyText(`<strong style="color:${C.title};">${escapeHtml(data.sessionTitle)}</strong> 체크인이 기록됐어요.`),
          infoCard([
            { label: '세션', value: data.sessionTitle },
            { label: '체크인 시간', value: data.checkedInAt || '—' },
            { label: '결과', value: statusLabel, accent: statusColor },
          ]),
        ].join(''),
      });
    }
  }
}

export function formatSessionDateTime(startAt: string) {
  return new Date(startAt).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCheckInDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildEmailFromSession(
  kind: EmailTemplateKind,
  profile: { full_name: string },
  session: {
    title: string;
    start_at: string;
    venue_name?: string | null;
    venue_map_url?: string | null;
    venue_lat?: number | null;
    venue_lng?: number | null;
    attendance_code?: string | null;
    check_in_open_minutes?: number;
  },
  extra?: { checkedInAt?: string; attendanceStatus?: AttendanceStatusLabel },
) {
  const memberBase = memberSiteUrl();
  const showsVenue = kind !== 'checkin_complete';
  const data: EmailTemplateData = {
    memberName: profile.full_name,
    sessionTitle: session.title,
    sessionDateTime: formatSessionDateTime(session.start_at),
    memberLink: memberBase,
    absenceLink: memberPortalUrl("absence"),
    checkInLink: memberPortalUrl("checkin"),
    venueName: showsVenue ? resolveVenueDisplayName(session.venue_name) : undefined,
    venueMapsUrl: showsVenue ? resolveVenueMapsUrl(session) : undefined,
    attendanceCode: session.attendance_code || undefined,
    checkInOpenMinutes: session.check_in_open_minutes,
    checkedInAt: extra?.checkedInAt ? formatCheckInDateTime(extra.checkedInAt) : undefined,
    attendanceStatus: extra?.attendanceStatus,
  };

  return {
    subject: buildEmailSubject(kind, data),
    html: buildEmailHtml(kind, data),
  };
}

/** Strip `[HySpark]` prefix from subject for use as the email card headline. */
export function manualEmailHeadline(subject: string) {
  const stripped = subject.replace(/^\[HySpark\]\s*/i, '').trim();
  return stripped || subject;
}

function plainTextToBodyHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => bodyText(escapeHtml(para).replace(/\n/g, '<br />')))
    .join('');
}

/** Wrap free-form manual notice content in the standard HySpark email shell. */
export function buildManualEmailHtml(params: {
  memberName: string;
  headline: string;
  bodyText: string;
}) {
  return emailShell({
    headline: params.headline,
    salutation: params.memberName,
    body: plainTextToBodyHtml(params.bodyText),
  });
}

export function triggerToTemplateKind(trigger: string, offsetMinutes?: number): EmailTemplateKind | null {
  if (trigger === 'session_before') {
    if (offsetMinutes === -7200) return 'session_reminder_5d';
    return 'session_reminder_1d';
  }
  if (trigger === 'session_open') return 'session_open';
  if (trigger === 'checkin_complete') return 'checkin_complete';
  return null;
}
