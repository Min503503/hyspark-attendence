import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';

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
  const { members, sessions, getMemberRecords, updateMember, overrideAttendance } = useApp();

  const member = members.find(m => m.id === id);
  const records = getMemberRecords(id || '');

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCohort, setEditCohort] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  // Override state
  const [overrideRecordId, setOverrideRecordId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('present');
  const [overrideReason, setOverrideReason] = useState('');

  if (!member) return <div className="p-8 text-center text-muted-foreground">멤버를 찾을 수 없습니다.</div>;

  const openEdit = () => {
    setEditName(member.full_name);
    setEditCohort(member.cohort_label || '');
    setEditStatus(member.status as 'active' | 'inactive');
    setEditOpen(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    await updateMember(member.id, { full_name: editName, cohort_label: editCohort, status: editStatus });
    toast.success('멤버 정보가 수정되었습니다.');
    setEditOpen(false);
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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="animate-reveal-up">
        <button onClick={() => navigate('/admin/members')} className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 멤버 목록
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold">{member.full_name}</h1>
              {member.summary.risk_state === 'withdrawal' && <Badge variant="outline" className="border-destructive text-destructive">탈회 대상</Badge>}
              {member.summary.risk_state === 'counseling' && <Badge variant="outline" className="border-warning text-warning">면담 대상</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{member.cohort_label}</p>
          </div>
          <Button variant="outline" size="sm" onClick={openEdit} className="active:scale-[0.97]">
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> 수정
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        {[
          { label: '출석', value: member.summary.present, color: 'text-status-present' },
          { label: '지각', value: member.summary.late, color: 'text-status-late' },
          { label: '결석', value: member.summary.absent, color: 'text-status-absent' },
          { label: '벌점', value: member.summary.demerit_points, color: 'text-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/60 p-3 text-center shadow-sm">
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-xl font-extrabold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Per-session attendance */}
      <div className="animate-reveal-up" style={{ animationDelay: '120ms' }}>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">세션별 출결 현황</h2>
        <div className="space-y-2">
          {sortedSessions.map(session => {
            const record = records.find(r => r.session_id === session.id);
            return (
              <div key={session.id} className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{session.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    {record?.checked_in_at && ` · ${new Date(record.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 체크인`}
                    {record?.exception_category && ` · ${record.exception_category}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
                        className="p-1 rounded hover:bg-secondary transition-colors"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-md border border-border bg-muted">미기록</span>
                  )}
                </div>
              </div>
            );
          })}
          {sortedSessions.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">세션이 없습니다.</div>
          )}
        </div>
      </div>

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
    </div>
  );
}
