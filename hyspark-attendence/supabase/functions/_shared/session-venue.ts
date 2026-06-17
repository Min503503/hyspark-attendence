export const VENUE_MISSING_PLACEHOLDER =
  "장소 미등록 — 관리자 콘솔 세션 설정에서 장소를 추가해 주세요";

export function resolveVenueDisplayName(venueName?: string | null): string {
  const trimmed = venueName?.trim();
  return trimmed || VENUE_MISSING_PLACEHOLDER;
}

export function resolveVenueMapsUrl(session: {
  venue_map_url?: string | null;
  venue_name?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
}): string | undefined {
  if (session.venue_map_url?.trim()) return session.venue_map_url.trim();
  if (session.venue_lat != null && session.venue_lng != null) {
    return `https://map.naver.com/v5/search/${session.venue_lat},${session.venue_lng}`;
  }
  if (session.venue_name?.trim()) {
    return `https://map.naver.com/p/search/${encodeURIComponent(session.venue_name.trim())}`;
  }
  return undefined;
}

export function isVenueMissing(venueName: string) {
  return venueName === VENUE_MISSING_PLACEHOLDER;
}
