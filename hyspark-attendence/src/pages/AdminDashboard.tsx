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
  Play,
  Plus,
  UserX,
  Users,
} from 'lucide-react';
import type { AttendanceRecord, MemberWithSummary, Session } from '@/types';
import {
  DataRow,
  EmptyState,
  MetricCard,
  PageHeader,
  PageShell,
  Panel,
  SectionHeader,
  StatGrid,
  StatusPill,
} from '@/components/app-ui';

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
    return { rows: [], excusedCount: 0, unexcusedCount: 0 };
  }

  const activeMemberIds = new Set(members.map(member => member.id));
  const rows = records
    .filter(
      record =>
        record.session_id === session.id &&
        activeMemberIds.has(record.member_id) &&
        preAbsenceStatuses.has(record.status),
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
    const present = sessionRecords.filter(record => record.status === 'present').length;
    const late = sessionRecords.filter(record => record.status === 'late').length;
    const absentMembers = members
      .map(member => {
        const record = sessionRecords.find(r => r.member_id === member.id);
        if (!record) return { member, status: 'missing' as const };
        if (absentStatuses.has(record.status)) return { member, status: record.status };
        return null;
      })
      .filter(Boolean) as { member: MemberWithSummary; status: string }[];

    const absent = absentMembers.length;
    const attendanceRate = members.length > 0 ? Math.round(((present + late) / members.length) * 100) : 0;

    return { session, present, late, absent, absentMembers, attendanceRate };
  });
}

