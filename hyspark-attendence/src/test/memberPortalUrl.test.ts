import { describe, expect, it } from 'vitest';
import { memberPortalUrl } from '@/lib/brand';

describe('memberPortalUrl', () => {
  it('builds intent-only links without token', () => {
    expect(memberPortalUrl('checkin')).toBe('https://hysparkpre-member.web.app/#/?intent=checkin');
    expect(memberPortalUrl()).toBe('https://hysparkpre-member.web.app/#/');
  });

  it('appends m= token when provided', () => {
    const url = memberPortalUrl('camp-survey', { token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    expect(url).toContain('intent=camp-survey');
    expect(url).toContain('m=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
