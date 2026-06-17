import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Clock,
  Download,
  MessageCircle,
  Play,
  Plus,
  UserX,
  Users,
} from 'lucide-react';
import type { AttendanceRecord, MemberWithSummary, Session } from '@/types';
import { DataRow, EmptyState, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';
import { getAutomaticNetworkingSession, getNetworkingCounts } from '@/lib/networking';

const absentStatuses = new Set(['absent', 'excused_absent', 'unexcused_absent']);
const preAbsenceStatuses = new Set(['excused_absent', 'unexcused_absent']);

const statusLabel: Record<string, string> = {
  absent: '결석',
  excused_absent: '인정',
  unexcused_absent: '미인정',
  missing: '미기록',
};

function formatSessionTime(session: Session) {
  return new Date(session.start_at).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildPreAbsenceRows(
  session: Session | undefined,
  members: MemberWithSummary[],
  records: AttendanceRecord[],
) {
  if (!session) {
    return {
      rows: [],
      excusedCount: 0,
      unexcusedCount: 0,
    };
  }

  const activeMemberIds = new Set(members.map(member => member.id));
  const rows = records
    .filter(record =>
      record.session_id === session.id &&
      activeMemberIds.has(record.member_id) &&
      preAbsenceStatuses.has(record.status)
    )
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'unexcused_absent' ? -1 : 1;
      return a.member_name.localeCompare(b.member_name, 'ko');
    });

  return {
    rows,
    excusedCount: rows.filter(record => record.status === 'excused_absent').length,
    unexcusedCount: rows.filter(record => record.status === 'unexcused_absent').length,
  };
}

function buildAbsenceRows(
  sessions: Session[],
  members: MemberWithSummary[],
  records: AttendanceRecord[],
) {
  return sessions.map(session => {
    const sessionRecords = records.filter(record => record.session_id === session.id);
    const recordByMember = new Map(sessionRecords.map(record => [record.member_id, record]));
    const absentMembers = members
      .map(member => {
        const record = recordByMember.get(member.id);
        if (!record) return { member, status: 'missing' };
        if (absentStatuses.has(record.status)) return { member, status: record.status };
        return null;
      })
      .filter((item): item is { member: MemberWithSummary; status: string } => Boolean(item));

    const present = sessionRecords.filter(record => record.status === 'present').length;
    const late = sessionRecords.filter(record => record.status === 'late').length;
    const absent = absentMembers.length;
    const attendanceRate = members.length > 0 ? Math.round(((present + late) / members.length) * 100) : 0;

    return { session, absentMembers, present, late, absent, attendanceRate };
  });
}

