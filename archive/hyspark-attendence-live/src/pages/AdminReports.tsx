import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';

export default function AdminReports() {
  const { members, sessions } = useApp();
  const navigate = useNavigate();

  const sorted = [...members].sort((a, b) => b.summary.demerit_points - a.summary.demerit_points);
  const averageDemerit = members.length > 0
    ? (members.reduce((sum, member) => sum + member.summary.demerit_points, 0) / members.length).toFixed(1)
    : '0';
  const ratedSessions = sessions.filter(s => s.attendance_rate != null);
  const avgRate = ratedSessions.length > 0
    ? Math.round(ratedSessions.reduce((sum, session) => sum + (session.attendance_rate || 0), 0) / ratedSessions.length * 100)
    : 0;

  const exportCSV = () => {
    const header = '이름,출석,지각,결석,벌점,상태\n';
    const rows = members.map(m =>
      `${m.full_name},${m.summary.present},${m.summary.late},${m.summary.absent},${m.summary.demerit_points},${m.summary.risk_state}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'spark_attendance_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="리포트"
        description="벌점, 출석률, 세션별 흐름을 운영 회고용으로 정리합니다."
        actions={
        <Button size="sm" variant="outline" onClick={exportCSV} className="active:scale-[0.97]">
          <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
        </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <MetricCard label="멤버" value={members.length} icon={Users} />
        <MetricCard label="평균 벌점" value={averageDemerit} icon={BarChart3} tone={Number(averageDemerit) > 0 ? 'warning' : 'default'} />
        <MetricCard label="세션 평균" value={`${avgRate}%`} icon={TrendingUp} tone="success" />
      </div>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '100ms' }}>
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-extrabold">벌점 순 정렬</h2>
        </div>
        <div className="space-y-2 p-3">
          {sorted.map(m => (
            <DataRow
              key={m.id}
              onClick={() => navigate(`/admin/members/${m.id}`)}
              className="flex items-center justify-between gap-3"
            >
              <div>
                <span className="text-sm font-bold">{m.full_name}</span>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>출석 {m.summary.present}</span>
                  <span>지각 {m.summary.late}</span>
                  <span>결석 {m.summary.absent}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold tabular-nums">{m.summary.demerit_points}점</span>
                {m.summary.risk_state === 'withdrawal' && <StatusPill tone="danger">탈회</StatusPill>}
                {m.summary.risk_state === 'counseling' && <StatusPill tone="warning">면담</StatusPill>}
              </div>
            </DataRow>
          ))}
        </div>
      </Surface>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '140ms' }}>
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-extrabold">세션별 출석률</h2>
        </div>
        <div className="space-y-2 p-3">
          {ratedSessions.length > 0 ? (
            ratedSessions.map(s => (
              <DataRow key={s.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold">{s.title}</span>
                <div className="flex min-w-32 items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((s.attendance_rate || 0) * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-bold tabular-nums">{Math.round((s.attendance_rate || 0) * 100)}%</span>
                </div>
              </DataRow>
            ))
          ) : (
            <EmptyState title="출석률이 기록된 세션이 없습니다" description="세션을 종료하면 출석률 리포트가 표시됩니다." />
          )}
        </div>
      </Surface>
    </PageShell>
  );
}
