import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import type { AttendanceStatus } from '@/types';
import { PENALTY_POLICY } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, RefreshCw, Play, Square, CheckCircle2, AlertTriangle, Info, UserPlus } from 'lucide-react';

const statusBg: Record<string, string> = {
  present: 'bg-status-present/10 text-status-present border-status-present/20',
  late: 'bg-status-late/10 text-status-late border-status-late/20',
  absent: 'bg-status-absent/10 text-status-absent border-status-absent/20',
  excused_absent: 'bg-muted text-muted-foreground',
  unexcused_absent: 'bg-status-absent/10 text-status-absent border-status-absent/20',
};
const statusLabel: Record<string, string> = {
  present: '출석', late: '지각', absent: '결석', excused_absent: '인정 결석', unexcused_absent: '미인정 결석',
};

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

  if (!session) return <div className="p-8 text-center text-muted-foreground">세션을 찾을 수 없습니다.</div>;

  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

  // Members not yet recorded for this session
  const recordedMemberIds = new Set(records.map(r => r.member_id));
  const activeMembers = members.filter(m => m.role === 'member' && m.status === 'active');
  const unrecordedMembers = activeMembers.filter(m => !recordedMemberIds.has(m.id));

  // Build a combined list: existing records + unrecorded members as "미체크인"
  const allRows = [
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-reveal-up">
        <button onClick={() => navigate('/admin/sessions')} className="text-sm text-muted-foreground hover:text-foreground mb-2 block">← 세션 목록</button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold">{session.title}</h1>
              <Badge className={session.status === 'open' ? 'bg-accent text-accent-foreground' : 'bg-secondary'}>
                {session.status === 'open' ? '체크인 진행 중' : session.status === 'scheduled' ? '예정' : session.status === 'closed' ? '종료' : '보관'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(session.start_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {(session.status === 'scheduled' || session.status === 'draft') && (
              <Button onClick={() => openCheckIn(session.id)} className="bg-accent text-accent-foreground active:scale-[0.97]">
                <Play className="w-3.5 h-3.5 mr-1" /> 현장 출결 시작
              </Button>
            )}
            {session.status === 'open' && (
              <Button variant="outline" onClick={() => closeCheckIn(session.id)} className="active:scale-[0.97]">
                <Square className="w-3.5 h-3.5 mr-1" /> 출결 종료
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active code card */}
      {session.status === 'open' && session.attendance_code && (
        <Card className="border-accent/30 animate-reveal-up" style={{ animationDelay: '80ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">활성 출결코드</p>
                <p className="text-4xl font-extrabold tracking-[0.2em] font-mono">{session.attendance_code}</p>
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
          </CardContent>
        </Card>
      )}

      {/* Summary + Policy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">출석</p>
            <p className="text-2xl font-bold text-status-present tabular-nums">{presentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">지각</p>
            <p className="text-2xl font-bold text-status-late tabular-nums">{lateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">결석</p>
            <p className="text-2xl font-bold text-status-absent tabular-nums">{absentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">출석률</p>
            <p className="text-2xl font-bold tabular-nums">
              {records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Policy notice */}
      <Card className="animate-reveal-up border-warning/20 bg-warning/5" style={{ animationDelay: '320ms' }}>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5 text-muted-foreground">
            <p>지각 1회 = {PENALTY_POLICY.late_points}점 · 결석 1회 = {PENALTY_POLICY.absent_points}점</p>
            <p>누적 {PENALTY_POLICY.counseling_threshold}점 이상 면담 · {PENALTY_POLICY.withdrawal_threshold}점 이상 탈회 대상</p>
            <p className="font-medium text-foreground">벌점은 디포데이 점수에 반영됩니다.</p>
          </div>
        </CardContent>
      </Card>

      {/* Records table */}
      <Card className="animate-reveal-up" style={{ animationDelay: '400ms' }}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">참여자 출결 현황</CardTitle>
          {unrecordedMembers.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="active:scale-[0.97]">
              <UserPlus className="w-3.5 h-3.5 mr-1" /> 출결 추가
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                  const isPending = '_pending' in r && (r as any)._pending;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.member_name}</div>
                        {!isPending && (r.status === 'excused_absent' || r.status === 'unexcused_absent') && ('exception_category' in r) && (r as any).exception_category && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {(r as any).exception_category}
                            {(r as any).exception_note && ` · ${(r as any).exception_note}`}
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
        </CardContent>
      </Card>

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
    </div>
  );
}
