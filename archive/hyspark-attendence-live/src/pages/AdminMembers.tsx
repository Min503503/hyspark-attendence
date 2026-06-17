import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { MemberWithSummary } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, UserPlus, ChevronRight, Users, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';

export default function AdminMembers() {
  const { members, addMember, deleteMember } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCohort, setNewCohort] = useState('HySpark 5th');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = members.filter(m =>
    m.full_name.includes(search) || m.cohort_label?.includes(search)
  );
  const activeCount = members.filter(member => member.status === 'active').length;
  const riskCount = members.filter(member => member.summary.risk_state !== 'stable').length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addMember({ full_name: newName, cohort_label: newCohort });
    toast.success(`${newName} 님이 추가되었습니다.`);
    setNewName('');
    setDialogOpen(false);
  };

  const handleDelete = async (member: MemberWithSummary) => {
    const confirmed = window.confirm(
      `${member.full_name} 멤버를 삭제하시겠습니까?\n\n이 멤버의 기존 출결 기록도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    setDeletingId(member.id);
    const success = await deleteMember(member.id);
    setDeletingId(null);

    if (success) {
      toast.success(`${member.full_name} 멤버가 삭제되었습니다.`);
    } else {
      toast.error('멤버 삭제에 실패했습니다.');
    }
  };

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="멤버 관리"
        description="학회원 출결 상태와 벌점 흐름을 한 화면에서 확인합니다."
        actions={
        <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground active:scale-[0.97]">
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> 추가
        </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <MetricCard label="전체" value={members.length} icon={Users} />
        <MetricCard label="활성" value={activeCount} tone="success" />
        <MetricCard label="주의" value={riskCount} icon={AlertTriangle} tone={riskCount > 0 ? 'warning' : 'default'} />
      </div>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '100ms' }}>
        <div className="border-b border-border/60 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 bg-secondary/40 pl-9" placeholder="이름 또는 기수 검색" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 p-3">
          {filtered.map(m => (
            <DataRow key={m.id} className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate(`/admin/members/${m.id}`)}
                className="app-focus-ring min-w-0 flex-1 rounded-lg text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{m.full_name}</span>
                  {m.summary.risk_state === 'withdrawal' && <StatusPill tone="danger">탈회</StatusPill>}
                  {m.summary.risk_state === 'counseling' && <StatusPill tone="warning">면담</StatusPill>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>출석 <strong className="text-status-present">{m.summary.present}</strong></span>
                  <span>지각 <strong className="text-status-late">{m.summary.late}</strong></span>
                  <span>결석 <strong className="text-status-absent">{m.summary.absent}</strong></span>
                  <span>벌점 <strong className="text-foreground">{m.summary.demerit_points}</strong></span>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  disabled={deletingId === m.id}
                  className="app-focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-60"
                  aria-label={`${m.full_name} 삭제`}
                >
                  {deletingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </DataRow>
          ))}
          {filtered.length === 0 && (
            <EmptyState title="검색 결과가 없습니다" description="이름 또는 기수를 다시 확인해주세요." />
          )}
        </div>
      </Surface>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>멤버 추가</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label>기수</Label>
              <Input value={newCohort} onChange={e => setNewCohort(e.target.value)} placeholder="HySpark 5th" />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground active:scale-[0.97]">추가</Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
