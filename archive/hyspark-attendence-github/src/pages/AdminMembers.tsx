import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { MemberWithSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMembers() {
  const { members, addMember } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCohort, setNewCohort] = useState('HySpark 5th');

  const filtered = members.filter(m =>
    m.full_name.includes(search) || m.cohort_label?.includes(search)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addMember({ full_name: newName, cohort_label: newCohort });
    toast.success(`${newName} 님이 추가되었습니다.`);
    setNewName('');
    setDialogOpen(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between animate-reveal-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">멤버 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">총 {members.length}명</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground active:scale-[0.97]">
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> 추가
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Member list */}
      <div className="space-y-2 animate-reveal-up" style={{ animationDelay: '120ms' }}>
        {filtered.map(m => (
          <div
            key={m.id}
            onClick={() => navigate(`/admin/members/${m.id}`)}
            className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3.5 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow active:scale-[0.995]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{m.full_name}</span>
                {m.summary.risk_state === 'withdrawal' && (
                  <Badge variant="outline" className="border-destructive text-destructive text-[10px]">탈회</Badge>
                )}
                {m.summary.risk_state === 'counseling' && (
                  <Badge variant="outline" className="border-warning text-warning text-[10px]">면담</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>출석 <strong className="text-status-present">{m.summary.present}</strong></span>
                <span>지각 <strong className="text-status-late">{m.summary.late}</strong></span>
                <span>결석 <strong className="text-status-absent">{m.summary.absent}</strong></span>
                <span>벌점 <strong className="text-foreground">{m.summary.demerit_points}</strong></span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</div>
        )}
      </div>

      {/* Add dialog */}
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
    </div>
  );
}
