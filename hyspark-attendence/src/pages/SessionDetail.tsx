import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { AttendanceRecord, AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Clock, RefreshCw, Play, Square, Info, UserPlus } from 'lucide-react';
import { EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';

const statusBg: Record<string, string> = {
  present: 'bg-status-present/10 text-status-present border-status-present/20',
  late: 'bg-status-late/10 text-status-late border-status-late/20',
  early_leave: 'bg-status-late/10 text-status-late border-status-late/20',
  absent: 'bg-status-absent/10 text-status-absent border-status-absent/20',
  excused_absent: 'bg-muted text-muted-foreground',
  unexcused_absent: 'bg-status-absent/10 text-status-absent border-status-absent/20',
};
const statusLabel: Record<string, string> = {
  present: '출석',
  late: '지각',
  early_leave: '조퇴',
  absent: '결석',
  excused_absent: '인정 결석',
  unexcused_absent: '미인정 결석',
};

const absentStatuses = new Set(['absent', 'excused_absent', 'unexcused_absent']);

type PendingAttendanceRecord = AttendanceRecord & { _pending: true };
type SessionAttendanceRow = AttendanceRecord | PendingAttendanceRecord;

function isPendingRecord(record: SessionAttendanceRow): record is PendingAttendanceRecord {
  return '_pending' in record;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessions, members, getSessionRecords, openCheckIn, closeCheckIn, regenerateCode, overrideAttendance, addManualRecord } = useApp();

  const session = sessions.find(s => s.id === id);
  const records = getSessionRecords(id || '');

  const [editRecord, setEditRecord] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editReason, setEditReason] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [addStatus, setAddStatus] = useState<AttendanceStatus>('present');

  if (!session) return (
    <PageShell size="md">
      <EmptyState title="세션을 찾을 수 없습니다" description="세션 목록으로 돌아가 다시 선택해주세요." />
    </PageShell>
  );

  const activeMembers = members.filter(m => m.role === 'member' && m.status === 'active');
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const earlyLeaveCount = records.filter(r => r.status === 'early_leave').length;
  const absentCount = records.filter(r => absentStatuses.has(r.status)).length;
  const attendanceRate = activeMembers.length > 0 ? Math.round(((presentCount + lateCount + earlyLeaveCount) / activeMembers.length) * 100) : 0;

  // Members not yet recorded for this session
  const recordedMemberIds = new Set(records.map(r => r.member_id));
  const unrecordedMembers = activeMembers.filter(m => !recordedMemberIds.has(m.id));

  // Build a combined list: existing records + unrecorded members as "미체크인"
  const allRows: SessionAttendanceRow[] = [
    ...records,
    ...unrecordedMembers.map(m => ({
      id: `pending-${m.id}`,
      session_id: id || '',
      member_id: m.id,
      member_name: m.full_name,
      status: 'absent' as AttendanceStatus,
      checked_in_at: null,
      check_in_method: 'manual' as const,
      code_verified: false,
      location_verified: false,
      demerit_points: 0,
      _pending: true,
    })),
  ];

  const handleOverride = async () => {
    if (editRecord) {
      await overrideAttendance(editRecord, editStatus, editReason);
      setEditRecord(null);
      setEditReason('');
    }
  };

  const handleAddRecord = async () => {
    if (addMemberId && id) {
      await addManualRecord(id, addMemberId, addStatus);
      setAddOpen(false);
      setAddMemberId('');
      setAddStatus('present');
    }
  };

  return (
    <PageShell size="lg" className="space-y-6">
      <PageHeader
        title={session.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(session.start_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <StatusPill tone={session.status === 'open' ? 'success' : session.status === 'scheduled' ? 'accent' : 'neutral'}>
              {session.status === 'open' ? '체크인 진행 중' : session.status === 'scheduled' ? '예정' : session.status === 'closed' ? '종료' : '보관'}
            </StatusPill>
          </span>
        }
        back={
          <button onClick={() => navigate('/admin/sessions')} className="app-focus-ring flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> 세션 목록
          </button>
        }
        actions={
          <>
            {(session.status === 'scheduled' || session.status === 'draft') && (
              <Button onClick={() => openCheckIn(session.id)} className="bg-accent text-accent-foreground active:scale-[0.97]">
                <Play className="w-3.5 h-3.5 mr-1" /> 수동 출결시작
              </Button>
            )}
            {session.status === 'open' && (
              <Button variant="outline" onClick={() => closeCheckIn(session.id)} className="active:scale-[0.97]">
                <Square className="w-3.5 h-3.5 mr-1" /> 출결 종료
              </Button>
            )}
          </>
        }
      />

      {session.status === 'open' && session.attendance_code && (
        <Surface className="animate-reveal-up border-accent/40 bg-accent/10 p-6" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1">활성 출결코드</p>
                <p className="text-5xl font-extrabold tracking-[0.18em] font-mono tabular-nums">{session.attendance_code}</p>
                {session.attendance_code_expires_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    만료: {new Date(session.attendance_code_expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => regenerateCode(session.id)} className="active:scale-[0.97]">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> 재생성
              </Button>
            </div>
        </Surface>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        <MetricCard label="출석" value={presentCount} tone="success" />
        <MetricCard label="지각" value={lateCount} tone="warning" />
        <MetricCard label="조퇴" value={earlyLeaveCount} tone="warning" />
        <MetricCard label="결석" value={absentCount} tone="danger" />
        <MetricCard label="출석률" value={`${attendanceRate}%`} />
      </div>

      <Surface className="animate-reveal-up border-warning/20 bg-warning/5 p-4" style={{ animationDelay: '320ms' }}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5 text-muted-foreground">
            <p>결석 1회 = 1점 · 지각/조퇴 합산 2회당 벌점 1점</p>
            <p className="font-medium text-foreground">인정 결석 = 0점 · 조퇴와 인정 결석은 운영진이 직접 설정합니다.</p>
          </div>
        </div>
      </Surface>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '400ms' }}>
        <div className="flex flex-row items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-extrabold">참여자 출결 현황</h2>
          {unrecordedMembers.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="active:scale-[0.97]">
              <UserPlus className="w-3.5 h-3.5 mr-1" /> 출결 추가
            </Button>
          )}
        </div>
          <div className="overflow-x-auto scrollbar-clean">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">이름</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">상태</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">체크인</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground hidden md:table-cell">방식</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">벌점</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">수정</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map(r => {
                  const isPending = isPendingRecord(r);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.member_name}</div>
                        {!isPending && (r.status === 'excused_absent' || r.status === 'unexcused_absent') && r.exception_category && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {r.exception_category}
                            {r.exception_note && ` · ${r.exception_note}`}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPending ? (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">미체크인</Badge>
                        ) : (
                          <Badge variant="outline" className={statusBg[r.status]}>{statusLabel[r.status]}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-muted-foreground text-xs">
                        {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground hidden md:table-cell">{isPending ? '-' : r.check_in_method}</td>
                      <td className="py-3 px-4 text-center tabular-nums font-semibold">{!isPending && r.demerit_points > 0 ? r.demerit_points : '-'}</td>
                      <td className="py-3 px-4 text-center">
                        {isPending ? (
                          <Button size="sm" variant="ghost" onClick={() => {
                            setAddMemberId(r.member_id);
                            setAddStatus('present');
                            setAddOpen(true);
                          }} className="text-xs active:scale-[0.97]">추가</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditRecord(r.id);
                            setEditStatus(r.status);
                          }} className="text-xs active:scale-[0.97]">수정</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {allRows.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">등록된 멤버가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
      </Surface>

      {/* Override modal */}
      <Dialog open={!!editRecord} onOpenChange={open => { if (!open) setEditRecord(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출결 상태 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>변경 상태</Label>
              <Select value={editStatus} onValueChange={v => setEditStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">출석</SelectItem>
                  <SelectItem value="late">지각</SelectItem>
                  <SelectItem value="early_leave">조퇴</SelectItem>
                  <SelectItem value="absent">결석</SelectItem>
                  <SelectItem value="excused_absent">인정 결석</SelectItem>
                  <SelectItem value="unexcused_absent">미인정 결석</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>수정 사유</Label>
              <Input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="수정 사유 입력" />
            </div>
            <Button onClick={handleOverride} className="w-full bg-primary text-primary-foreground active:scale-[0.97]">저장</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add manual record dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수동 출결 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>멤버 선택</Label>
              <Select value={addMemberId} onValueChange={setAddMemberId}>
                <SelectTrigger><SelectValue placeholder="멤버를 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {unrecordedMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>출결 상태</Label>
              <Select value={addStatus} onValueChange={v => setAddStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">출석</SelectItem>
                  <SelectItem value="late">지각</SelectItem>
                  <SelectItem value="early_leave">조퇴</SelectItem>
                  <SelectItem value="absent">결석</SelectItem>
                  <SelectItem value="excused_absent">인정 결석</SelectItem>
                  <SelectItem value="unexcused_absent">미인정 결석</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddRecord} disabled={!addMemberId} className="w-full bg-primary text-primary-foreground active:scale-[0.97]">추가</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
