/** Deno mirror of src/lib/brand.ts memberPortalUrl */

export type MemberPortalIntent = "absence" | "checkin" | "camp-survey";

export function memberSiteUrl() {
  return Deno.env.get("MEMBER_SITE_URL") || "https://hysparkpre-member.web.app";
}

export function memberPortalUrl(
  intent?: MemberPortalIntent,
  options?: { token?: string },
) {
  const base = memberSiteUrl();
  const params = new URLSearchParams();
  if (intent) params.set("intent", intent);
  if (options?.token) params.set("m", options.token);
  const query = params.toString();
  if (!query) return `${base}/#/`;
  return `${base}/#/?${query}`;
}

export async function getMemberPortalToken(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  profileId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_member_portal_token", {
    p_profile_id: profileId,
  });
  if (error || !data) {
    throw new Error(error?.message || "failed to create portal token");
  }
  return String(data);
}
