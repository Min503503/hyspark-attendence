import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, TrendingUp, Plus, Play, Clock, Download } from 'lucide-react';

export default function AdminDashboard() {
  const { sessions, members, attendanceRecords, openCheckIn } = useApp();
  const navigate = useNavigate();

  const activeMembers = members.filter(m => m.status === 'active');
  const totalMembers = activeMembers.length;

  const todaySession = sessions.find(s => s.status === 'open') || sessions.find(s => s.status === 'scheduled');
  const todayRecords = todaySession ? attendanceRecords.filter(r => r.session_id === todaySession.id) : [];
  const todayPresent = todayRecords.filter(r => r.status === 'present').length;
  const todayLate = todayRecords.filter(r => r.status === 'late').length;

  const riskMembers = members.filter(m => m.summary.risk_state !== 'stable');

  // Compute average attendance rate from actual records
  const closedSessions = sessions.filter(s => s.status === 'closed');
  const avgRate = closedSessions.length > 0
    ? closedSessions.reduce((sum, s) => {
        const sessionRecords = attendanceRecords.filter(r => r.session_id === s.id);
        const presentCount = sessionRecords.filter(r => r.status === 'present').length;
        return sum + (sessionRecords.length > 0 ? presentCount / sessionRecords.length : 0);
      }, 0) / closedSessions.length
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-reveal-up">
        <h1 className="text-2xl font-extrabold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-0.5">HySpark 5th · 2026 Spring</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        {[
          { label: '학회원', value: totalMembers, icon: Users, color: 'text-foreground' },
          { label: '평균 출석률', value: `${Math.round(avgRate * 100)}%`, icon: TrendingUp, color: 'text-status-present' },
          { label: '주의 대상', value: riskMembers.length, icon: AlertTriangle, color: riskMembers.length > 0 ? 'text-warning' : 'text-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className={`text-2xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Today's session */}
      {todaySession && (
        <div className="animate-reveal-up bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden" style={{ animationDelay: '120ms' }}>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {todaySession.status === 'open' ? '진행 중' : '다음 세션'}
                </span>
                {todaySession.status === 'open' && <span className="w-2 h-2 rounded-full bg-status-present animate-pulse-dot" />}
              </div>
              <h3 className="font-bold text-lg">{todaySession.title}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {new Date(todaySession.start_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {todaySession.status === 'open' && (
                <p className="text-xs text-muted-foreground mt-1">
                  출석 {todayPresent} · 지각 {todayLate} · 미체크인 {totalMembers - todayRecords.length}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {todaySession.status === 'scheduled' && (
                <Button size="sm" onClick={() => openCheckIn(todaySession.id)} className="bg-accent text-accent-foreground active:scale-[0.97]">
                  <Play className="w-3.5 h-3.5 mr-1" /> 출결 시작
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/sessions/${todaySession.id}`)} className="active:scale-[0.97]">
                상세
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Risk members */}
      {riskMembers.length > 0 && (
        <div className="animate-reveal-up" style={{ animationDelay: '180ms' }}>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">주의 대상</h2>
          <div className="space-y-2">
            {riskMembers.map(m => (
              <div key={m.id}
                className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow active:scale-[0.995]"
                onClick={() => navigate(`/admin/members/${m.id}`)}
              >
                <span className="text-sm font-semibold">{m.full_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums font-bold">{m.summary.demerit_points}점</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    m.summary.risk_state === 'withdrawal' ? 'border-destructive text-destructive' : 'border-warning text-warning'
                  }`}>
                    {m.summary.risk_state === 'withdrawal' ? '탈회' : '면담'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 animate-reveal-up" style={{ animationDelay: '240ms' }}>
        <Button variant="outline" onClick={() => navigate('/admin/sessions/new')} className="active:scale-[0.97]">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> 세션 생성
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/members')} className="active:scale-[0.97]">
          <Users className="w-3.5 h-3.5 mr-1.5" /> 멤버 관리
        </Button>
        <Button variant="outline" onClick={() => {
          const header = '이름,출석,지각,결석,벌점,상태\n';
          const rows = members.map(m =>
            `${m.full_name},${m.summary.present},${m.summary.late},${m.summary.absent},${m.summary.demerit_points},${m.summary.risk_state}`
          ).join('\n');
          const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'spark_attendance_report.csv'; a.click();
          URL.revokeObjectURL(url);
        }} className="active:scale-[0.97]">
          <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
        </Button>
      </div>
    </div>
  );
}
