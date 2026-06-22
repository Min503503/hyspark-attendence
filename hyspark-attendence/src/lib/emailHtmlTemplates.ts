import { APP_NAME, PUBLIC_URLS, memberPortalUrl } from '@/lib/brand';
import {
  VENUE_MISSING_PLACEHOLDER,
  isVenueMissing,
  resolveVenueDisplayName,
  resolveVenueMapsUrl,
} from '@/lib/sessionVenue';

export type EmailTemplateKind =
  | 'session_reminder_5d'
  | 'session_reminder_1d'
  | 'session_open'
  | 'checkin_complete'
  | 'camp_daily_survey_reminder';

export type AttendanceStatusLabel = 'present' | 'late' | 'unexcused_absent';

export interface EmailTemplateData {
  memberName: string;
  sessionTitle: string;
  sessionDateTime: string;
  memberLink?: string;
  absenceLink?: string;
  checkInLink?: string;
  campSurveyLink?: string;
  campTitle?: string;
  campDateRange?: string;
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
  camp_daily_survey_reminder: '캠프 일일 설문',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusLabel, string> = {
  present: '출석',
  late: '지각',
  unexcused_absent: '결석',
};

/** Logo PNG 448×146 — width만 지정, height는 auto (비율 유지) */
const LOGO_NATURAL_WIDTH = 448;
const LOGO_NATURAL_HEIGHT = 146;
const LOGO_DISPLAY_WIDTH = 154;
const LOGO_DISPLAY_HEIGHT = Math.round((LOGO_DISPLAY_WIDTH * LOGO_NATURAL_HEIGHT) / LOGO_NATURAL_WIDTH);

function brandLogoImg(logoUrl: string) {
  return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(APP_NAME)}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" border="0" style="display:block;width:${LOGO_DISPLAY_WIDTH}px;max-width:100%;height:auto;border:0;outline:none;line-height:100%;-ms-interpolation-mode:bicubic;" />`;
}

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
  pageBg: '#F4F4F4',
  cardBg: '#FFFFFF',
  title: '#000000',
  body: '#555555',
  caption: '#888888',
  primary: '#3182F6',
  primaryDark: '#1B64DA',
  primarySoft: '#E8F3FF',
  border: '#E0E0E0',
  tableLabelBg: '#F5F5F5',
  footerBg: '#EEEEEE',
  tableFrame: '#000000',
};

export const SAMPLE_EMAIL_DATA: Record<EmailTemplateKind, EmailTemplateData> = {
  session_reminder_5d: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: PUBLIC_URLS.member,
    absenceLink: memberPortalUrl('absence'),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  session_reminder_1d: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: PUBLIC_URLS.member,
    absenceLink: memberPortalUrl('absence'),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  session_open: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: PUBLIC_URLS.member,
    checkInLink: memberPortalUrl('checkin'),
    venueName: '서울 강남구 테헤란로 123, HySpark 세미나실 3층',
    venueMapsUrl: 'https://map.naver.com/p/search/테헤란로%20123',
    checkInOpenMinutes: 15,
  },
  checkin_complete: {
    memberName: '홍길동',
    sessionTitle: 'HySpark 5기 정기 세션 #12',
    sessionDateTime: '2026년 6월 17일 (화) 15:00',
    memberLink: PUBLIC_URLS.member,
    checkedInAt: '2026년 6월 17일 (화) 15:03',
    attendanceStatus: 'present',
  },
  camp_daily_survey_reminder: {
    memberName: '홍길동',
    sessionTitle: '미니 스타트업 캠프',
    sessionDateTime: '2026년 6월 22일 (월)',
    memberLink: PUBLIC_URLS.member,
    campSurveyLink: memberPortalUrl('camp-survey'),
    campTitle: '미니 스타트업 캠프',
    campDateRange: '2026-06-22 ~ 2026-06-26',
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
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${C.body};font-weight:400;letter-spacing:-0.01em;">${html}</p>`;
}

function subtitleLine(text: string) {
  return `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:17px;font-weight:700;line-height:1.45;color:${C.primaryDark};letter-spacing:-0.02em;">${escapeHtml(text)}</p>`;
}

function bulletList(items: string[]) {
  return items.map(item =>
    `<p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:14px;line-height:1.55;color:${C.caption};letter-spacing:-0.01em;">· ${escapeHtml(item)}</p>`,
  ).join('');
}

function primaryButton(href: string, label: string) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0;border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${C.primaryDark}" style="border-radius:4px;background-color:${C.primaryDark};padding:0;">
          <a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="email-btn" style="display:block;width:100%;min-height:52px;box-sizing:border-box;padding:16px 24px;font-family:${FONT_STACK};font-size:16px;font-weight:700;line-height:1.45;color:#ffffff;background-color:${C.primaryDark};text-decoration:none;text-align:center;border-radius:4px;letter-spacing:-0.02em;-webkit-text-size-adjust:none;word-break:keep-all;mso-line-height-rule:exactly;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

