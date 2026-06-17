import type { Profile, Session } from '@/types';

export type NetworkingAudience = 'member' | 'staff';
export type NetworkingStatus = 'attending' | 'not_attending' | 'maybe';

export interface NetworkingResponse {
  member_id: string;
  member_name: string;
  status: NetworkingStatus;
  updated_at: string;
}

export interface NetworkingState {
  enabled: boolean;
  staff_enabled: boolean;
  question: string;
  updated_at?: string;
  responses: Record<string, NetworkingResponse>;
  staff_responses: Record<string, NetworkingResponse>;
}

interface SessionNotesEnvelope {
  __hyspark_networking_v1__?: true;
  text?: string;
  networking?: Partial<NetworkingState>;
}

export const NETWORKING_DEFAULT_QUESTION = '네트워킹 세션 참여 조사';

export const networkingStatusLabel: Record<NetworkingStatus, string> = {
  attending: '참여',
  not_attending: '불참',
  maybe: '미정',
};

export function emptyNetworkingState(): NetworkingState {
  return {
    enabled: false,
    staff_enabled: false,
    question: NETWORKING_DEFAULT_QUESTION,
    responses: {},
    staff_responses: {},
  };
}

export function parseSessionNotes(notes?: string | null): { text: string; networking: NetworkingState } {
  if (!notes) return { text: '', networking: emptyNetworkingState() };

  try {
    const parsed = JSON.parse(notes) as SessionNotesEnvelope;
    if (parsed && parsed.__hyspark_networking_v1__) {
      return {
        text: parsed.text || '',
        networking: {
          ...emptyNetworkingState(),
          ...parsed.networking,
          responses: parsed.networking?.responses || {},
          staff_responses: parsed.networking?.staff_responses || {},
        },
      };
    }
  } catch {
    // Plain operator note from older sessions.
  }

  return { text: notes, networking: emptyNetworkingState() };
}

export function serializeSessionNotes(text: string, networking: NetworkingState): string {
  const hasNetworkingData = (
    networking.enabled ||
    networking.staff_enabled ||
    Object.keys(networking.responses).length > 0 ||
    Object.keys(networking.staff_responses).length > 0
  );
  if (!hasNetworkingData) return text;

  return JSON.stringify({
    __hyspark_networking_v1__: true,
    text,
    networking,
  });
}

export function mergeSessionNoteText(previousNotes: string | undefined, nextText: string): string {
  const parsed = parseSessionNotes(previousNotes);
  return serializeSessionNotes(nextText, parsed.networking);
}

