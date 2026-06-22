import { adminApi } from '@/lib/adminApi';
import { memberPortalUrl, type MemberPortalIntent } from '@/lib/brand';

export async function ensureMemberPortalToken(profileId: string): Promise<string> {
  const { data, error } = await adminApi<{ token?: string }>('ensure_member_portal_token', {
    profileId,
  });
  if (error || !data?.token) {
    throw new Error(error?.message || '포털 토큰을 만들지 못했습니다.');
  }
  return data.token;
}

export async function memberPortalUrlForProfile(
  intent: MemberPortalIntent,
  profileId: string,
): Promise<string> {
  const token = await ensureMemberPortalToken(profileId);
  return memberPortalUrl(intent, { token });
}