function fallbackLink(href: string) {
  const safeHref = escapeHtml(href);
  return `<p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${C.caption};text-align:center;letter-spacing:-0.01em;">버튼이 보이지 않으면 아래 주소로 접속해 주세요.<br/><a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:${C.primary};text-decoration:underline;word-break:break-all;">${safeHref}</a></p>`;
}

function ctaBlock(href: string, label: string) {
  return `${primaryButton(href, label)}${fallbackLink(href)}`;
}

function textLink(href: string, label: string) {
  return `<p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${C.body};"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="font-family:${FONT_STACK};font-size:15px;font-weight:700;line-height:1.4;color:${C.primary};text-decoration:underline;text-underline-offset:3px;letter-spacing:-0.02em;">${escapeHtml(label)}</a></p>`;
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

function infoTable(rows: Array<{ label: string; value?: string; valueHtml?: string; accent?: string }>) {
  const bodyRows = rows.map((row, index) => `
    <tr>
      <td width="32%" valign="middle" style="padding:14px 16px;background:${C.tableLabelBg};border-bottom:${index < rows.length - 1 ? `1px solid ${C.border}` : 'none'};font-family:${FONT_STACK};font-size:14px;font-weight:700;line-height:1.4;color:${C.caption};letter-spacing:-0.01em;">
        ${escapeHtml(row.label)}
      </td>
      <td valign="middle" style="padding:14px 16px;background:${C.cardBg};border-bottom:${index < rows.length - 1 ? `1px solid ${C.border}` : 'none'};">
        ${row.valueHtml
          ? `<div style="line-height:1.5;">${row.valueHtml}</div>`
          : `<div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;line-height:1.5;color:${row.accent || C.title};letter-spacing:-0.02em;">${escapeHtml(row.value || '')}</div>`
        }
      </td>
    </tr>`).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;border-top:3px solid ${C.tableFrame};border-bottom:3px solid ${C.tableFrame};">
      ${bodyRows}
    </table>`;
}

/** @deprecated alias — use infoTable */
function infoCard(rows: Array<{ label: string; value?: string; valueHtml?: string; accent?: string }>) {
  return infoTable(rows);
}

function emailShell(params: {
  headline: string;
  subtitle?: string;
  salutation: string;
  body: string;
  logoUrl?: string;
}) {
  const logoUrl = params.logoUrl || PUBLIC_URLS.emailLogo;
  const subtitle = params.subtitle || `${params.salutation}님께 드리는 안내`;

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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${C.cardBg};border-collapse:collapse;">
          <tr>
            <td style="padding:40px 40px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="padding:0 0 20px;vertical-align:top;">
                    ${brandLogoImg(logoUrl)}
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;font-weight:800;line-height:1.35;color:${C.title};letter-spacing:-0.03em;">${escapeHtml(params.headline)}</h1>
              ${subtitleLine(subtitle)}
              <div style="margin-top:28px;">
                ${params.body}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 24px;background:${C.footerBg};font-family:${FONT_STACK};font-size:12px;line-height:1.65;color:${C.caption};text-align:center;letter-spacing:-0.01em;">
              본 메일은 발신 전용입니다.<br />
              ${escapeHtml(APP_NAME)} Attendance · 하이스파크 학회 출결 시스템<br />
              © ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}
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
  const absenceLink = data.absenceLink || memberPortalUrl('absence');
  const headline = daysBefore === 5 ? '다가오는 세션 안내' : '내일 세션이 있어요';
  const subtitle = `${data.memberName}님의 세션 안내`;
  const leadText = daysBefore === 5
    ? `안녕하세요 ${escapeHtml(data.memberName)}님, <strong style="color:${C.title};">${escapeHtml(data.sessionDateTime)}</strong> 세션이 5일 뒤 예정되어 있어요.`
    : `안녕하세요 ${escapeHtml(data.memberName)}님, <strong style="color:${C.title};">${escapeHtml(data.sessionDateTime)}</strong> 세션이 내일이에요.`;

  return emailShell({
    headline,
    subtitle,
    salutation: data.memberName,
    body: [
      bodyText(leadText),
      bodyText('아래 일정과 장소를 확인해 주세요.'),
      infoTable([
        { label: '세션', value: data.sessionTitle },
        { label: '일시', value: data.sessionDateTime },
        sessionVenueRow(data.venueName, data.venueMapsUrl),
        { label: '출석 오픈', value: `세션 시작 ${data.checkInOpenMinutes ?? 15}분 전` },
      ]),
      bodyText('이번 주에 결석 예정이신 분들은 출결 사이트에서 미리 등록해 주세요.'),
      bulletList([
        '결석 신청은 세션 시작 전까지 가능합니다.',
        '당일 불참 시에도 반드시 사전에 등록해 주세요.',
      ]),
      textLink(absenceLink, '미리 결석 신청하기'),
      fallbackLink(absenceLink),
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
    case 'camp_daily_survey_reminder':
      return `[${APP_NAME}] 오늘 캠프 참여 시간 입력 — ${data.campTitle || data.sessionTitle}`;
  }
}

export function buildEmailHtml(kind: EmailTemplateKind, data: EmailTemplateData) {
  const checkInLink = data.checkInLink || memberPortalUrl('checkin');

  switch (kind) {
    case 'session_reminder_5d':
      return buildSessionReminderHtml(data, 5);
    case 'session_reminder_1d':
      return buildSessionReminderHtml(data, 1);

    case 'session_open':
      return emailShell({
        headline: '지금 출석할 수 있어요',
        subtitle: `${data.memberName}님의 출석 안내`,
        salutation: data.memberName,
        body: [
          bodyText(`안녕하세요 ${escapeHtml(data.memberName)}님, <strong style="color:${C.title};">${escapeHtml(data.sessionTitle)}</strong> 출석이 시작됐어요. 강의실 화면의 코드를 입력해 주세요.`),
          infoTable([
            { label: '세션', value: data.sessionTitle },
            { label: '일시', value: data.sessionDateTime },
            sessionVenueRow(data.venueName, data.venueMapsUrl),
          ]),
          ctaBlock(checkInLink, '바로 출석체크하기'),
        ].filter(Boolean).join(''),
      });

    case 'checkin_complete': {
      const status = data.attendanceStatus || 'present';
      const statusLabel = ATTENDANCE_STATUS_LABELS[status];
      const statusColor = status === 'present' ? C.primary : status === 'late' ? C.primaryDark : C.caption;
      return emailShell({
        headline: '출석이 완료됐어요',
        subtitle: `${data.memberName}님의 출석 결과`,
        salutation: data.memberName,
        body: [
          bodyText(`안녕하세요 ${escapeHtml(data.memberName)}님, <strong style="color:${C.title};">${escapeHtml(data.sessionTitle)}</strong> 체크인이 기록됐어요.`),
          infoTable([
            { label: '세션', value: data.sessionTitle },
            { label: '체크인 시간', value: data.checkedInAt || '—' },
            { label: '결과', value: statusLabel, accent: statusColor },
          ]),
        ].join(''),
      });
    }

    case 'camp_daily_survey_reminder': {
      const surveyLink = data.campSurveyLink || memberPortalUrl('camp-survey');
      return emailShell({
        headline: '오늘 캠프 참여 시간을 입력해 주세요',
        subtitle: `${data.memberName}님의 캠프 설문`,
        salutation: data.memberName,
        body: [
          bodyText(`안녕하세요 ${escapeHtml(data.memberName)}님, <strong style="color:${C.title};">${escapeHtml(data.campTitle || data.sessionTitle)}</strong> 오늘 참여하신 시간을 알려주세요.`),
          infoTable([
            { label: '캠프', value: data.campTitle || data.sessionTitle },
            { label: '기간', value: data.campDateRange || '—' },
            { label: '오늘', value: data.sessionDateTime },
          ]),
          bodyText('몇 시부터 몇 시까지 참여하셨는지 입력해 주세요. 참여 시간 5시간마다 벌점 0.25점이 상쇄됩니다.'),
          bulletList([
            '30분 단위로 드래그해 선택할 수 있습니다.',
            '끊어진 시간(예: 12–1시, 2–5시)도 함께 입력 가능합니다.',
          ]),
          ctaBlock(surveyLink, '참여 시간 입력하기'),
        ].join(''),
      });
    }
  }
}

export function buildCampSurveyReminderEmail(params: {
  memberName: string;
  campTitle: string;
  campDateRange: string;
  todayLabel: string;
  campSurveyLink?: string;
}) {
  const data: EmailTemplateData = {
    memberName: params.memberName,
    sessionTitle: params.campTitle,
    sessionDateTime: params.todayLabel,
    memberLink: PUBLIC_URLS.member,
    campSurveyLink: params.campSurveyLink || memberPortalUrl('camp-survey'),
    campTitle: params.campTitle,
    campDateRange: params.campDateRange,
  };
  return {
    subject: buildEmailSubject('camp_daily_survey_reminder', data),
    html: buildEmailHtml('camp_daily_survey_reminder', data),
  };
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

export { resolveVenueDisplayName, resolveVenueMapsUrl, VENUE_MISSING_PLACEHOLDER } from '@/lib/sessionVenue';

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
  extra?: {
    checkedInAt?: string;
    attendanceStatus?: AttendanceStatusLabel;
    absenceLink?: string;
    checkInLink?: string;
  },
) {
  const memberBase = PUBLIC_URLS.member;
  const showsVenue = kind !== 'checkin_complete';
  const data: EmailTemplateData = {
    memberName: profile.full_name,
    sessionTitle: session.title,
    sessionDateTime: formatSessionDateTime(session.start_at),
    memberLink: memberBase,
    absenceLink: extra?.absenceLink || memberPortalUrl('absence'),
    checkInLink: extra?.checkInLink || memberPortalUrl('checkin'),
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
    subtitle: `${params.memberName}님께 드리는 안내`,
    salutation: params.memberName,
    body: [
      bodyText(`안녕하세요 ${escapeHtml(params.memberName)}님,`),
      plainTextToBodyHtml(params.bodyText),
    ].join(''),
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
