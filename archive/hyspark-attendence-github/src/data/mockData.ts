import type {
  MemberWithSummary, Cohort, Session, AttendanceRecord,
  ActivityLog, RiskMember, DashboardStats, Profile,
} from '@/types';

export const currentAdmin: Profile = {
  id: 'admin-1', role: 'admin', full_name: '최민수',
  email: 'admin@hyspark.kr', status: 'active',
};

export const currentMemberProfile: MemberWithSummary = {
  id: 'member-1', role: 'member', full_name: '김서윤',
  phone: '010-1234-4821', member_code: 'HS2401',
  cohort_label: 'HySpark 5th', status: 'active',
  summary: { present: 3, late: 1, absent: 0, demerit_points: 0.5, risk_state: 'stable' },
};

export const cohorts: Cohort[] = [
  { id: 'cohort-2026-spring', name: 'HySpark 5th', season_label: '2026 Spring', is_active: true },
];

export const members: MemberWithSummary[] = [];

export const sessions: Session[] = [];

export const attendanceRecords: AttendanceRecord[] = [];

export const recentActivity: ActivityLog[] = [];

export const riskMembers: RiskMember[] = [];

export const dashboardStats: DashboardStats = {
  total_members: 32,
  today_present: 19,
  today_late: 4,
  today_absent: 2,
  today_not_checked_in: 7,
  average_attendance_rate: 0.87,
};
