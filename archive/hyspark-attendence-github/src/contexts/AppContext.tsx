import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Role, Profile, MemberWithSummary, Session, AttendanceRecord, Cohort, AttendanceStatus, MemberSummary } from '@/types';
import { getDemeritPoints, getRiskState } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface AppState {
  currentUser: Profile | null;
  currentRole: Role | null;
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

  // Computed members with summary
  const members: MemberWithSummary[] = profiles
    .filter(p => p.role === 'member')
    .map(p => ({ ...p, summary: computeMemberSummary(p.id, records) }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [profilesRes, sessionsRes, recordsRes, cohortsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('sessions').select('*').order('start_at', { ascending: true }),
      supabase.from('attendance_records').select('*').order('created_at', { ascending: true }),
      supabase.from('cohorts').select('*'),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data.map(p => ({
      id: p.id, role: p.role as Role, full_name: p.full_name,
      email: p.email || undefined, phone: p.phone || undefined,
      member_code: p.member_code || undefined, cohort_label: p.cohort_label || undefined,
      status: p.status as 'active' | 'inactive',
    })));

    if (sessionsRes.data) setSessions(sessionsRes.data.map(s => ({
      id: s.id, cohort_id: s.cohort_id || undefined, title: s.title,
      venue_name: s.venue_name || undefined, venue_lat: s.venue_lat || undefined,
      venue_lng: s.venue_lng || undefined, geofence_radius_m: s.geofence_radius_m,
      start_at: s.start_at, end_at: s.end_at || undefined,
      check_in_open_minutes: s.check_in_open_minutes,
      attendance_deadline_minutes: s.attendance_deadline_minutes,
      late_deadline_minutes: s.late_deadline_minutes,
      session_code: s.session_code, attendance_code: s.attendance_code,
      attendance_code_status: s.attendance_code_status as any,
      attendance_code_issued_at: s.attendance_code_issued_at,
      attendance_code_expires_at: s.attendance_code_expires_at,
      qr_token: s.qr_token, notes: s.notes || undefined,
      status: s.status as any, attendance_rate: s.attendance_rate,
    })));

    if (recordsRes.data) setRecords(recordsRes.data.map(r => ({
      id: r.id, session_id: r.session_id, member_id: r.member_id,
      member_name: r.member_name, status: r.status as AttendanceStatus,
      checked_in_at: r.checked_in_at, check_in_method: r.check_in_method as any,
      code_verified: r.code_verified, location_verified: r.location_verified,
      check_in_lat: r.check_in_lat || undefined, check_in_lng: r.check_in_lng || undefined,
      demerit_points: r.demerit_points, exception_category: r.exception_category || undefined,
      exception_note: r.exception_note || undefined, override_reason: r.override_reason || undefined,
      override_by: r.override_by || undefined, override_at: r.override_at || undefined,
    })));

    if (cohortsRes.data) setCohorts(cohortsRes.data.map(c => ({
      id: c.id, name: c.name, season_label: c.season_label || '',
      is_active: c.is_active,
    })));

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s to pick up auto-opened sessions
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
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

  const generateCode = () =>
    String(Math.floor(10000 + Math.random() * 90000));

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
      check_in_open_minutes: session.check_in_open_minutes || 10,
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
      currentUser, currentRole, members,
      sessions: sessionsState, attendanceRecords: records,
      cohorts: cohortsState, loading,
      loginAsAdmin, loginAsMember, logout,
      openCheckIn, closeCheckIn, regenerateCode,
      createSession, updateSession, deleteSession,
      checkIn, overrideAttendance,
      getSessionRecords, getMemberRecords,
      addMember, updateMember,
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