export default function AdminDashboard() {
  const { sessions, members, profiles, attendanceRecords, openCheckIn } = useApp();
  const navigate = useNavigate();

  const dashboard = useMemo(() => {
    const activeMembers = members.filter(member => member.status === 'active');
    const activeStaffProfiles = profiles.filter(profile =>
      (profile.role === 'admin' || profile.role === 'staff') && profile.status === 'active'
    );
    const totalMembers = activeMembers.length;
    const riskMembers = activeMembers.filter(member => member.summary.risk_state !== 'stable');
    const closedSessions = [...sessions]
      .filter(session => session.status === 'closed')
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    const recentClosedSessions = closedSessions.slice(0, 6);
    const absenceRows = buildAbsenceRows(recentClosedSessions, activeMembers, attendanceRecords);
    const recentAbsenceCount = absenceRows.reduce((sum, row) => sum + row.absent, 0);

    const frequentAbsentees = activeMembers
      .map(member => {
        const memberRecords = attendanceRecords.filter(record => member.id === record.member_id);
        const memberRecordBySession = new Map(memberRecords.map(record => [record.session_id, record]));
        const absentCount = closedSessions.reduce((count, session) => {
          const record = memberRecordBySession.get(session.id);
          return count + (!record || absentStatuses.has(record.status) ? 1 : 0);
        }, 0);
        const lateCount = memberRecords.filter(record => record.status === 'late').length;
        const recentMisses = recentClosedSessions.filter(session => {
          const record = memberRecordBySession.get(session.id);
          return !record || absentStatuses.has(record.status);
        }).length;

        return { member, absentCount, lateCount, recentMisses };
      })
      .filter(item => item.absentCount > 0 || item.lateCount > 0)
      .sort((a, b) => b.recentMisses - a.recentMisses || b.absentCount - a.absentCount || b.lateCount - a.lateCount)
      .slice(0, 6);

    const todaySession = sessions.find(session => session.status === 'open')
      || sessions
        .filter(session => session.status === 'scheduled')
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
    const todayRecords = todaySession
      ? attendanceRecords.filter(record => record.session_id === todaySession.id)
      : [];
    const todayPresent = todayRecords.filter(record => record.status === 'present').length;
    const todayLate = todayRecords.filter(record => record.status === 'late').length;
    const todayNotCheckedIn = Math.max(totalMembers - todayRecords.length, 0);
    const preAbsence = buildPreAbsenceRows(todaySession, activeMembers, attendanceRecords);

    const avgRate = closedSessions.length > 0
      ? closedSessions.reduce((sum, session) => {
          const sessionRecords = attendanceRecords.filter(record => record.session_id === session.id);
          const presentOrLate = sessionRecords.filter(record => record.status === 'present' || record.status === 'late').length;
          return sum + (totalMembers > 0 ? presentOrLate / totalMembers : 0);
        }, 0) / closedSessions.length
      : 0;

    const nextScheduledSession = sessions
      .filter(session => session.status === 'scheduled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
    const networkingSession = getAutomaticNetworkingSession(sessions);
    const networkingCounts = networkingSession
      ? getNetworkingCounts(networkingSession, activeMembers, activeStaffProfiles)
      : null;
    const networkingMemberParticipants = networkingCounts?.assumedAttending.length || 0;
    const networkingStaffParticipants = networkingCounts?.staffAttending.length || 0;
    const networkingParticipants = networkingMemberParticipants + networkingStaffParticipants;

    return {
      activeMembers,
      totalMembers,
      riskMembers,
      absenceRows,
      frequentAbsentees,
      todaySession,
      todayPresent,
      todayLate,
      todayNotCheckedIn,
      preAbsence,
      avgRate,
      recentAbsenceCount,
      nextScheduledSession,
      networkingSession,
      networkingCounts,
      networkingMemberParticipants,
      networkingStaffParticipants,
      networkingParticipants,
    };
  }, [attendanceRecords, members, profiles, sessions]);

  const exportCSV = () => {
    const header = '이름,출석,지각,결석,벌점,상태\n';
    const rows = members.map(member =>
      `${member.full_name},${member.summary.present},${member.summary.late},${member.summary.absent},${member.summary.demerit_points},${member.summary.risk_state}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spark_attendance_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell size="lg" className="space-y-6">
      <PageHeader
        title="대시보드"
        description="다가오는 세션의 사전 결석 신청과 운영 리스크를 빠르게 확인합니다."
        actions={
        <>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/sessions/new')} className="active:scale-[0.97]">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> 세션 생성
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/members')} className="active:scale-[0.97]">
            <Users className="w-3.5 h-3.5 mr-1.5" /> 멤버 관리
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} className="active:scale-[0.97]">
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {dashboard.todaySession && (
          <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '120ms' }}>
            <div className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground">
                    {dashboard.todaySession.status === 'open' ? '진행 중' : '다음 세션'}
                  </span>
                  {dashboard.todaySession.status === 'open' && <span className="w-2 h-2 rounded-full bg-status-present animate-pulse-dot" />}
                </div>
                <h2 className="font-extrabold text-xl truncate">{dashboard.todaySession.title}</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {formatSessionTime(dashboard.todaySession)}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <p className="text-[10px] text-muted-foreground">출석</p>
                    <p className="font-extrabold text-status-present tabular-nums">{dashboard.todayPresent}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <p className="text-[10px] text-muted-foreground">지각</p>
                    <p className="font-extrabold text-status-late tabular-nums">{dashboard.todayLate}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <p className="text-[10px] text-muted-foreground">미체크</p>
                    <p className="font-extrabold text-status-absent tabular-nums">{dashboard.todayNotCheckedIn}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-secondary/45 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-muted-foreground">사전 결석 신청</p>
                    <div className="flex gap-1.5">
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                        인정 {dashboard.preAbsence.excusedCount}
                      </span>
                      <span className="rounded-md bg-status-absent/10 px-1.5 py-0.5 text-[10px] font-bold text-status-absent">
                        미인정 {dashboard.preAbsence.unexcusedCount}
                      </span>
                    </div>
                  </div>
                  {dashboard.preAbsence.rows.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dashboard.preAbsence.rows.slice(0, 4).map(record => (
                        <span
                          key={record.id}
                          className="rounded-md bg-background/70 px-2 py-1 text-[11px] font-semibold text-foreground/85"
                        >
                          {record.member_name} · {record.status === 'unexcused_absent' ? '미인정' : '인정'}
                        </span>
                      ))}
                      {dashboard.preAbsence.rows.length > 4 && (
                        <span className="rounded-md bg-background/70 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                          외 {dashboard.preAbsence.rows.length - 4}명
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">아직 신청 없음</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {dashboard.todaySession.status === 'scheduled' && (
                  <Button size="sm" onClick={() => openCheckIn(dashboard.todaySession!.id)} className="bg-accent text-accent-foreground active:scale-[0.97]">
                    <Play className="w-3.5 h-3.5 mr-1" /> 수동 출결시작
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate(`/admin/sessions/${dashboard.todaySession!.id}`)} className="active:scale-[0.97]">
                  상세
                </Button>
              </div>
            </div>
          </Surface>
        )}

        <Surface className="animate-reveal-up p-5" style={{ animationDelay: '150ms' }}>
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">이번 주 네트워킹</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/admin/networking')} className="h-7 px-2 text-xs">
                보기
              </Button>
            </div>
            {dashboard.networkingSession ? (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{dashboard.networkingSession.title}</p>
                    <p className="mt-1 text-4xl font-extrabold tabular-nums text-foreground">{dashboard.networkingParticipants}</p>
                  </div>
                  <StatusPill tone={dashboard.networkingCounts?.enabled || dashboard.networkingCounts?.staffEnabled ? 'success' : 'neutral'}>
                    {dashboard.networkingCounts?.enabled || dashboard.networkingCounts?.staffEnabled ? '조사 열림' : '조사 닫힘'}
                  </StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-background/75 p-2">
                    <p className="text-[10px] text-muted-foreground">학회원 참여자</p>
                    <p className="font-extrabold text-status-present tabular-nums">{dashboard.networkingMemberParticipants}</p>
                  </div>
                  <div className="rounded-lg bg-background/75 p-2">
                    <p className="text-[10px] text-muted-foreground">운영진 참여자</p>
                    <p className="font-extrabold text-primary tabular-nums">{dashboard.networkingStaffParticipants}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">네트워킹 대상 세션이 없습니다.</p>
            )}
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">자동 오픈 상태</h2>
            </div>
            {dashboard.nextScheduledSession ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{dashboard.nextScheduledSession.title}</p>
                <p className="text-xs text-muted-foreground">{formatSessionTime(dashboard.nextScheduledSession)}</p>
                <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                  시작 {dashboard.nextScheduledSession.check_in_open_minutes}분 전 자동 오픈
                  {dashboard.nextScheduledSession.check_in_open_minutes === 0 && (
                    <span className="font-semibold text-foreground"> · 시작 정각 오픈</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">예정된 세션이 없습니다.</p>
            )}
          </div>
        </Surface>
      </div>

      <section className="animate-reveal-up" style={{ animationDelay: '190ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-status-absent" />
            <h2 className="text-sm font-bold">최근 주차 결석자</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate('/admin/sessions')} className="h-7 px-2 text-xs">
            세션 보기
          </Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.absenceRows.length === 0 && (
            <EmptyState title="종료된 세션이 아직 없습니다" description="세션이 종료되면 최근 결석자 흐름이 표시됩니다." />
          )}
          {dashboard.absenceRows.map(row => (
            <DataRow
              key={row.session.id}
              onClick={() => navigate(`/admin/sessions/${row.session.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{row.session.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatSessionTime(row.session)}</p>
                </div>
                <Badge variant="outline" className={row.absent > 0 ? 'border-status-absent text-status-absent' : 'border-status-present text-status-present'}>
                  출석률 {row.attendanceRate}%
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.absentMembers.length === 0 ? (
                  <span className="text-xs font-medium text-status-present">전원 출석/지각 기록 있음</span>
                ) : (
                  row.absentMembers.slice(0, 8).map(item => (
                    <span key={`${row.session.id}-${item.member.id}`} className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
                      {item.member.full_name} · {statusLabel[item.status]}
                    </span>
                  ))
                )}
                {row.absentMembers.length > 8 && (
                  <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    외 {row.absentMembers.length - 8}명
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                <span>출석 {row.present}</span>
                <span>지각 {row.late}</span>
                <span>결석/미기록 {row.absent}</span>
              </div>
            </DataRow>
          ))}
        </div>
      </section>

      <section className="animate-reveal-up grid gap-4 lg:grid-cols-2" style={{ animationDelay: '240ms' }}>
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">결석/지각 누적 체크</h2>
          </div>
          <div className="space-y-2">
            {dashboard.frequentAbsentees.length === 0 && (
              <EmptyState title="누적 결석 또는 지각이 없습니다" description="현재까지 별도 확인이 필요한 멤버가 없습니다." />
            )}
            {dashboard.frequentAbsentees.map(item => (
              <DataRow
                key={item.member.id}
                onClick={() => navigate(`/admin/members/${item.member.id}`)}
                className="flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold">{item.member.full_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">최근 {item.recentMisses}회 미출석 · 벌점 {item.member.summary.demerit_points}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-status-absent">결석 {item.absentCount}</span>
                  <span className="font-bold text-status-late">지각 {item.lateCount}</span>
                </div>
              </DataRow>
            ))}
          </div>
        </div>

        {dashboard.riskMembers.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-bold">주의 대상</h2>
            </div>
            <div className="space-y-2">
              {dashboard.riskMembers.map(member => (
                <DataRow
                  key={member.id}
                  className="flex items-center justify-between gap-3"
                  onClick={() => navigate(`/admin/members/${member.id}`)}
                >
                  <span className="text-sm font-semibold">{member.full_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums font-bold">{member.summary.demerit_points}점</span>
                    <StatusPill tone={member.summary.risk_state === 'withdrawal' ? 'danger' : 'warning'}>
                      {member.summary.risk_state === 'withdrawal' ? '탈회' : '면담'}
                    </StatusPill>
                  </div>
                </DataRow>
              ))}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
