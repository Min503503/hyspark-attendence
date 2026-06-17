import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminReports() {
  const { members, sessions } = useApp();
  const navigate = useNavigate();

  const sorted = [...members].sort((a, b) => b.summary.demerit_points - a.summary.demerit_points);

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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between animate-reveal-up">
        <h1 className="text-2xl font-extrabold tracking-tight">리포트</h1>
        <Button size="sm" variant="outline" onClick={exportCSV} className="active:scale-[0.97]">
          <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
        </Button>
      </div>

      {/* Member ranking */}
      <div className="animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">벌점 순 정렬</h2>
        <div className="space-y-2">
          {sorted.map(m => (
            <div
              key={m.id}
              onClick={() => navigate(`/admin/members/${m.id}`)}
              className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow active:scale-[0.995]"
            >
              <div>
                <span className="text-sm font-semibold">{m.full_name}</span>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>출석 {m.summary.present}</span>
                  <span>지각 {m.summary.late}</span>
                  <span>결석 {m.summary.absent}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold tabular-nums">{m.summary.demerit_points}점</span>
                {m.summary.risk_state !== 'stable' && (
                  <Badge variant="outline" className={`text-[10px] ${
                    m.summary.risk_state === 'withdrawal' ? 'border-destructive text-destructive' : 'border-warning text-warning'
                  }`}>
                    {m.summary.risk_state === 'withdrawal' ? '탈회' : '면담'}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session rates */}
      {sessions.filter(s => s.attendance_rate != null).length > 0 && (
        <div className="animate-reveal-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">세션별 출석률</h2>
          <div className="space-y-2">
            {sessions.filter(s => s.attendance_rate != null).map(s => (
              <div key={s.id} className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{s.title}</span>
                <span className="text-sm font-bold tabular-nums">{Math.round((s.attendance_rate || 0) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
