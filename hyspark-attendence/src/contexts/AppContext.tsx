import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Role, Profile, MemberWithSummary, Session, AttendanceRecord, AttendanceStatus, MemberSummary, CheckInMethod, AttendanceCodeStatus, SessionStatus, CampDemeritEntry } from '@/types';
import { getRiskState } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { adminApi, clearAdminToken } from '@/lib/adminApi';

export const MEMBER_SESSION_KEY = 'hyspark_member_id';

function persistMemberSession(profileId: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(MEMBER_SESSION_KEY, profileId);
  }
}

function clearMemberSession() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(MEMBER_SESSION_KEY);
  }
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SessionRow = Database['public']['Tables']['sessions']['Row'];
type AttendanceRecordRow = Database['public']['Tables']['attendance_records']['Row'];

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role as Role,
    full_name: row.full_name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    member_code: row.member_code || undefined,
    cohort_label: row.cohort_label || undefined,
    status: row.status as 'active' | 'inactive',
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    cohort_id: row.cohort_id || undefined,
    title: row.title,
    venue_name: row.venue_name || undefined,
    venue_map_url: row.venue_map_url || undefined,
    venue_lat: row.venue_lat || undefined,
    venue_lng: row.venue_lng || undefined,
    geofence_radius_m: row.geofence_radius_m,
    start_at: row.start_at,
    end_at: row.end_at || undefined,
    check_in_open_minutes: row.check_in_open_minutes,
    attendance_deadline_minutes: row.attendance_deadline_minutes,
    late_deadline_minutes: row.late_deadline_minutes,
    session_code: row.session_code,
    attendance_code: row.attendance_code,
    attendance_code_status: row.attendance_code_status as AttendanceCodeStatus,
    attendance_code_issued_at: row.attendance_code_issued_at,
    attendance_code_expires_at: row.attendance_code_expires_at,
    qr_token: row.qr_token,
    notes: row.notes || undefined,
    status: row.status as SessionStatus,
    attendance_rate: row.attendance_rate,
  };
}

function mapAttendanceRecord(row: AttendanceRecordRow): AttendanceRecord {
  return {
    id: row.id,
    session_id: row.session_id,
    member_id: row.member_id,
    member_name: row.member_name,
    status: row.status as AttendanceStatus,
    checked_in_at: row.checked_in_at,
    check_in_method: row.check_in_method as CheckInMethod,
    code_verified: row.code_verified,
    location_verified: row.location_verified,
    check_in_lat: row.check_in_lat || undefined,
    check_in_lng: row.check_in_lng || undefined,
    demerit_points: row.demerit_points,
    exception_category: row.exception_category || undefined,
    exception_note: row.exception_note || undefined,
    override_reason: row.override_reason || undefined,
    override_by: row.override_by || undefined,
    override_at: row.override_at || undefined,
  };
}

