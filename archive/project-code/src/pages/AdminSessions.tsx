import { useApp } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Pencil, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const renderSession = (s: typeof sessions[0], dimmed = false) => (
    <div
      key={s.id}
      className={`rounded-xl border shadow-sm px-4 py-3.5 flex items-center justify-between cursor-pointer transition-shadow active:scale-[0.995] ${
        dimmed
          ? 'bg-muted/50 border-border/40 opacity-60 hover:opacity-80'
          : 'bg-card border-border/60 hover:shadow-md'
      }`}
      onClick={() => navigate(`/admin/sessions/${s.id}`)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${dimmed ? 'text-muted-foreground' : ''}`}>{s.title}</span>
          <Badge variant="outline" className={`text-[10px] ${
            s.status === 'open' ? 'border-status-present text-status-present' : ''
          }`}>
            {statusLabel[s.status]}
          </Badge>
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
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
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
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between animate-reveal-up">
        <h1 className="text-2xl font-extrabold tracking-tight">세션</h1>
        <Button size="sm" onClick={() => navigate('/admin/sessions/new')} className="bg-primary text-primary-foreground active:scale-[0.97]">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> 세션 생성
        </Button>
      </div>

      {/* Active sessions */}
      <div className="space-y-2 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        {activeSessions.map(s => renderSession(s))}
        {activeSessions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">예정된 세션이 없습니다.</div>
        )}
      </div>

      {/* Closed sessions */}
      {closedSessions.length > 0 && (
        <div className="space-y-2 animate-reveal-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] font-medium text-muted-foreground/60 shrink-0">종료된 세션</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          {closedSessions.map(s => renderSession(s, true))}
        </div>
      )}
    </div>
  );
}
