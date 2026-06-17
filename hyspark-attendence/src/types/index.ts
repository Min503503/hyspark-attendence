export type Role = 'admin' | 'staff' | 'member';
export type MemberStatus = 'active' | 'inactive';
export type SessionStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'archived';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused_absent' | 'unexcused_absent';
export type AttendanceCodeStatus = 'inactive' | 'active' | 'expired';
export type CheckInMethod = 'qr' | 'code' | 'manual' | 'auto';
export type RiskState = 'stable' | 'counseling' | 'withdrawal';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email?: string;
  phone?: string;
  member_code?: string;
  cohort_label?: string;
  status: MemberStatus;
}

export interface MemberSummary {
  present: number;
  late: number;
  absent: number;
  demerit_points: number;
  risk_state: RiskState;
}

export interface MemberWithSummary extends Profile {
  summary: MemberSummary;
}

export interface Cohort {
  id: string;
  name: string;
  season_label: string;
  is_active: boolean;
}

export interface Session {
  id: string;
  cohort_id?: string;
  title: string;
  venue_name?: string;
  venue_map_url?: string;
  venue_lat?: number;
  venue_lng?: number;
  geofence_radius_m: number;
  start_at: string;
  end_at?: string;
  check_in_open_minutes: number;
  attendance_deadline_minutes: number;
  late_deadline_minutes: number;
  session_code: string;
  attendance_code: string | null;
  attendance_code_status: AttendanceCodeStatus;
  attendance_code_issued_at: string | null;
  attendance_code_expires_at: string | null;
  qr_token: string;
  notes?: string;
  status: SessionStatus;
  attendance_rate: number | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  member_name: string;
  status: AttendanceStatus;
  checked_in_at: string | null;
  check_in_method: CheckInMethod;
  code_verified: boolean;
  location_verified: boolean;
  check_in_lat?: number;
  check_in_lng?: number;
  demerit_points: number;
  exception_category?: string;
  exception_note?: string;
  override_reason?: string;
  override_by?: string;
  override_at?: string;
}

export interface ActivityLog {
  type: 'check_in' | 'override' | 'session_created' | 'member_added';
  message: string;
  time_ago: string;
}

export interface RiskMember {
  member_name: string;
  member_id: string;
  demerit_points: number;
  risk_state: RiskState;
  note: string;
}

export interface DashboardStats {
  total_members: number;
  today_present: number;
  today_late: number;
  today_absent: number;
  today_not_checked_in: number;
  average_attendance_rate: number;
}

export interface PenaltyPolicy {
  late_points: number;
  absent_points: number;
  counseling_threshold: number;
  withdrawal_threshold: number;
  demo_day_impact: boolean;
}

export const PENALTY_POLICY: PenaltyPolicy = {
  late_points: 0.5,
  absent_points: 1.0,
  counseling_threshold: 2.0,
  withdrawal_threshold: 4.0,
  demo_day_impact: true,
};

export const EXCEPTION_CATEGORIES = [
  '가족 경조사',
  '창업 활동',
  '질병',
  '학교/공식 일정',
];

export function getRiskState(demeritPoints: number): RiskState {
  if (demeritPoints >= PENALTY_POLICY.withdrawal_threshold) return 'withdrawal';
  if (demeritPoints >= PENALTY_POLICY.counseling_threshold) return 'counseling';
  return 'stable';
}

export function getDemeritPoints(status: AttendanceStatus): number {
  if (status === 'late') return PENALTY_POLICY.late_points;
  if (status === 'absent') return PENALTY_POLICY.absent_points;
  if (status === 'unexcused_absent') return PENALTY_POLICY.absent_points;
  return 0;
}

export function determineAttendanceStatus(
  checkedInAt: Date,
  sessionStart: Date,
  attendanceDeadlineMin: number,
  lateDeadlineMin: number
): AttendanceStatus {
  const attendanceDeadline = new Date(sessionStart.getTime() + attendanceDeadlineMin * 60000);
  const lateDeadline = new Date(sessionStart.getTime() + lateDeadlineMin * 60000);

  if (checkedInAt < attendanceDeadline) return 'present';
  if (checkedInAt < lateDeadline) return 'late';
  return 'absent';
}
