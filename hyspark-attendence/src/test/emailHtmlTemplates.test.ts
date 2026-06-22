import { describe, expect, it } from 'vitest';
import {
  SAMPLE_EMAIL_DATA,
  buildCampSurveyReminderEmail,
  buildEmailFromSession,
  buildEmailHtml,
  buildEmailSubject,
  buildManualEmailHtml,
  manualEmailHeadline,
  resolveVenueMapsUrl,
} from '@/lib/emailHtmlTemplates';
import { PUBLIC_URLS, memberPortalUrl } from '@/lib/brand';

const MEMBER_HOME = memberPortalUrl('absence');

describe('emailHtmlTemplates', () => {
  it('loads Pretendard webfont for Toss-style typography', () => {
    const html = buildEmailHtml('session_reminder_5d', SAMPLE_EMAIL_DATA.session_reminder_5d);
    expect(html).toContain("@font-face");
    expect(html).toContain('Pretendard-Regular.woff2');
    expect(html).toContain('font-family:Pretendard');
  });

  it('uses a reachable logo URL', () => {
    const html = buildEmailHtml('session_reminder_5d', SAMPLE_EMAIL_DATA.session_reminder_5d);
    expect(html).toContain(PUBLIC_URLS.emailLogo);
    expect(html).toContain('supabase.co/storage/v1/object/public/brand-assets/hyspark-logo.png');
    expect(html).not.toContain('hyspark-attendance-admin.web.app/hyspark-logo.png');
    expect(html).not.toContain('hyspark-attendance-member.web.app/hyspark-logo.png');
  });

  it('5일 전 리마인드: 장소·지도·결석 신청 버튼 포함', () => {
    const html = buildEmailHtml('session_reminder_5d', SAMPLE_EMAIL_DATA.session_reminder_5d);
    expect(html).toContain('미리 결석 신청하기');
    expect(html).toContain('class="email-btn"');
    expect(html).toMatch(/일시[\s\S]*안녕하세요/);
    expect(html).toContain('네이버 지도에서 보기');
    expect(html).toContain('세션 장소');
    expect(html).toMatch(/일시[\s\S]*세션 장소[\s\S]*출석 오픈/);
    expect(html).toContain('font-weight:700');
    expect(html).toContain('border-top:3px solid');
    expect(html).toContain(SAMPLE_EMAIL_DATA.session_reminder_5d.absenceLink!);
    expect(html).toContain(SAMPLE_EMAIL_DATA.session_reminder_5d.venueMapsUrl!);
    expect(html).toContain(SAMPLE_EMAIL_DATA.session_reminder_5d.venueName!);
    expect(html).toContain('target="_blank"');
  });

  it('5일 전 리마인드: venue_name 없어도 세션 장소 카드는 항상 표시', () => {
    const { html } = buildEmailFromSession(
      'session_reminder_5d',
      { full_name: '테스트' },
      {
        title: '6/27 13주차',
        start_at: '2026-06-27T15:00:00+09:00',
        check_in_open_minutes: 15,
      },
    );
    expect(html).toContain('세션 장소');
    expect(html).toContain('장소 미등록');
    expect(html).toContain('6/27 13주차');
  });

  it('1일 전 리마인드: 결석 신청 링크가 멤버 초기 화면으로 연결', () => {
    const html = buildEmailHtml('session_reminder_1d', SAMPLE_EMAIL_DATA.session_reminder_1d);
    expect(html).toContain('미리 결석 신청하기');
    expect(html).toContain('intent=absence');
    expect(html).not.toContain('/#/member');
  });

  it('개인화 링크: m= 토큰이 absence/checkin CTA에 포함', () => {
    const token = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const absenceLink = memberPortalUrl('absence', { token });
    const checkInLink = memberPortalUrl('checkin', { token });
    const { html } = buildEmailFromSession(
      'session_reminder_1d',
      { full_name: '테스트' },
      {
        title: '6/27 13주차',
        start_at: '2026-06-27T15:00:00+09:00',
        check_in_open_minutes: 15,
      },
      { absenceLink, checkInLink },
    );
    expect(absenceLink).toContain(`m=${token}`);
    expect(html).toContain(`m=${token}`);
    expect(html).toContain('intent=absence');
  });

  it('캠프 설문 개인화 링크: campSurveyLink에 m= 포함', () => {
    const token = '11111111-2222-3333-4444-555555555555';
    const campSurveyLink = memberPortalUrl('camp-survey', { token });
    const { html } = buildCampSurveyReminderEmail({
      memberName: '테스트',
      campTitle: '미니 스타트업 캠프',
      campDateRange: '6/22 ~ 6/26',
      todayLabel: '2026년 6월 20일 (토)',
      campSurveyLink,
    });
    expect(campSurveyLink).toContain(`m=${token}`);
    expect(html).toContain(`m=${token}`);
    expect(html).toContain('intent=camp-survey');
  });

  it('출석 오픈: 출석 코드 미노출 + 체크인 버튼', () => {
    const html = buildEmailHtml('session_open', {
      ...SAMPLE_EMAIL_DATA.session_open,
      attendanceCode: '99999',
    });
    expect(html).toContain('바로 출석체크하기');
    expect(html).toContain('intent=checkin');
    expect(html).not.toContain('/#/member');
    expect(html).not.toContain('99999');
    expect(html).not.toMatch(/출석\s*코드[^<]*\d{4,}/);
  });

  it('CTA 버튼: 모바일 터치 영역 확보', () => {
    const html = buildEmailHtml('session_open', SAMPLE_EMAIL_DATA.session_open);
    expect(html).toContain('min-height:52px');
    expect(html).toContain('class="email-btn"');
    expect(html).not.toContain('<span style="color:#ffffff;">바로 출석체크하기</span>');
  });

  it('체크인 완료: 시간·결과 표시', () => {
    const html = buildEmailHtml('checkin_complete', SAMPLE_EMAIL_DATA.checkin_complete);
    expect(html).toContain('출석이 완료됐어요');
    expect(html).toContain('2026년 6월 17일 (화) 15:03');
    expect(html).toContain('출석');
  });

  it('buildEmailFromSession: venue_map_url 우선', () => {
    const customMap = 'https://map.naver.com/p/entry/place/123';
    const { html } = buildEmailFromSession(
      'session_reminder_1d',
      { full_name: '테스트' },
      {
        title: '테스트 세션',
        start_at: '2026-06-17T10:00:00+09:00',
        venue_name: '강남 세미나실',
        venue_map_url: customMap,
        check_in_open_minutes: 15,
      },
    );
    expect(html).toContain(customMap);
    expect(html).toContain('강남 세미나실');
    expect(html).toContain(MEMBER_HOME);
  });

  it('resolveVenueMapsUrl: lat/lng fallback', () => {
    expect(resolveVenueMapsUrl({ venue_map_url: '  https://map.example  ' })).toBe('https://map.example');
    expect(resolveVenueMapsUrl({ venue_lat: 37.5, venue_lng: 127.0 })).toContain('37.5');
  });

  it('subjects are generated per kind', () => {
    expect(buildEmailSubject('session_open', SAMPLE_EMAIL_DATA.session_open)).toContain('출석체크');
    expect(buildEmailSubject('checkin_complete', SAMPLE_EMAIL_DATA.checkin_complete)).toContain('출석 완료');
  });

  it('캠프 일일 설문: 참여 시간 입력 링크', () => {
    const html = buildEmailHtml('camp_daily_survey_reminder', SAMPLE_EMAIL_DATA.camp_daily_survey_reminder);
    expect(html).toContain('참여 시간 입력하기');
    expect(html).toContain('intent=camp-survey');
    expect(html).not.toContain('/#/member');
    expect(buildEmailSubject('camp_daily_survey_reminder', SAMPLE_EMAIL_DATA.camp_daily_survey_reminder)).toContain('캠프');
  });

  it('manual email: wraps plain text in the standard shell', () => {
    const html = buildManualEmailHtml({
      memberName: '이희준',
      headline: manualEmailHeadline('[HySpark] 공지'),
      bodyText: '학회 일정이 변경되었습니다.\n\n자세한 내용은 카톡을 확인해 주세요.',
    });
    expect(html).toContain('공지');
    expect(html).toContain('이희준');
    expect(html).toContain('학회 일정이 변경되었습니다.');
    expect(html).toContain('자세한 내용은 카톡을 확인해 주세요.');
    expect(html).toContain(PUBLIC_URLS.emailLogo);
    expect(html).toContain('발신 전용');
    expect(html).toContain('하이스파크 학회 출결 시스템');
  });
});
