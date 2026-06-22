export const APP_NAME = 'HySpark';
export const APP_TAGLINE = '하이스파크 학회 출결 관리';
export const APP_DESCRIPTION =
  'HySpark는 하이스파크 학회원의 출석 확인과 운영진의 세션·멤버·메일 관리를 위한 내부 웹 서비스입니다.';

export const PUBLIC_URLS = {
  member: 'https://hysparkpre-member.web.app',
  about: 'https://hysparkpre-member.web.app/about.html',
  privacy: 'https://hysparkpre-member.web.app/privacy.html',
  /** Supabase Storage — 메일 헤더 스파크 아이콘 (텍스트 없음) */
  emailLogo:
    'https://lwbjprzrnmlnmzlxiwrv.supabase.co/storage/v1/object/public/brand-assets/hyspark-email-logo.png',
} as const;

export type MemberPortalIntent = 'absence' | 'checkin' | 'camp-survey';

/** Member portal entry — always lands on Index (not /member). Optional `m` token skips name login. */
export function memberPortalUrl(
  intent?: MemberPortalIntent,
  options?: { token?: string },
) {
  const params = new URLSearchParams();
  if (intent) params.set('intent', intent);
  if (options?.token) params.set('m', options.token);
  const query = params.toString();
  if (!query) return `${PUBLIC_URLS.member}/#/`;
  return `${PUBLIC_URLS.member}/#/?${query}`;
}
