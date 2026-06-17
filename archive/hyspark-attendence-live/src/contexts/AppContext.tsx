import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Role, Profile, MemberWithSummary, Session, AttendanceRecord, Cohort, AttendanceStatus, MemberSummary, CheckInMethod, AttendanceCodeStatus, SessionStatus } from '@/types';
import { getDemeritPoints, getRiskState } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SessionRow = Database['public']['Tables']['sessions']['Row'];
type AttendanceRecordRow = Database['public']['Tables']['attendance_records']['Row'];
type CohortRow = Database['public']['Tables']['cohorts']['Row'];

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

function mapCohort(row: CohortRow): Cohort {
  return {
    id: row.id,
    name: row.name,
    season_label: row.season_label || '',
    is_active: row.is_active,
  };
}

interface AppState {
  currentUser: Profile | null;
  currentRole: Role | null;
  profiles: Profile[];
  members: MemberWithSummary[];
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
  cohorts: Cohort[];
  loading: boolean;
  // Auth
  loginAsAdmin: (email: string, password: string) => Promise<boolean>;
  loginAsMember: (name: string) => Promise<MemberWithSummary | null>;
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
  addMember: (data: { full_name: string; cohort_label: string }) => Promise<void>;
  updateMember: (id: string, data: { full_name: string; cohort_label: string; status: 'active' | 'inactive' }) => Promise<void>;
  deleteMember: (id: string) => Promise<boolean>;
  addStaffProfile: (data: { full_name: string; role: 'admin' | 'staff'; email?: string; phone?: string }) => Promise<boolean>;
  updateStaffProfile: (id: string, data: { full_name: string; role: 'admin' | 'staff'; status: 'active' | 'inactive'; email?: string; phone?: string }) => Promise<boolean>;
  deleteStaffProfile: (id: string) => Promise<boolean>;
  // Manual attendance
  addManualRecord: (sessionId: string, memberId: string, status: AttendanceStatus) => Promise<void>;
  submitAbsenceRequest: (sessionId: string, memberId: string, status: 'excused_absent' | 'unexcused_absent', category?: string, note?: string) => Promise<void>;
  // Refresh
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

function computeMemberSummary(memberId: string, records: AttendanceRecord[]): MemberSummary {
  const memberRecords = records.filter(r => r.member_id === memberId);
  const present = memberRecords.filter(r => r.status === 'present').length;
  const late = memberRecords.filter(r => r.status === 'late').length;
  const absent = memberRecords.filter(r => r.status === 'absent' || r.status === 'unexcused_absent' || r.status === 'excused_absent').length;
  const demerit_points = memberRecords.reduce((sum, r) => sum + r.demerit_points, 0);
  return { present, late, absent, demerit_points, risk_state: getRiskState(demerit_points) };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>({
    id: 'admin-local', role: 'admin', full_name: '운영진', status: 'active',
  });
  const [currentRole, setCurrentRole] = useState<Role | null>('admin');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sessionsState, setSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cohortsState, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const generateCode = () =>
    String(Math.floor(10000 + Math.random() * 90000));

  // Computed members with summary
  const members: MemberWithSummary[] = profiles
    .filter(p => p.role === 'member')
    .map(p => ({ ...p, summary: computeMemberSummary(p.id, records) }));

  const fetchAll = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const [profilesRes, sessionsRes, recordsRes, cohortsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('sessions').select('*').order('start_at', { ascending: true }),
      supabase.from('attendance_records').select('*').order('created_at', { ascending: true }),
      supabase.from('cohorts').select('*'),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data.map(mapProfile));

    let mappedSessions: Session[] = [];
    if (sessionsRes.data) mappedSessions = sessionsRes.data.map(mapSession);

    const now = Date.now();
    const dueSessions = mappedSessions.filter(s => {
      if (s.status !== 'scheduled') return false;
      const openAt = new Date(s.start_at).getTime() - s.check_in_open_minutes * 60000;
      const closeAt = new Date(s.start_at).getTime() + s.late_deadline_minutes * 60000;
      return now >= openAt && now < closeAt;
    });

    if (dueSessions.length > 0) {
      await Promise.all(dueSessions.map(s => {
        const code = s.attendance_code || generateCode();
        const startAt = new Date(s.start_at).getTime();
        const expiresAt = new Date(startAt + s.late_deadline_minutes * 60000).toISOString();
        return supabase.from('sessions').update({
          status: 'open',
          attendance_code: code,
          attendance_code_status: 'active',
          attendance_code_issued_at: new Date().toISOString(),
          attendance_code_expires_at: expiresAt,
        }).eq('id', s.id);
      }));

      const { data: refreshedSessions } = await supabase
        .from('sessions')
        .select('*')
        .order('start_at', { ascending: true });

      if (refreshedSessions) {
        mappedSessions = refreshedSessions.map(mapSession);
      }
    }

    setSessions(mappedSessions);

    if (recordsRes.data) setRecords(recordsRes.data.map(mapAttendanceRecord));

    if (cohortsRes.data) setCohorts(cohortsRes.data.map(mapCohort));

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s to pick up auto-opened sessions
  useEffect(() => {
    const interval = setInterval(() => fetchAll(false), 30000);
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
          fetchAll(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const loginAsAdmin = useCallback(async (email: string, _password: string) => {
    if (email) {
      setCurrentUser({
        id: 'admin-local', role: 'admin', full_name: '운영진',
        email, status: 'active',
      });
      setCurrentRole('admin');
      return true;
    }
    return false;
  }, []);

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
      const summary = computeMemberSummary(found.id, records);
      return { ...profile, summary };
    }
    return null;
  }, [records]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentRole(null);
  }, []);