interface AppState {
  currentUser: Profile | null;
  currentRole: Role | null;
  profiles: Profile[];
  members: MemberWithSummary[];
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
  campResponses: CampDemeritEntry[];
  campResponsesByMember: Record<string, CampDemeritEntry[]>;
  // Auth
  unlockAdminConsole: () => void;
  loginAsMember: (name: string) => Promise<MemberWithSummary | null>;
  loginAsMemberById: (profileId: string) => Promise<MemberWithSummary | null>;
  resolveAndLoginWithPortalToken: (token: string) => Promise<MemberWithSummary | null>;
  logout: () => void;
  // Session actions
  openCheckIn: (sessionId: string) => Promise<void>;
  closeCheckIn: (sessionId: string) => Promise<void>;
  regenerateCode: (sessionId: string) => Promise<string>;
  createSession: (session: Partial<Session>) => Promise<void>;
  updateSession: (session: Session) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  // Attendance actions
  checkIn: (sessionId: string, memberId: string, code: string) => Promise<{ success: boolean; status?: AttendanceStatus; message: string; existing?: boolean }>;
  overrideAttendance: (recordId: string, newStatus: AttendanceStatus, reason: string) => Promise<void>;
  getSessionRecords: (sessionId: string) => AttendanceRecord[];
  getMemberRecords: (memberId: string) => AttendanceRecord[];
  // Member CRUD
  addMember: (data: { full_name: string; cohort_label: string; email?: string }) => Promise<void>;
  updateMember: (id: string, data: { full_name: string; cohort_label: string; status: 'active' | 'inactive'; email?: string }) => Promise<void>;
  deleteMember: (id: string) => Promise<boolean>;
  // Manual attendance
  addManualRecord: (sessionId: string, memberId: string, status: AttendanceStatus) => Promise<void>;
  submitAbsenceRequest: (sessionId: string, memberId: string, status: 'excused_absent' | 'unexcused_absent', category?: string, note?: string) => Promise<boolean>;
  // Refresh
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

function computeMemberSummary(
  memberId: string,
  records: AttendanceRecord[],
  campEntries: CampDemeritEntry[] = [],
): MemberSummary {
  const memberRecords = records.filter(r => r.member_id === memberId);
  const present = memberRecords.filter(r => r.status === 'present').length;
  const late = memberRecords.filter(r => r.status === 'late').length;
  const absent = memberRecords.filter(r => r.status === 'absent' || r.status === 'unexcused_absent' || r.status === 'excused_absent').length;
  const raw_demerit_points = memberRecords.reduce((sum, r) => sum + r.demerit_points, 0);
  const camp_credit_total = campEntries.reduce((sum, entry) => sum + entry.demerit_credit, 0);
  const demerit_points = Math.max(0, raw_demerit_points - camp_credit_total);
  return {
    present,
    late,
    absent,
    demerit_points,
    raw_demerit_points,
    camp_credit_total,
    risk_state: getRiskState(demerit_points),
  };
}

function mapCampResponse(row: {
  id: string;
  response_date: string;
  attended?: boolean;
  from_time: string;
  to_time: string;
  time_slots?: string[] | null;
  duration_minutes: number;
  demerit_credit: number;
}): CampDemeritEntry {
  const formatTime = (value: string) => value.slice(0, 5);
  return {
    id: row.id,
    response_date: row.response_date,
    attended: row.attended !== false,
    from_time: formatTime(row.from_time),
    to_time: formatTime(row.to_time),
    time_slots: row.time_slots?.length ? row.time_slots.map(formatTime) : undefined,
    duration_minutes: row.duration_minutes,
    demerit_credit: Number(row.demerit_credit),
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const isAdminPortal = import.meta.env.VITE_PORTAL === 'admin';
  const [currentUser, setCurrentUser] = useState<Profile | null>(
    isAdminPortal
      ? { id: 'admin-local', role: 'admin', full_name: '운영진', status: 'active' }
      : null,
  );
  const [currentRole, setCurrentRole] = useState<Role | null>(isAdminPortal ? 'admin' : null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sessionsState, setSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [campResponses, setCampResponses] = useState<CampDemeritEntry[]>([]);
  const [campResponsesByMember, setCampResponsesByMember] = useState<Record<string, CampDemeritEntry[]>>({});

  const generateCode = () =>
    String(Math.floor(10000 + Math.random() * 90000));

  const campByMember = useMemo(() => {
    if (isAdminPortal) return campResponsesByMember;
    if (!currentUser || currentRole !== 'member') return {};
    return { [currentUser.id]: campResponses };
  }, [campResponses, campResponsesByMember, currentRole, currentUser, isAdminPortal]);

  const members: MemberWithSummary[] = profiles
    .filter(p => p.role === 'member')
    .map(p => ({ ...p, summary: computeMemberSummary(p.id, records, campByMember[p.id] || []) }));

  const fetchAll = useCallback(async () => {
    await supabase.rpc('maybe_open_due_sessions');

    if (isAdminPortal) {
      const [profilesRes, sessionsRes, recordsRes, campRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        supabase.from('sessions').select('*').order('start_at', { ascending: true }),
        supabase.from('attendance_records').select('*').order('created_at', { ascending: true }),
        adminApi<{ responses?: Array<{
          id: string;
          profile_id: string;
          response_date: string;
          attended?: boolean;
          from_time: string;
          to_time: string;
          time_slots?: string[] | null;
          duration_minutes: number;
          demerit_credit: number;
        }> }>('get_camp_responses', {}),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data.map(mapProfile));
      if (sessionsRes.data) setSessions(sessionsRes.data.map(mapSession));
      if (recordsRes.data) setRecords(recordsRes.data.map(mapAttendanceRecord));
      const grouped: Record<string, CampDemeritEntry[]> = {};
      for (const row of campRes.data?.responses || []) {
        const entry = mapCampResponse(row);
        grouped[row.profile_id] = [...(grouped[row.profile_id] || []), entry];
      }
      setCampResponsesByMember(grouped);
      return;
    }

    const memberId = currentUser?.role === 'member' ? currentUser.id : null;
    const [sessionsRes, recordsRes, campMemberRes] = await Promise.all([
      supabase.from('sessions').select('*').order('start_at', { ascending: true }),
      supabase.from('attendance_records').select('*').order('created_at', { ascending: true }),
      memberId
        ? supabase.rpc('get_member_camp_responses', { p_profile_id: memberId })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (sessionsRes.data) setSessions(sessionsRes.data.map(mapSession));
    if (recordsRes.data) setRecords(recordsRes.data.map(mapAttendanceRecord));
    if (campMemberRes.data) {
      setCampResponses((campMemberRes.data as Array<Parameters<typeof mapCampResponse>[0]>).map(mapCampResponse));
    }
  }, [isAdminPortal, currentUser]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s to pick up auto-opened sessions
  useEffect(() => {
    const interval = setInterval(() => fetchAll(), 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const upsertRecord = (row: AttendanceRecordRow) => {
      const nextRecord = mapAttendanceRecord(row);
      setRecords(current => {
        const index = current.findIndex(record => record.id === nextRecord.id);
        if (index === -1) return [...current, nextRecord];
        const next = [...current];
        next[index] = nextRecord;
        return next;
      });
    };

    const removeRecord = (row: Partial<AttendanceRecordRow>) => {
      if (!row.id) return;
      setRecords(current => current.filter(record => record.id !== row.id));
    };

    const upsertSession = (row: SessionRow) => {
      const nextSession = mapSession(row);
      setSessions(current => {
        const index = current.findIndex(session => session.id === nextSession.id);
        const next = index === -1 ? [...current, nextSession] : current.map(session => session.id === nextSession.id ? nextSession : session);
        return next.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      });
    };

    const removeSession = (row: Partial<SessionRow>) => {
      if (!row.id) return;
      setSessions(current => current.filter(session => session.id !== row.id));
      setRecords(current => current.filter(record => record.session_id !== row.id));
    };

    const handleRecordChange = (payload: RealtimePostgresChangesPayload<AttendanceRecordRow>) => {
      if (payload.eventType === 'DELETE') {
        removeRecord(payload.old);
        return;
      }
      upsertRecord(payload.new);
    };

    const handleSessionChange = (payload: RealtimePostgresChangesPayload<SessionRow>) => {
      if (payload.eventType === 'DELETE') {
        removeSession(payload.old);
        return;
      }
      upsertSession(payload.new);
    };

    const channel = supabase
      .channel('hyspark-live-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, handleRecordChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, handleSessionChange)
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          fetchAll();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const unlockAdminConsole = useCallback(() => {
    setCurrentUser({
      id: 'admin-local', role: 'admin', full_name: '운영진', status: 'active',
    });
    setCurrentRole('admin');
  }, []);

  const loginAsMemberById = useCallback(async (profileId: string) => {
    const cached = profiles.find(p => p.id === profileId && p.role === 'member' && p.status === 'active');
    let found = cached;
    if (!found) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .eq('role', 'member')
        .eq('status', 'active')
        .maybeSingle();
      if (data) found = mapProfile(data);
    }
    if (found) {
      setCurrentUser(found);
      setCurrentRole('member');
      persistMemberSession(found.id);
      const summary = computeMemberSummary(found.id, records);
      return { ...found, summary };
    }
    return null;
  }, [profiles, records]);

  const loginAsMember = useCallback(async (name: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'member').eq('full_name', name).eq('status', 'active');
    const found = data?.[0];
    if (found) {
      const profile: Profile = {
        id: found.id, role: found.role as Role, full_name: found.full_name,
        cohort_label: found.cohort_label || undefined, status: found.status as 'active' | 'inactive',
      };
      setCurrentUser(profile);
      setCurrentRole('member');
      persistMemberSession(profile.id);
      const summary = computeMemberSummary(found.id, records);
      return { ...profile, summary };
    }
    return null;
  }, [records]);

  const resolveAndLoginWithPortalToken = useCallback(async (token: string) => {
    const { data, error } = await supabase.rpc('resolve_member_portal_token', { p_token: token });
    if (error) return null;
    const result = data as { ok?: boolean; profile_id?: string };
    if (!result?.ok || !result.profile_id) return null;
    return loginAsMemberById(result.profile_id);
  }, [loginAsMemberById]);

  const logout = useCallback(() => {
    if (isAdminPortal) clearAdminToken();
    clearMemberSession();
    setCurrentUser(null);
    setCurrentRole(null);
  }, [isAdminPortal]);

  useEffect(() => {
    if (isAdminPortal || currentUser) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (/[?&]m=/.test(hash)) return;
    const savedId = typeof window !== 'undefined' ? sessionStorage.getItem(MEMBER_SESSION_KEY) : null;
    if (!savedId) return;
    void loginAsMemberById(savedId).then(member => {
      if (!member) clearMemberSession();
    });
  }, [isAdminPortal, currentUser, loginAsMemberById]);

  const openCheckIn = useCallback(async (sessionId: string) => {
    const { error } = await adminApi('open_check_in', { sessionId });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const closeCheckIn = useCallback(async (sessionId: string) => {
    const { error } = await adminApi('close_check_in', { sessionId });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const regenerateCode = useCallback(async (sessionId: string) => {
    const { data, error } = await adminApi<{ code?: string }>('regenerate_code', { sessionId });
    if (!error) await fetchAll();
    return data?.code || generateCode();
  }, [fetchAll]);

  const createSession = useCallback(async (session: Partial<Session>) => {
    const { error } = await adminApi('create_session', {
      title: session.title,
      start_at: session.start_at,
      end_at: session.end_at || null,
      venue_name: session.venue_name || null,
      venue_map_url: session.venue_map_url || null,
      check_in_open_minutes: session.check_in_open_minutes ?? 0,
      attendance_deadline_minutes: session.attendance_deadline_minutes || 5,
      late_deadline_minutes: session.late_deadline_minutes || 30,
      notes: session.notes || null,
      status: session.status || 'scheduled',
    });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const updateSession = useCallback(async (session: Session) => {
    const { error } = await adminApi('update_session', {
      id: session.id,
      title: session.title,
      start_at: session.start_at,
      status: session.status,
      notes: session.notes || null,
      venue_name: session.venue_name || null,
      venue_map_url: session.venue_map_url || null,
      attendance_code: session.attendance_code,
      attendance_code_status: session.attendance_code_status,
      check_in_open_minutes: session.check_in_open_minutes,
      attendance_deadline_minutes: session.attendance_deadline_minutes,
      late_deadline_minutes: session.late_deadline_minutes,
    });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const { error } = await adminApi('delete_session', { sessionId });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const checkIn = useCallback(async (sessionId: string, memberId: string, code: string) => {
    const { data, error } = await supabase.rpc('member_check_in', {
      p_session_id: sessionId,
      p_member_id: memberId,
      p_code: code,
    });

    if (error) return { success: false, message: '체크인 중 오류가 발생했습니다.' };

    const result = data as {
      success?: boolean;
      status?: AttendanceStatus;
      message?: string;
      existing?: boolean;
      checked_in_at?: string;
    };

    if (!result?.success) {
      return { success: false, message: result?.message || '체크인에 실패했습니다.' };
    }

    await fetchAll();

    if (!result.existing && result.status) {
      void supabase.functions.invoke('send-checkin-email', {
        body: {
          memberId,
          sessionId,
          checkedInAt: result.checked_in_at || new Date().toISOString(),
          status: result.status,
        },
      });
    }

    return {
      success: true,
      status: result.status,
      message: result.message || '체크인 완료',
      existing: result.existing,
    };
  }, [fetchAll]);

  const overrideAttendance = useCallback(async (recordId: string, newStatus: AttendanceStatus, reason: string) => {
    const adminProfile = profiles.find(p => p.role === 'admin');
    const { error } = await adminApi('override_attendance', {
      recordId,
      status: newStatus,
      reason,
      override_by: adminProfile?.id || null,
    });
    if (error) console.error('Override failed:', error);
    else await fetchAll();
  }, [profiles, fetchAll]);

  const getSessionRecords = useCallback((sessionId: string) => {
    return records.filter(r => r.session_id === sessionId);
  }, [records]);

  const getMemberRecords = useCallback((memberId: string) => {
    return records.filter(r => r.member_id === memberId);
  }, [records]);

  const addMember = useCallback(async (data: { full_name: string; cohort_label: string; email?: string }) => {
    const { error } = await adminApi('add_member', {
      full_name: data.full_name,
      cohort_label: data.cohort_label,
      email: data.email || null,
    });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const updateMember = useCallback(async (id: string, data: { full_name: string; cohort_label: string; status: 'active' | 'inactive'; email?: string }) => {
    const { error } = await adminApi('update_member', {
      id,
      full_name: data.full_name,
      cohort_label: data.cohort_label,
      status: data.status,
      email: data.email || null,
    });
    if (!error) await fetchAll();
  }, [fetchAll]);

  const deleteMember = useCallback(async (id: string) => {
    const { error } = await adminApi('delete_member', { id });
    if (error) {
      console.error('Delete member failed:', error);
      return false;
    }
    await fetchAll();
    return true;
  }, [fetchAll]);

  const addManualRecord = useCallback(async (sessionId: string, memberId: string, status: AttendanceStatus) => {
    const existing = records.find(r => r.session_id === sessionId && r.member_id === memberId);
    if (existing) return;
    const member = profiles.find(p => p.id === memberId);
    const { error } = await adminApi('add_manual_record', {
      sessionId,
      memberId,
      memberName: member?.full_name || '',
      status,
    });
    if (!error) await fetchAll();
  }, [records, profiles, fetchAll]);

  const submitAbsenceRequest = useCallback(async (sessionId: string, memberId: string, status: 'excused_absent' | 'unexcused_absent', category?: string, note?: string) => {
    const { data, error } = await supabase.rpc('member_submit_absence', {
      p_session_id: sessionId,
      p_member_id: memberId,
      p_status: status,
      p_category: category || null,
      p_note: note || null,
    });
    if (error) {
      console.error('Absence request failed:', error);
      return false;
    }
    const result = data as { success?: boolean; message?: string };
    if (!result?.success) {
      console.error('Absence request rejected:', result?.message);
      return false;
    }
    await fetchAll();
    return true;
  }, [fetchAll]);

  return (
    <AppContext.Provider value={{
      currentUser, currentRole, profiles, members,
      sessions: sessionsState, attendanceRecords: records,
      campResponses, campResponsesByMember,
      unlockAdminConsole, loginAsMember, loginAsMemberById, resolveAndLoginWithPortalToken, logout,
      openCheckIn, closeCheckIn, regenerateCode,
      createSession, updateSession, deleteSession,
      checkIn, overrideAttendance,
      getSessionRecords, getMemberRecords,
      addMember, updateMember, deleteMember,
      addManualRecord,
      submitAbsenceRequest,
      refreshData: fetchAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