function fnv1a(input: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function createNetworkingToken(sessionId: string, profileId: string, audience: NetworkingAudience = 'member') {
  return fnv1a(`hyspark-networking-v1:${audience}:${sessionId}:${profileId}`);
}

export function isValidNetworkingToken(sessionId: string, profileId: string, token: string | null, audience: NetworkingAudience = 'member') {
  const legacyMemberToken = fnv1a(`hyspark-networking-v1:${sessionId}:${profileId}`);
  return token === createNetworkingToken(sessionId, profileId, audience) || (audience === 'member' && token === legacyMemberToken);
}

export function getAutomaticNetworkingSession(sessions: Session[], now = new Date()) {
  const nowTime = now.getTime();
  const availableSessions = [...sessions]
    .filter(session => session.status !== 'archived' && session.status !== 'draft')
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return availableSessions.find(session => {
    const start = new Date(session.start_at).getTime();
    const end = session.end_at
      ? new Date(session.end_at).getTime()
      : start + 6 * 60 * 60 * 1000;
    return end >= nowTime;
  }) || availableSessions[availableSessions.length - 1] || null;
}

export function getNetworkingUrl(session: Session, profile: Profile, audience: NetworkingAudience = 'member') {
  const params = new URLSearchParams({
    s: session.id,
    m: profile.id,
    a: audience,
    t: createNetworkingToken(session.id, profile.id, audience),
  });
  return `${window.location.origin}/networking/${audience}?${params.toString()}`;
}

export function getSharedNetworkingUrl(_session: Session, audience: NetworkingAudience = 'member') {
  const params = new URLSearchParams({
    a: audience,
    v: 'weekly1',
  });
  return `${window.location.origin}/networking/${audience}/toss?${params.toString()}`;
}

export function getNetworkingDeadlineLabel(now = new Date()) {
  const weekday = now.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `오늘(${weekday}) 밤 10시까지`;
}

export function getNetworkingTimeLabel() {
  return '18시 ~';
}

function getNetworkingMessageTitle(session: Session) {
  const weekLabel = session.title.match(/\d+\s*주차/)?.[0]?.replace(/\s+/g, '');
  return `[하이스파크 pre ${weekLabel || session.title} 네트워킹 세션 참여체크]`;
}

export function getSharedNetworkingMessage(session: Session, audience: NetworkingAudience = 'member') {
  const deadline = getNetworkingDeadlineLabel();
  const time = getNetworkingTimeLabel();
  const url = getSharedNetworkingUrl(session, audience);
  const title = getNetworkingMessageTitle(session);

  if (audience === 'staff') {
    return `${title}\n\n운영진용 안내입니다.\n이번 세션에 참여하고, 네트워킹에도 함께 가는 운영진만 체크해주세요.\n\n✅ 체크 대상: 세션 + 네트워킹 모두 참여하는 운영진\n⬜ 체크 안 해도 됨: 세션 불참자 / 네트워킹 불참자\n\n네트워킹 시간: ${time}\n마감: ${deadline}\n식당 예약 인원 확인을 위해 가능하면 바로 체크 부탁드립니다.\n\n이름 검색 후 “참여합니다”를 눌러주세요.\n${url}`;
  }

  return `${title}\n\n학회원용 안내입니다.\n네트워킹에 못 가는 학회원만 체크해주세요.\n해당 없으면 아무것도 하지 않아도 됩니다.\n\n✅ 체크 대상: 네트워킹 미참 학회원\n⬜ 체크 안 해도 됨: 해당 없는 학회원\n\n네트워킹 시간: ${time}\n마감: ${deadline}\n식당 예약 인원 확인을 위해 가능하면 바로 체크 부탁드립니다.\n\n이름 검색 후 “미참합니다”를 눌러주세요.\n${url}`;
}

export function getNetworkingMessageTemplate(session: Session, audience: NetworkingAudience = 'member') {
  const deadline = getNetworkingDeadlineLabel();
  const time = getNetworkingTimeLabel();

  if (audience === 'staff') {
    return `[HySpark 운영진 네트워킹 참여 체크]\n이번 주 ${session.title} 운영진 네트워킹 참여 조사입니다.\n네트워킹 시간: ${time}\n이번 세션에 참여하시고 네트워킹 세션에도 참여하신다면 ${deadline} 아래 개인 링크에서 체크해주세요.\n가능하면 확인 후 원활한 식당 예약을 위해 바로바로 체크 부탁드립니다.\n{개인링크}`;
  }

  return `[HySpark 네트워킹 미참 체크]\n이번 주 ${session.title} 네트워킹 미참 조사입니다.\n네트워킹 시간: ${time}\n미참하시는 분만 ${deadline} 아래 개인 링크에서 체크해주세요.\n가능하면 확인 후 원활한 식당 예약을 위해 바로바로 체크 부탁드립니다.\n{개인링크}`;
}

export function fillNetworkingMessageTemplate(session: Session, profile: Profile, template: string, audience: NetworkingAudience = 'member') {
  const personalUrl = getNetworkingUrl(session, profile, audience);
  const hasLinkPlaceholder = template.includes('{개인링크}') || template.includes('{링크}');
  const source = hasLinkPlaceholder ? template : `${template.trim()}\n${personalUrl}`;
  return source
    .replaceAll('{이름}', profile.full_name)
    .replaceAll('{개인링크}', personalUrl)
    .replaceAll('{링크}', personalUrl);
}

export function getNetworkingMessage(session: Session, profile: Profile, audience: NetworkingAudience = 'member') {
  return fillNetworkingMessageTemplate(session, profile, getNetworkingMessageTemplate(session, audience), audience);
}

export function getNetworkingCounts(session: Session, members: Profile[], staffProfiles: Profile[] = []) {
  const { networking } = parseSessionNotes(session.notes);
  const activeMembers = members.filter(member => member.role === 'member' && member.status === 'active');
  const activeStaff = staffProfiles.filter(profile => (profile.role === 'admin' || profile.role === 'staff') && profile.status === 'active');
  const responses = networking.responses;
  const staffResponses = networking.staff_responses;

  const notAttending = activeMembers.filter(member => responses[member.id]?.status === 'not_attending');
  const pending = activeMembers.filter(member => !responses[member.id]);
  const assumedAttending = pending;
  const staffAttending = activeStaff.filter(profile => staffResponses[profile.id]?.status === 'attending');
  const staffPending = activeStaff.filter(profile => !staffResponses[profile.id]);

  return {
    assumedAttending,
    notAttending,
    pending,
    responses,
    enabled: networking.enabled,
    staffAttending,
    staffPending,
    staffResponses,
    staffEnabled: networking.staff_enabled,
  };
}
