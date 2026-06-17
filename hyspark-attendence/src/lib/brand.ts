export const APP_NAME = 'HySpark';
export const APP_TAGLINE = '하이스파크 학회 출결 관리';
export const APP_DESCRIPTION =
  'HySpark는 하이스파크 학회원의 출석 확인과 운영진의 세션·멤버·메일 관리를 위한 내부 웹 서비스입니다.';

export const PUBLIC_URLS = {
  member: 'https://hyspark-attendance-member.web.app',
  about: 'https://hyspark-attendance-member.web.app/about.html',
  privacy: 'https://hyspark-attendance-member.web.app/privacy.html',
  /** Hosted on admin site — member SPA rewrite can block /hyspark-logo.png on stale deploys */
  emailLogo: 'https://hyspark-attendance-admin.web.app/hyspark-logo.png',
} as const;

/** Member portal entry — always lands on name-login screen (Index), not /member */
export function memberPortalUrl(intent?: 'absence' | 'checkin') {
  if (!intent) return `${PUBLIC_URLS.member}/#/`;
  return `${PUBLIC_URLS.member}/#/?intent=${intent}`;
}