  const openCheckIn = useCallback(async (sessionId: string) => {
    const session = sessionsState.find(s => s.id === sessionId);
    const code = session?.attendance_code || generateCode();
    // 만료시간 = 세션 시작시간 + 지각마감(분)
    const startAt = session ? new Date(session.start_at).getTime() : Date.now();
    const lateMin = session?.late_deadline_minutes ?? 30;
    const expiresAt = new Date(startAt + lateMin * 60000).toISOString();
    const { error } = await supabase.from('sessions').update({
      status: 'open',
      attendance_code: code,
      attendance_code_status: 'active',
      attendance_code_issued_at: new Date().toISOString(),
      attendance_code_expires_at: expiresAt,
    }).eq('id', sessionId);
    if (!error) await fetchAll();
  }, [sessionsState, fetchAll]);

  const closeCheckIn = useCallback(async (sessionId: string) => {
    // Auto-mark absent for members who didn't check in (exclude those with any existing record, including excused_absent)
    const activeMembers = profiles.filter(p => p.role === 'member' && p.status === 'active');
    const sessionRecords = records.filter(r => r.session_id === sessionId);
    const recordedIds = new Set(sessionRecords.map(r => r.member_id));
    const absentMembers = activeMembers.filter(m => !recordedIds.has(m.id));

    if (absentMembers.length > 0) {
      const absentRecords = absentMembers.map(m => ({
        session_id: sessionId,
        member_id: m.id,
        member_name: m.full_name,
        status: 'unexcused_absent',
        checked_in_at: new Date().toISOString(),
        check_in_method: 'auto',
        code_verified: false,
        location_verified: false,
        demerit_points: 1,
      }));
      await supabase.from('attendance_records').insert(absentRecords);
    }

    await supabase.from('sessions').update({
      status: 'closed', attendance_code_status: 'expired',
    }).eq('id', sessionId);
    await fetchAll();
  }, [profiles, records, fetchAll]);

  const regenerateCode = useCallback(async (sessionId: string) => {
    const session = sessionsState.find(s => s.id === sessionId);
    const newCode = generateCode();
    const startAt = session ? new Date(session.start_at).getTime() : Date.now();
    const lateMin = session?.late_deadline_minutes ?? 30;
    const expiresAt = new Date(startAt + lateMin * 60000).toISOString();
    await supabase.from('sessions').update({
      attendance_code: newCode,
      attendance_code_issued_at: new Date().toISOString(),
      attendance_code_expires_at: expiresAt,
    }).eq('id', sessionId);
    await fetchAll();
    return newCode;
  }, [sessionsState, fetchAll]);

