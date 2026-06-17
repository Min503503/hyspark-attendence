import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Pencil, Trash2, CalendarDays, Radio, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, Panel, StatGrid, StatusPill } from '@/components/app-ui';

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
      className={`relative flex items-center justify-between gap-3 ${
        dimmed
          ? 'bg-muted/50 opacity-70 hover:opacity-90'
          : ''
      }`}
      onClick={() => navigate(`/admin/sessions/${s.id}`)}
      chevron
    >
      <div className="min-w-0 flex-1 pr-8">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-bold ${dimmed ? 'text-muted-foreground' : ''}`}>{s.title}</span>
          <StatusPill tone={s.status === 'open' ? 'success' : s.status === 'scheduled' ? 'accent' : 'neutral'}>
            {statusLabel[s.status]}
          </StatusPill>
          {s.status === 'open' && <span className="h-2 w-2 rounded-full bg-status-present animate-pulse-dot" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(s.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            {' '}
            {new Date(s.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {s.venue_name && <span className="truncate">{s.venue_name}</span>}
        </div>
      </div>
      <div className="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
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
      </div>
    </DataRow>
  );

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="세션"
        description="출석 오픈, 일정 생성, 종료 세션 확인을 한 흐름에서 처리합니다."
        actions={
        <Button size="sm" onClick={() => navigate('/admin/sessions/new')} className="rounded-xl">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> 세션 생성
        </Button>
        }
      />

      <StatGrid className="grid-cols-3">
        <MetricCard label="전체" value={sessions.length} icon={CalendarDays} />
        <MetricCard label="진행 중" value={openCount} icon={Radio} tone={openCount > 0 ? 'success' : 'default'} />
        <MetricCard label="예정" value={scheduledCount} icon={Clock} tone="accent" />
      </StatGrid>

      <Panel title="예정/진행 세션" icon={CalendarDays}>
        <div className="space-y-2">
          {activeSessions.map(s => renderSession(s))}
          {activeSessions.length === 0 && (
            <EmptyState icon={CalendarDays} title="예정된 세션이 없습니다" description="세션 생성을 눌러 다음 주차를 등록하세요." />
          )}
        </div>
      </Panel>

      {closedSessions.length > 0 && (
        <Panel title="종료된 세션" icon={Archive}>
          <div className="space-y-2">
            {closedSessions.map(s => renderSession(s, true))}
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
