import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Pencil, ChevronRight, Trash2, CalendarDays, Radio, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';

const statusLabel: Record<string, string> = {
  draft: '임시', scheduled: '예정', open: '진행 중', closed: '종료', archived: '보관',
};

export default function AdminSessions() {
  const { sessions, deleteSession } = useApp();
  const navigate = useNavigate();
  

  const activeSessions = [...sessions.filter(s => s.status !== 'closed')]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  const closedSessions = [...sessions.filter(s => s.status === 'closed')]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  const openCount = sessions.filter(session => session.status === 'open').length;
  const scheduledCount = sessions.filter(session => session.status === 'scheduled').length;

  const renderSession = (s: typeof sessions[0], dimmed = false) => (
    <DataRow
      key={s.id}
      className={`flex items-center justify-between gap-3 ${
        dimmed
          ? 'bg-muted/50 opacity-70 hover:opacity-90'
          : ''
      }`}
      onClick={() => navigate(`/admin/sessions/${s.id}`)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${dimmed ? 'text-muted-foreground' : ''}`}>{s.title}</span>
          <StatusPill tone={s.status === 'open' ? 'success' : s.status === 'scheduled' ? 'accent' : 'neutral'}>
            {statusLabel[s.status]}
          </StatusPill>
          {s.status === 'open' && <span className="w-2 h-2 rounded-full bg-status-present animate-pulse-dot" />}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(s.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            {' '}
            {new Date(s.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 ml-2">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/sessions/${s.id}/edit`); }}
          className="app-focus-ring p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="세션 수정"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`"${s.title}" 세션을 삭제하시겠습니까?`)) {
              deleteSession(s.id);
              toast.success('세션이 삭제되었습니다.');
            }
          }}
          className="app-focus-ring p-2 rounded-lg hover:bg-destructive/10 transition-colors"
          aria-label="세션 삭제"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      </div>
    </DataRow>
  );

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="세션"
        description="출석 오픈, 일정 생성, 종료 세션 확인을 한 흐름에서 처리합니다."
        actions={
        <Button size="sm" onClick={() => navigate('/admin/sessions/new')} className="bg-primary text-primary-foreground active:scale-[0.97]">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> 세션 생성
        </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <MetricCard label="전체" value={sessions.length} icon={CalendarDays} />
        <MetricCard label="진행 중" value={openCount} icon={Radio} tone={openCount > 0 ? 'success' : 'default'} />
        <MetricCard label="예정" value={scheduledCount} icon={Clock} tone="accent" />
      </div>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '100ms' }}>
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-extrabold">예정/진행 세션</h2>
        </div>
        <div className="space-y-2 p-3">
          {activeSessions.map(s => renderSession(s))}
          {activeSessions.length === 0 && (
            <EmptyState icon={CalendarDays} title="예정된 세션이 없습니다" description="세션 생성을 눌러 다음 주차를 등록하세요." />
          )}
        </div>
      </Surface>

      {closedSessions.length > 0 && (
        <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-extrabold">종료된 세션</h2>
          </div>
          <div className="space-y-2 p-3">
            {closedSessions.map(s => renderSession(s, true))}
          </div>
        </Surface>
      )}
    </PageShell>
  );
}