export default function AdminDashboard() {
  const { members, sessions, attendanceRecords, openCheckIn } = useApp();
  const navigate = useNavigate();

  const dashboard = useMemo(() => {
    const activeMembers = members.filter(member => member.status === 'active');
    const totalMembers = activeMembers.length;
    const riskMembers = activeMembers.filter(member => member.summary.risk_state !== 'stable');
    const closedSessions = sessions
      .filter(session => session.status === 'closed')
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    const recentClosedSessions = closedSessions.slice(0, 4);
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

    const todaySession =
      sessions.find(session => session.status === 'open') ||
      sessions
        .filter(session => session.status === 'scheduled')
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

    const todayRecords = todaySession
      ? attendanceRecords.filter(record => record.session_id === todaySession.id)
      : [];
    const todayPresent = todayRecords.filter(record => record.status === 'present').length;
    const todayLate = todayRecords.filter(record => record.status === 'late').length;
    const todayNotCheckedIn = Math.max(totalMembers - todayRecords.length, 0);
    const preAbsence = buildPreAbsenceRows(todaySession, activeMembers, attendanceRecords);

    const avgRate =
      closedSessions.length > 0
        ? closedSessions.reduce((sum, session) => {
            const sessionRecords = attendanceRecords.filter(record => record.session_id === session.id);
            const presentOrLate = sessionRecords.filter(
              record => record.status === 'present' || record.status === 'late',
            ).length;
            return sum + (totalMembers > 0 ? presentOrLate / totalMembers : 0);
          }, 0) / closedSessions.length
        : 0;

    const nextScheduledSession = sessions
      .filter(session => session.status === 'scheduled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

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
    };
  }, [attendanceRecords, members, sessions]);

  const exportCSV = () => {
    const header = '이름,출석,지각,결석,벌점,상태\n';
    const rows = members
      .map(
        member =>
          `${member.full_name},${member.summary.present},${member.summary.late},${member.summary.absent},${member.summary.demerit_points},${member.summary.risk_state}`,
      )
      .join('\n');
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
        description="오늘 세션 출석 현황과 운영 리스크를 한눈에 확인합니다."
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/admin/sessions/new')} className="rounded-xl">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> 세션 생성
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/members')} className="rounded-xl">
              <Users className="mr-1.5 h-3.5 w-3.5" /> 멤버
            </Button>
            <Button size="sm" variant="outline" onClick={exportCSV} className="rounded-xl">
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          </>
        }
      />

      <StatGrid>
        <MetricCard label="활성 멤버" value={dashboard.totalMembers} icon={Users} />
        <MetricCard
          label="평균 출석률"
          value={`${Math.round(dashboard.avgRate * 100)}%`}
          icon={BarChart3}
          tone="accent"
        />
        <MetricCard
          label="주의 대상"
          value={dashboard.riskMembers.length}
          icon={AlertTriangle}
          tone={dashboard.riskMembers.length > 0 ? 'warning' : 'default'}
          onClick={() => dashboard.riskMembers.length > 0 && navigate('/admin/members')}
        />
        <MetricCard
          label="최근 결석"
          value={dashboard.recentAbsenceCount}
          icon={UserX}
          tone={dashboard.recentAbsenceCount > 0 ? 'danger' : 'success'}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {dashboard.todaySession ? (
          <Panel
            title={dashboard.todaySession.status === 'open' ? '진행 중인 세션' : '다음 세션'}
            icon={Clock}
            action={
              <div className="flex gap-2">
                {dashboard.todaySession.status === 'scheduled' && (
                  <Button
                    size="sm"
                    onClick={() => openCheckIn(dashboard.todaySession!.id)}
                    className="rounded-xl"
                  >
                    <Play className="mr-1 h-3.5 w-3.5" /> 출결 시작
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/admin/sessions/${dashboard.todaySession!.id}`)}
                  className="rounded-xl"
                >
                  상세
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  {dashboard.todaySession.status === 'open' && (
                    <StatusPill tone="success">출석 오픈</StatusPill>
                  )}
                  {dashboard.todaySession.status === 'scheduled' && (
                    <StatusPill tone="neutral">예정</StatusPill>
                  )}
                </div>
                <h2 className="text-xl font-extrabold tracking-tight">{dashboard.todaySession.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatSessionTime(dashboard.todaySession)}</p>
                {dashboard.todaySession.venue_name && (
                  <p className="mt-1 text-sm font-medium text-foreground/80">{dashboard.todaySession.venue_name}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '출석', value: dashboard.todayPresent, tone: 'text-status-present' },
                  { label: '지각', value: dashboard.todayLate, tone: 'text-status-late' },
                  { label: '미체크', value: dashboard.todayNotCheckedIn, tone: 'text-status-absent' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-secondary/60 px-3 py-3 text-center">
                    <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
                    <p className={`mt-1 text-2xl font-extrabold tabular-nums ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-secondary/45 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-muted-foreground">사전 결석 신청</p>
                  <div className="flex gap-1.5">
                    <StatusPill tone="accent">인정 {dashboard.preAbsence.excusedCount}</StatusPill>
                    <StatusPill tone="danger">미인정 {dashboard.preAbsence.unexcusedCount}</StatusPill>
                  </div>
                </div>
                {dashboard.preAbsence.rows.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {dashboard.preAbsence.rows.slice(0, 5).map(record => (
                      <span
                        key={record.id}
                        className="rounded-lg bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/85"
                      >
                        {record.member_name} · {record.status === 'unexcused_absent' ? '미인정' : '인정'}
                      </span>
                    ))}
                    {dashboard.preAbsence.rows.length > 5 && (
                      <span className="rounded-lg bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        외 {dashboard.preAbsence.rows.length - 5}명
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">아직 신청 없음</p>
                )}
              </div>
            </div>
          </Panel>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="예정된 세션이 없습니다"
            description="새 세션을 만들어 출석 운영을 시작하세요."
            action={
              <Button onClick={() => navigate('/admin/sessions/new')} className="rounded-xl">
                <Plus className="mr-1.5 h-4 w-4" /> 세션 생성
              </Button>
            }
          />
        )}

        <Panel title="자동 출석 오픈" icon={CalendarClock} description="다음 예정 세션의 자동 오픈 설정">
          {dashboard.nextScheduledSession ? (
            <div className="space-y-3">
              <div>
                <p className="text-base font-bold">{dashboard.nextScheduledSession.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatSessionTime(dashboard.nextScheduledSession)}
                </p>
              </div>
              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground/85">
                시작{' '}
                <span className="font-bold text-primary">
                  {dashboard.nextScheduledSession.check_in_open_minutes}분 전
                </span>{' '}
                자동 오픈
                {dashboard.nextScheduledSession.check_in_open_minutes === 0 && (
                  <span className="font-semibold"> · 시작 정각 오픈</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => navigate(`/admin/sessions/${dashboard.nextScheduledSession!.id}/edit`)}
              >
                설정 수정
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">예정된 세션이 없습니다.</p>
          )}
        </Panel>
      </div>

      <section>
        <SectionHeader
          title="최근 주차 결석자"
          icon={UserX}
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/sessions')} className="h-8 rounded-lg px-2 text-xs">
              세션 보기
            </Button>
          }
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.absenceRows.length === 0 && (
            <EmptyState title="종료된 세션이 아직 없습니다" description="세션이 종료되면 최근 결석자 흐름이 표시됩니다." />
          )}
          {dashboard.absenceRows.map(row => (
            <DataRow key={row.session.id} onClick={() => navigate(`/admin/sessions/${row.session.id}`)} chevron>
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{row.session.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatSessionTime(row.session)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    row.absent > 0
                      ? 'border-status-absent text-status-absent'
                      : 'border-status-present text-status-present'
                  }
                >
                  출석률 {row.attendanceRate}%
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 pr-6">
                {row.absentMembers.length === 0 ? (
                  <span className="text-xs font-medium text-status-present">전원 출석/지각 기록 있음</span>
                ) : (
                  row.absentMembers.slice(0, 6).map(item => (
                    <span
                      key={`${row.session.id}-${item.member.id}`}
                      className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive"
                    >
                      {item.member.full_name} · {statusLabel[item.status]}
                    </span>
                  ))
                )}
                {row.absentMembers.length > 6 && (
                  <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    외 {row.absentMembers.length - 6}명
                  </span>
                )}
              </div>
            </DataRow>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader title="결석/지각 누적" icon={BarChart3} />
          <div className="space-y-2">
            {dashboard.frequentAbsentees.length === 0 && (
              <EmptyState title="누적 결석 또는 지각이 없습니다" description="별도 확인이 필요한 멤버가 없습니다." />
            )}
            {dashboard.frequentAbsentees.map(item => (
              <DataRow
                key={item.member.id}
                onClick={() => navigate(`/admin/members/${item.member.id}`)}
                chevron
                className="flex items-center justify-between gap-3 pr-8"
              >
                <div>
                  <p className="text-sm font-semibold">{item.member.full_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    최근 {item.recentMisses}회 미출석 · 벌점 {item.member.summary.demerit_points}
                  </p>
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
            <SectionHeader title="주의 대상" icon={AlertTriangle} />
            <div className="space-y-2">
              {dashboard.riskMembers.map(member => (
                <DataRow
                  key={member.id}
                  className="flex items-center justify-between gap-3 pr-8"
                  onClick={() => navigate(`/admin/members/${member.id}`)}
                  chevron
                >
                  <span className="text-sm font-semibold">{member.full_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">{member.summary.demerit_points}점</span>
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
