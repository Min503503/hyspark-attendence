import { useState, type ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PENALTY_POLICY, getRiskState, getDemeritPoints } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Clock, Info, CheckCircle2, XCircle, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

const statusLabel: Record<string, string> = {
  present: '출석', late: '지각', absent: '결석', excused_absent: '인정 결석', unexcused_absent: '미인정 결석',
};
const statusColor: Record<string, string> = {
  present: 'text-status-present border-status-present/30 bg-status-present/10',
  late: 'text-status-late border-status-late/30 bg-status-late/10',
  absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
  excused_absent: 'text-muted-foreground',
  unexcused_absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
};

const EXCUSED_CATEGORIES = [
  { value: 'family', label: '가족 경조사' },
  { value: 'startup', label: '창업 활동' },
  { value: 'illness', label: '질병' },
  { value: 'exam', label: '학교/국가 자격시험' },
];

type CheckInResult = 'present' | 'late' | 'absent' | 'already' | 'error' | null;

export default function MemberHome() {
  const { currentUser, sessions, getMemberRecords, checkIn, submitAbsenceRequest } = useApp();
  const records = getMemberRecords(currentUser?.id || '');

  // Compute summary from live records
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent' || r.status === 'excused_absent' || r.status === 'unexcused_absent').length;
  const demeritPoints = records.reduce((sum, r) => sum + r.demerit_points, 0);
  const riskState = getRiskState(demeritPoints);

  // Check-in state
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult>(null);
  const [resultMsg, setResultMsg] = useState('');

  // Absence request state
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceSessionId, setAbsenceSessionId] = useState('');
  const [absenceType, setAbsenceType] = useState<'excused_absent' | 'unexcused_absent'>('excused_absent');
  const [absenceCategory, setAbsenceCategory] = useState('');
  const [absenceNote, setAbsenceNote] = useState('');
  const [absenceLoading, setAbsenceLoading] = useState(false);

  const openSession = sessions.find(s => s.status === 'open');
  const isCheckInAvailable = openSession?.status === 'open' && openSession?.attendance_code_status === 'active';

  // Sessions available for absence request (scheduled or open, not yet recorded by this member)
  const recordedSessionIds = new Set(records.map(r => r.session_id));
  const availableForAbsence = sessions.filter(
    s => (s.status === 'scheduled' || s.status === 'open') && !recordedSessionIds.has(s.id)
  );

  const handleCheckIn = async () => {
    if (!openSession || !currentUser || !code) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const res = await checkIn(openSession.id, currentUser.id, code);
    setLoading(false);

    if (res.success) {
      if (res.existing) {
        setResult('already');
        setResultMsg(`이미 체크인 완료 (${statusLabel[res.status || 'present']})`);
      } else {
        setResult(res.status as CheckInResult);
        setResultMsg(res.message);
      }
    } else {
      setResult('error');
      setResultMsg(res.message);
    }
  };

  const handleAbsenceSubmit = async () => {
    if (!absenceSessionId || !currentUser) return;
    setAbsenceLoading(true);
    const categoryLabel = absenceType === 'excused_absent'
      ? EXCUSED_CATEGORIES.find(c => c.value === absenceCategory)?.label
      : undefined;
    await submitAbsenceRequest(
      absenceSessionId,
      currentUser.id,
      absenceType,
      categoryLabel,
      absenceNote || undefined,
    );
    setAbsenceLoading(false);
    setAbsenceOpen(false);
    setAbsenceSessionId('');
    setAbsenceType('excused_absent');
    setAbsenceCategory('');
    setAbsenceNote('');
    toast.success('결석 신청이 완료되었습니다.');
  };

  const resultIcon: Record<string, ReactNode> = {
    present: <CheckCircle2 className="w-10 h-10 text-status-present" />,
    late: <AlertTriangle className="w-10 h-10 text-status-late" />,
    absent: <XCircle className="w-10 h-10 text-status-absent" />,
    already: <CheckCircle2 className="w-10 h-10 text-muted-foreground" />,
    error: <XCircle className="w-10 h-10 text-destructive" />,
  };

  return (
    <div className="p-4 pb-8 space-y-6">
      {/* Greeting + Stats Hero */}
      <div className="animate-reveal-up">
        <h1 className="text-xl font-extrabold tracking-tight">{currentUser?.full_name}님, 안녕하세요</h1>
        <p className="text-xs text-muted-foreground mt-0.5">HySpark 5th · 2026 Spring</p>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: '출석', value: presentCount, color: 'text-status-present' },
            { label: '지각', value: lateCount, color: 'text-status-late' },
            { label: '결석', value: absentCount, color: 'text-status-absent' },
            { label: '벌점', value: demeritPoints, color: 'text-foreground' },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-xl p-3 text-center shadow-sm border border-border/60">
              <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-xl font-extrabold tabular-nums mt-0.5 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk warning */}
      {riskState !== 'stable' && (
        <div className={`animate-reveal-up rounded-xl p-3.5 flex items-center gap-2.5 ${riskState === 'withdrawal' ? 'bg-destructive/8 border border-destructive/20' : 'bg-warning/8 border border-warning/20'}`}>
          <AlertTriangle className={`w-4 h-4 shrink-0 ${riskState === 'withdrawal' ? 'text-destructive' : 'text-warning'}`} />
          <span className="text-sm font-medium">
            {riskState === 'withdrawal' ? '탈회 대상입니다. 운영진에게 문의하세요.' : '면담 대상입니다. 운영진에게 문의하세요.'}
          </span>
        </div>
      )}

      {/* Check-in section */}
      {openSession ? (
        <div className="animate-reveal-up bg-card rounded-2xl border-2 border-accent/40 shadow-md overflow-hidden" style={{ animationDelay: '80ms' }}>
          <div className="bg-accent/10 px-4 py-2.5 flex items-center justify-between border-b border-accent/20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-present animate-pulse-dot" />
              <span className="text-xs font-bold text-accent-foreground">체크인 가능</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {openSession.attendance_deadline_minutes}분 내 출석 · {openSession.late_deadline_minutes}분 내 지각
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-bold text-base">{openSession.title}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {new Date(openSession.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작
              </p>
            </div>

            {/* Deadline timeline */}
            <div className="flex items-center gap-1 text-[10px] rounded-lg bg-secondary/60 p-2.5">
              <div className="flex-1 text-center">
                <div className="w-full h-1.5 rounded-full bg-status-present/30 mb-1" />
                <span className="text-status-present font-semibold">출석</span>
                <span className="text-muted-foreground ml-0.5">~{openSession.attendance_deadline_minutes}분</span>
              </div>
              <div className="flex-1 text-center">
                <div className="w-full h-1.5 rounded-full bg-status-late/30 mb-1" />
                <span className="text-status-late font-semibold">지각</span>
                <span className="text-muted-foreground ml-0.5">~{openSession.late_deadline_minutes}분</span>
              </div>
              <div className="flex-1 text-center">
                <div className="w-full h-1.5 rounded-full bg-status-absent/30 mb-1" />
                <span className="text-status-absent font-semibold">결석</span>
                <span className="text-muted-foreground ml-0.5">{openSession.late_deadline_minutes}분~</span>
              </div>
            </div>

            {result ? (
              <div className="flex flex-col items-center gap-3 py-4">
                {resultIcon[result]}
                <p className="font-bold text-lg">{resultMsg}</p>
                <Button variant="outline" size="sm" onClick={() => { setResult(null); setCode(''); }} className="active:scale-[0.97]">
                  확인
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="출결코드 5자리"
                  inputMode="numeric"
                  className="text-center text-2xl font-mono tracking-[0.3em] h-14 bg-secondary/50"
                  maxLength={5}
                  disabled={!isCheckInAvailable}
                />
                <Button
                  onClick={handleCheckIn}
                  disabled={!isCheckInAvailable || code.length < 5 || loading}
                  className="w-full h-12 bg-accent text-accent-foreground font-bold text-base active:scale-[0.97]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '체크인'}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        (() => {
          const upcoming = sessions
            .filter(s => s.status === 'scheduled')
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
          const next = upcoming[0];
          return (
            <div className="animate-reveal-up bg-card rounded-2xl border border-border/60 shadow-sm p-5" style={{ animationDelay: '80ms' }}>
              {next ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-4 h-4" />
                    <span className="text-xs font-medium">다가오는 세션</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{next.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(next.start_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                      {' '}
                      {new Date(next.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      {next.venue_name && ` · ${next.venue_name}`}
                    </p>
                  </div>
                  {upcoming.length > 1 && (
                    <p className="text-xs text-muted-foreground/70">외 {upcoming.length - 1}개 세션 예정</p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">예정된 세션이 없습니다.</p>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Absence request + Policy row */}
      <div className="animate-reveal-up space-y-3" style={{ animationDelay: '150ms' }}>
        {availableForAbsence.length > 0 && (
          <button
            onClick={() => setAbsenceOpen(true)}
            className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-2.5 font-semibold text-sm shadow-sm hover:shadow-md transition-shadow active:scale-[0.97]"
          >
            <FileText className="w-4 h-4" />
            결석 신청하기
          </button>
        )}

        {(() => {
          const refSession = openSession || sessions.find(s => s.status === 'scheduled') || sessions[0];
          const ad = refSession?.attendance_deadline_minutes ?? 5;
          const ld = refSession?.late_deadline_minutes ?? 30;
          return (
            <div className="rounded-xl bg-secondary/50 border border-border/40 p-3.5 flex items-start gap-2.5">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
                <p className="font-medium text-foreground/70">출결 기준</p>
                <p>세션 시작 후 <strong className="text-status-present">{ad}분 이내</strong> → 출석</p>
                <p>시작 후 {ad}분 ~ <strong className="text-status-late">{ld}분 이내</strong> → 지각 (벌점 {PENALTY_POLICY.late_points}점)</p>
                <p>시작 후 <strong className="text-status-absent">{ld}분 초과</strong> → 결석 (벌점 {PENALTY_POLICY.absent_points}점)</p>
                <p className="pt-1 border-t border-border/40 mt-1">누적 {PENALTY_POLICY.counseling_threshold}점 이상 면담 · {PENALTY_POLICY.withdrawal_threshold}점 이상 탈회 대상</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Attendance history */}
      <div className="animate-reveal-up" style={{ animationDelay: '250ms' }}>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">출결 이력</h2>
        <div className="space-y-2">
          {records.length === 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 text-center">
              <p className="text-sm text-muted-foreground">출결 이력이 없습니다.</p>
            </div>
          )}
          {[...records].reverse().map(r => {
            const session = sessions.find(s => s.id === r.session_id);
            return (
              <div key={r.id} className="bg-card rounded-xl border border-border/60 shadow-sm p-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{session?.title || '-'}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    {r.exception_category && ` · ${r.exception_category}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {r.demerit_points > 0 && (
                    <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">벌점 +{r.demerit_points}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${statusColor[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Absence request dialog */}
      <Dialog open={absenceOpen} onOpenChange={setAbsenceOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>결석 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Session select */}
            <div className="space-y-2">
              <Label>세션 선택</Label>
              <Select value={absenceSessionId} onValueChange={setAbsenceSessionId}>
                <SelectTrigger><SelectValue placeholder="세션을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {availableForAbsence.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} ({new Date(s.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Absence type */}
            <div className="space-y-2">
              <Label>결석 구분</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setAbsenceType('excused_absent'); setAbsenceCategory(''); }}
                  className={`py-2.5 px-3 rounded-md text-sm font-medium transition-colors active:scale-[0.97] border ${
                    absenceType === 'excused_absent'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                  }`}
                >
                  인정 결석
                </button>
                <button
                  type="button"
                  onClick={() => { setAbsenceType('unexcused_absent'); setAbsenceCategory(''); }}
                  className={`py-2.5 px-3 rounded-md text-sm font-medium transition-colors active:scale-[0.97] border ${
                    absenceType === 'unexcused_absent'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                  }`}
                >
                  미인정 결석
                </button>
              </div>
            </div>

            {/* Excused category */}
            {absenceType === 'excused_absent' && (
              <div className="space-y-2">
                <Label>사유 선택</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXCUSED_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setAbsenceCategory(cat.value)}
                      className={`py-2 px-3 rounded-md text-sm transition-colors active:scale-[0.97] border ${
                        absenceCategory === cat.value
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unexcused reason (required) */}
            {absenceType === 'unexcused_absent' && (
              <div className="space-y-2">
                <Label>사유 작성 *</Label>
                <textarea
                  value={absenceNote}
                  onChange={e => setAbsenceNote(e.target.value)}
                  placeholder="결석 사유를 상세하게 작성해주세요"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground text-right">{absenceNote.length}/500</p>
              </div>
            )}

            {/* Note (optional, for excused) */}
            {absenceType === 'excused_absent' && (
              <div className="space-y-2">
                <Label>비고 (선택)</Label>
                <Input
                  value={absenceNote}
                  onChange={e => setAbsenceNote(e.target.value)}
                  placeholder="추가 사유를 입력하세요"
                />
              </div>
            )}

            <Button
              onClick={handleAbsenceSubmit}
              disabled={
                !absenceSessionId ||
                (absenceType === 'excused_absent' && !absenceCategory) ||
                (absenceType === 'unexcused_absent' && !absenceNote.trim()) ||
                absenceLoading
              }
              className="w-full bg-primary text-primary-foreground active:scale-[0.97]"
            >
              {absenceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '신청하기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