  const createSession = useCallback(async (session: Partial<Session>) => {
    await supabase.from('sessions').insert({
      title: session.title!,
      start_at: session.start_at!,
      end_at: session.end_at || null,
      check_in_open_minutes: session.check_in_open_minutes ?? 0,
      attendance_deadline_minutes: session.attendance_deadline_minutes || 5,
      late_deadline_minutes: session.late_deadline_minutes || 30,
      notes: session.notes || null,
      status: session.status || 'scheduled',
    });
    await fetchAll();
  }, [fetchAll]);

  const updateSession = useCallback(async (session: Session) => {
    await supabase.from('sessions').update({
      title: session.title, start_at: session.start_at,
      status: session.status, notes: session.notes || null,
      attendance_code: session.attendance_code,
      attendance_code_status: session.attendance_code_status,
      check_in_open_minutes: session.check_in_open_minutes,
      attendance_deadline_minutes: session.attendance_deadline_minutes,
      late_deadline_minutes: session.late_deadline_minutes,
    }).eq('id', session.id);
    await fetchAll();
  }, [fetchAll]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase.from('attendance_records').delete().eq('session_id', sessionId);
    await supabase.from('sessions').delete().eq('id', sessionId);
    await fetchAll();
  }, [fetchAll]);

  const checkIn = useCallback(async (sessionId: string, memberId: string, code: string) => {
    const session = sessionsState.find(s => s.id === sessionId);
    if (!session) return { success: false, message: '세션을 찾을 수 없습니다.' };
    if (session.status !== 'open') return { success: false, message: '운영진이 현장 출결을 열면 체크인할 수 있습니다.' };
    if (session.attendance_code_status !== 'active') return { success: false, message: '출결코드가 활성화되지 않았습니다.' };
    if (session.attendance_code !== code) return { success: false, message: '출결코드가 일치하지 않습니다.' };

    const existing = records.find(r => r.session_id === sessionId && r.member_id === memberId);
    if (existing) return { success: true, status: existing.status, message: '이미 체크인 완료', existing: true };

    const now = new Date();
    const start = new Date(session.start_at);
    const deadlineMs = session.attendance_deadline_minutes * 60000;
    const lateMs = session.late_deadline_minutes * 60000;

    let status: AttendanceStatus;
    if (now.getTime() < start.getTime() + deadlineMs) status = 'present';
    else if (now.getTime() < start.getTime() + lateMs) status = 'late';
    else status = 'unexcused_absent';

    const demerit = getDemeritPoints(status);
    const member = profiles.find(p => p.id === memberId);

    const { error } = await supabase.from('attendance_records').insert({
      session_id: sessionId,
      member_id: memberId,
      member_name: member?.full_name || '',
      status,
      checked_in_at: now.toISOString(),
      check_in_method: 'code',
      code_verified: true,
      location_verified: true,
      demerit_points: demerit,
    });

    if (error) return { success: false, message: '체크인 중 오류가 발생했습니다.' };
    await fetchAll();
    return { success: true, status, message: status === 'present' ? '출석 완료!' : status === 'late' ? '지각 처리되었습니다.' : '결석 처리되었습니다.' };
  }, [sessionsState, records, profiles, fetchAll]);

  const overrideAttendance = useCallback(async (recordId: string, newStatus: AttendanceStatus, reason: string) => {
    const newDemerit = getDemeritPoints(newStatus);
    // Find real admin profile ID from DB profiles (not local hardcoded id)
    const adminProfile = profiles.find(p => p.role === 'admin');
    const { error } = await supabase.from('attendance_records').update({
      status: newStatus,
      demerit_points: newDemerit,
      override_reason: reason || null,
      override_by: adminProfile?.id || null,
      override_at: new Date().toISOString(),
    }).eq('id', recordId);
    if (error) console.error('Override failed:', error);
    await fetchAll();
  }, [profiles, fetchAll]);

  const getSessionRecords = useCallback((sessionId: string) => {
    return records.filter(r => r.session_id === sessionId);
  }, [records]);

  const getMemberRecords = useCallback((memberId: string) => {
    return records.filter(r => r.member_id === memberId);
  }, [records]);

  const addMember = useCallback(async (data: { full_name: string; cohort_label: string }) => {
    await supabase.from('profiles').insert({
      role: 'member',
      full_name: data.full_name,
      cohort_label: data.cohort_label,
      status: 'active',
    });
    await fetchAll();
  }, [fetchAll]);

  const updateMember = useCallback(async (id: string, data: { full_name: string; cohort_label: string; status: 'active' | 'inactive' }) => {
    await supabase.from('profiles').update({
      full_name: data.full_name,
      cohort_label: data.cohort_label,
      status: data.status,
    }).eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const deleteMember = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)
      .eq('role', 'member');

    if (error) {
      console.error('Delete member failed:', error);
      return false;
    }

    await fetchAll();
    return true;
  }, [fetchAll]);

  const addStaffProfile = useCallback(async (data: { full_name: string; role: 'admin' | 'staff'; email?: string; phone?: string }) => {
    const { error } = await supabase.from('profiles').insert({
      role: data.role,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone || null,
      status: 'active',
    });

    if (error) {
      console.error('Add staff failed:', error);
      return false;
    }

    await fetchAll();
    return true;
  }, [fetchAll]);

  const updateStaffProfile = useCallback(async (id: string, data: { full_name: string; role: 'admin' | 'staff'; status: 'active' | 'inactive'; email?: string; phone?: string }) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        role: data.role,
        full_name: data.full_name,
        status: data.status,
        email: data.email || null,
        phone: data.phone || null,
      })
      .eq('id', id)
      .in('role', ['admin', 'staff']);

    if (error) {
      console.error('Update staff failed:', error);
      return false;
    }

    await fetchAll();
    return true;
  }, [fetchAll]);

  const deleteStaffProfile = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', id)
      .in('role', ['admin', 'staff']);

    if (error) {
      console.error('Delete staff failed:', error);
      return false;
    }

    await fetchAll();
    return true;
  }, [fetchAll]);

  const addManualRecord = useCallback(async (sessionId: string, memberId: string, status: AttendanceStatus) => {
    const existing = records.find(r => r.session_id === sessionId && r.member_id === memberId);
    if (existing) return;
    const member = profiles.find(p => p.id === memberId);
    const demerit = getDemeritPoints(status);
    await supabase.from('attendance_records').insert({
      session_id: sessionId,
      member_id: memberId,
      member_name: member?.full_name || '',
      status,
      checked_in_at: new Date().toISOString(),
      check_in_method: 'manual',
      code_verified: false,
      location_verified: false,
      demerit_points: demerit,
    });
    await fetchAll();
  }, [records, profiles, fetchAll]);

  const submitAbsenceRequest = useCallback(async (sessionId: string, memberId: string, status: 'excused_absent' | 'unexcused_absent', category?: string, note?: string) => {
    const existing = records.find(r => r.session_id === sessionId && r.member_id === memberId);
    if (existing) return;
    const member = profiles.find(p => p.id === memberId);
    const demerit = getDemeritPoints(status);
    await supabase.from('attendance_records').insert({
      session_id: sessionId,
      member_id: memberId,
      member_name: member?.full_name || '',
      status,
      checked_in_at: new Date().toISOString(),
      check_in_method: 'manual',
      code_verified: false,
      location_verified: false,
      demerit_points: demerit,
      exception_category: category || null,
      exception_note: note || null,
    });
    await fetchAll();
  }, [records, profiles, fetchAll]);

  return (
    <AppContext.Provider value={{
      currentUser, currentRole, profiles, members,
      sessions: sessionsState, attendanceRecords: records,
      cohorts: cohortsState, loading,
      loginAsAdmin, loginAsMember, logout,
      openCheckIn, closeCheckIn, regenerateCode,
      createSession, updateSession, deleteSession,
      checkIn, overrideAttendance,
      getSessionRecords, getMemberRecords,
      addMember, updateMember, deleteMember,
      addStaffProfile, updateStaffProfile, deleteStaffProfile,
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
