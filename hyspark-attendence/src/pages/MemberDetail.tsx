import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { AttendanceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarDays, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';

const statusLabel: Record<string, string> = {
  present: '출석', late: '지각', absent: '결석', excused_absent: '인정 결석', unexcused_absent: '미인정 결석',
};
const statusColor: Record<string, string> = {
  present: 'text-status-present border-status-present/30 bg-status-present/10',
  late: 'text-status-late border-status-late/30 bg-status-late/10',
  absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
  excused_absent: 'text-muted-foreground border-border bg-muted',
  unexcused_absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
};

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { members, sessions, getMemberRecords, updateMember, deleteMember, overrideAttendance } = useApp();

  const member = members.find(m => m.id === id);
  const records = getMemberRecords(id || '');

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCohort, setEditCohort] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [deleting, setDeleting] = useState(false);

  // Override state
  const [overrideRecordId, setOverrideRecordId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState('');

  if (!member) return (
    <PageShell size="md">
      <EmptyState title="멤버를 찾을 수 없습니다" description="목록으로 돌아가 다시 선택해주세요." />
    </PageShell>
  );

  const openEdit = () => {
    setEditName(member.full_name);
    setEditCohort(member.cohort_label || '');
    setEditEmail(member.email || '');
    setEditStatus(member.status as 'active' | 'inactive');
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMember(member.id, { full_name: editName, cohort_label: editCohort, email: editEmail.trim(), status: editStatus });
    toast.success('멤버 정보가 수정되었습니다.');
    setEditOpen(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `${member.full_name} 멤버를 삭제하시겠습니까?\n\n이 멤버의 기존 출결 기록도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const success = await deleteMember(member.id);
    setDeleting(false);

    if (success) {
      toast.success(`${member.full_name} 멤버가 삭제되었습니다.`);
      navigate('/admin/members');
    } else {
      toast.error('멤버 삭제에 실패했습니다.');
    }
  };

  const handleOverride = async () => {
    if (!overrideRecordId) return;
    await overrideAttendance(overrideRecordId, overrideStatus, overrideReason);
    setOverrideRecordId(null);
    setOverrideReason('');
    toast.success('출결 상태가 수정되었습니다.');
  };

  // Build per-session rows (show all sessions, mark status)
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title={member.full_name}
        description={
            <span className="flex flex-wrap items-center gap-2">
              <span>{member.cohort_label}</span>
              {member.email && <span>{member.email}</span>}
              {member.summary.risk_state === 'withdrawal' && <StatusPill tone="danger">탈회 대상</StatusPill>}
              {member.summary.risk_state === 'counseling' && <StatusPill tone="warning">면담 대상</StatusPill>}
            </span>
        }
        back={
          <button onClick={() => navigate('/admin/members')} className="app-focus-ring flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> 멤버 목록
          </button>
        }
        actions={
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openEdit} className="active:scale-[0.97]">
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> 수정
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
            삭제
          </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        {[
          { label: '출석', value: member.summary.present, tone: 'success' as const },
          { label: '지각', value: member.summary.late, tone: 'warning' as const },
          { label: '결석', value: member.summary.absent, tone: 'danger' as const },
          { label: '벌점', value: member.summary.demerit_points, tone: member.summary.demerit_points > 0 ? 'warning' as const : 'default' as const },
        ].map(s => (
          <MetricCard key={s.label} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>
      {(member.summary.camp_credit_total || 0) > 0 && (
        <p className="-mt-2 text-xs text-primary">
          캠프 참여 상쇄 -{(member.summary.camp_credit_total || 0).toFixed(2)}점 반영 (순 벌점 {member.summary.demerit_points}점)
        </p>
      )}

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-extrabold">세션별 출결 현황</h2>
        </div>
        <div className="space-y-2 p-3">
          {sortedSessions.map(session => {
            const record = records.find(r => r.session_id === session.id);
            return (
              <DataRow key={session.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{session.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    {record?.checked_in_at && ` · ${new Date(record.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 체크인`}
                    {record?.exception_category && ` · ${record.exception_category}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {record ? (
                    <>
                      {record.demerit_points > 0 && (
                        <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">벌점 +{record.demerit_points}</span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${statusColor[record.status]}`}>
                        {statusLabel[record.status]}
                      </span>
                      <button
                        onClick={() => { setOverrideRecordId(record.id); setOverrideStatus(record.status); }}
                        className="app-focus-ring p-1.5 rounded-lg hover:bg-secondary transition-colors"
                        aria-label="출결 상태 수정"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-md border border-border bg-muted">미기록</span>
                  )}
                </div>
              </DataRow>
            );
          })}
          {sortedSessions.length === 0 && (
            <EmptyState title="세션이 없습니다" />
          )}
        </div>
      </Surface>

      {/* Edit member dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>멤버 수정</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>기수</Label>
              <Input value={editCohort} onChange={e => setEditCohort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <div className="space-y-2">
              <Label>상태</Label>
              <Select value={editStatus} onValueChange={v => setEditStatus(v as 'active' | 'inactive')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">휴면</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground active:scale-[0.97]">저장</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Override dialog */}
      <Dialog open={!!overrideRecordId} onOpenChange={open => { if (!open) setOverrideRecordId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>출결 상태 수정</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>변경 상태</Label>
              <Select value={overrideStatus} onValueChange={v => setOverrideStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">출석</SelectItem>
                  <SelectItem value="late">지각</SelectItem>
                  <SelectItem value="absent">결석</SelectItem>
                  <SelectItem value="excused_absent">인정 결석</SelectItem>
                  <SelectItem value="unexcused_absent">미인정 결석</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>수정 사유</Label>
              <Input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="사유 입력" />
            </div>
            <Button onClick={handleOverride} className="w-full bg-primary text-primary-foreground active:scale-[0.97]">저장</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
