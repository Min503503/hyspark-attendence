import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PENALTY_POLICY, getRiskState } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const statusLabel: Record<string, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused_absent: '인정 결석',
  unexcused_absent: '미인정 결석',
};

const statusColor: Record<string, string> = {
  present: 'text-status-present border-status-present/30 bg-status-present/10',
  late: 'text-status-late border-status-late/30 bg-status-late/10',
  absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
  excused_absent: 'text-muted-foreground border-border bg-secondary/60',
  unexcused_absent: 'text-status-absent border-status-absent/30 bg-status-absent/10',
};

const EXCUSED_CATEGORIES = [
  { value: 'family', label: '가족 경조사' },
  { value: 'startup', label: '창업 활동' },
  { value: 'illness', label: '질병' },
  { value: 'exam', label: '학교/국가 자격시험' },
];

type CheckInResult = 'present' | 'late' | 'absent' | 'already' | 'error' | null;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MemberHome() {
  const { currentUser, sessions, getMemberRecords, checkIn, submitAbsenceRequest } = useApp();
  const records = getMemberRecords(currentUser?.id || '');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceSessionId, setAbsenceSessionId] = useState('');
  const [absenceType, setAbsenceType] = useState<'excused_absent' | 'unexcused_absent'>('excused_absent');
  const [absenceCategory, setAbsenceCategory] = useState('');
  const [absenceNote, setAbsenceNote] = useState('');
  const [absenceLoading, setAbsenceLoading] = useState(false);

  const view = useMemo(() => {
    const presentCount = records.filter(record => record.status === 'present').length;
    const lateCount = records.filter(record => record.status === 'late').length;
    const absentCount = records.filter(record =>
      record.status === 'absent' || record.status === 'excused_absent' || record.status === 'unexcused_absent'
    ).length;
    const demeritPoints = records.reduce((sum, record) => sum + record.demerit_points, 0);
    const riskState = getRiskState(demeritPoints);
    const countedRecords = records.filter(record =>
      ['present', 'late', 'absent', 'excused_absent', 'unexcused_absent'].includes(record.status)
    );
    const attendanceRate = countedRecords.length > 0
      ? Math.round(((presentCount + lateCount) / countedRecords.length) * 100)
      : 0;

    const openSession = sessions.find(session => session.status === 'open');
    const upcomingSessions = sessions
      .filter(session => session.status === 'scheduled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    const nextSession = upcomingSessions[0];
    const sessionById = new Map(sessions.map(session => [session.id, session]));
    const recentRecords = [...records]
      .sort((a, b) => {
        const aTime = new Date(a.checked_in_at || sessionById.get(a.session_id)?.start_at || 0).getTime();
        const bTime = new Date(b.checked_in_at || sessionById.get(b.session_id)?.start_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);
    const recordedSessionIds = new Set(records.map(record => record.session_id));
    const availableForAbsence = sessions.filter(
      session => (session.status === 'scheduled' || session.status === 'open') && !recordedSessionIds.has(session.id),
    );

    return {
      presentCount,
      lateCount,
      absentCount,
      demeritPoints,
      riskState,
      attendanceRate,
      openSession,
      nextSession,
      recentRecords,
      availableForAbsence,
    };
  }, [records, sessions]);

  const isCheckInAvailable = view.openSession?.status === 'open' && view.openSession?.attendance_code_status === 'active';

  const handleCheckIn = async () => {
    if (!view.openSession || !currentUser || !code) return;
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    const response = await checkIn(view.openSession.id, currentUser.id, code);
    setLoading(false);

    if (response.success) {
      if (response.existing) {
        setResult('already');
        setResultMsg(`이미 체크인 완료 (${statusLabel[response.status || 'present']})`);
      } else {
        setResult(response.status as CheckInResult);
        setResultMsg(response.message);
      }
    } else {
      setResult('error');
      setResultMsg(response.message);
    }
  };

  const handleAbsenceSubmit = async () => {
    if (!absenceSessionId || !currentUser) return;
    setAbsenceLoading(true);
    const categoryLabel = absenceType === 'excused_absent'
      ? EXCUSED_CATEGORIES.find(category => category.value === absenceCategory)?.label
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

  const resultIcon = {
    present: <CheckCircle2 className="w-9 h-9 text-status-present" />,
    late: <AlertTriangle className="w-9 h-9 text-status-late" />,
    absent: <XCircle className="w-9 h-9 text-status-absent" />,
    already: <CheckCircle2 className="w-9 h-9 text-muted-foreground" />,
    error: <XCircle className="w-9 h-9 text-destructive" />,
  };

  const statusTone = view.riskState === 'withdrawal'
    ? 'border-destructive/20 bg-destructive/8 text-destructive'
    : view.riskState === 'counseling'
      ? 'border-warning/25 bg-warning/10 text-warning'
      : 'border-status-present/20 bg-status-present/8 text-status-present';

  return (
    <div className="p-4 pb-8 space-y-5">
      <section className="animate-reveal-up rounded-2xl border border-border/60 bg-card shadow-lg shadow-primary/5 overflow-hidden">
        {view.openSession ? (
          <>
            <div className="border-b border-accent/20 bg-accent/10 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-present animate-pulse-dot" />
                  <span className="text-xs font-extrabold text-accent">지금 출석 가능</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {view.openSession.attendance_deadline_minutes}분 출석 · {view.openSession.late_deadline_minutes}분 지각
                </span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">오늘 할 일</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{view.openSession.title}</h1>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(view.openSession.start_at)} 시작
                </p>
              </div>

              {result ? (
                <div className="rounded-xl bg-secondary/60 py-5 px-4 text-center">
                  <div className="flex justify-center">{resultIcon[result]}</div>
                  <p className="mt-3 text-lg font-extrabold">{resultMsg}</p>
                  <Button variant="outline" size="sm" onClick={() => { setResult(null); setCode(''); }} className="mt-4 active:scale-[0.97]">
                    확인
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={code}
                    onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="출결코드 5자리"
                    inputMode="numeric"
                    className="h-16 bg-secondary/50 text-center text-3xl font-extrabold tracking-[0.25em] tabular-nums"
                    maxLength={5}
                    disabled={!isCheckInAvailable}
                  />
                  <Button
                    onClick={handleCheckIn}
                    disabled={!isCheckInAvailable || code.length < 5 || loading}
                    className="h-12 w-full bg-accent text-base font-extrabold text-accent-foreground active:scale-[0.97]"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '체크인'}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                <Timer className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">오늘 할 일</p>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight">아직 열린 출석이 없습니다</h1>
                {view.nextSession ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    다음 세션은 <strong className="font-bold text-foreground">{formatDateTime(view.nextSession.start_at)}</strong>입니다.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">예정된 세션이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="animate-reveal-up rounded-2xl border border-border/60 bg-card p-5 shadow-sm" style={{ animationDelay: '80ms' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">내 출결</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{currentUser?.full_name}님</h1>
            <p className="mt-1 text-xs text-muted-foreground">HySpark 5th · 2026 Spring</p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusTone}`}>
            {view.riskState === 'stable' ? '정상' : view.riskState === 'counseling' ? '면담' : '탈회'}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="rounded-xl bg-primary p-4 text-primary-foreground">
            <p className="text-[11px] font-semibold text-primary-foreground/60">출석률</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{view.attendanceRate}%</p>
            <div className="mt-3 h-1.5 rounded-full bg-primary-foreground/15">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(view.attendanceRate, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="rounded-xl bg-secondary/70 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">벌점</p>
              <p className="text-2xl font-extrabold tabular-nums">{view.demeritPoints}</p>
            </div>
            <div className="rounded-xl bg-secondary/70 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">결석</p>
              <p className="text-2xl font-extrabold text-status-absent tabular-nums">{view.absentCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: '출석', value: view.presentCount, color: 'text-status-present' },
            { label: '지각', value: view.lateCount, color: 'text-status-late' },
            { label: '결석', value: view.absentCount, color: 'text-status-absent' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-border/50 p-2.5 text-center">
              <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
              <p className={`mt-0.5 text-lg font-extrabold tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {view.riskState !== 'stable' && (
        <div className={`animate-reveal-up rounded-xl border p-3.5 flex items-center gap-2.5 ${statusTone}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">
            {view.riskState === 'withdrawal' ? '탈회 대상입니다. 운영진에게 문의하세요.' : '면담 대상입니다. 운영진에게 문의하세요.'}
          </span>
        </div>
      )}

      <section className="animate-reveal-up grid gap-3" style={{ animationDelay: '140ms' }}>
        {view.availableForAbsence.length > 0 && (
          <button
            onClick={() => setAbsenceOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left shadow-sm transition-shadow hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold">결석 신청</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{view.availableForAbsence.length}개 세션 선택 가능</p>
              </div>
            </div>
            <span className="text-xs font-bold text-muted-foreground">신청</span>
          </button>
        )}

        <div className="rounded-xl border border-border/50 bg-secondary/40 p-3.5">
          <div className="flex items-start gap-2.5">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground/70">출결 기준</p>
              <p className="mt-1">
                시작 후 {view.openSession?.attendance_deadline_minutes ?? view.nextSession?.attendance_deadline_minutes ?? 5}분 이내 출석,
                {' '}
                {view.openSession?.late_deadline_minutes ?? view.nextSession?.late_deadline_minutes ?? 30}분 이내 지각입니다.
                지각 {PENALTY_POLICY.late_points}점, 결석 {PENALTY_POLICY.absent_points}점.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="animate-reveal-up" style={{ animationDelay: '220ms' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">최근 출결</h2>
          <span className="text-[11px] font-medium text-muted-foreground">최근 {view.recentRecords.length}개</span>
        </div>
        <div className="space-y-2">
          {view.recentRecords.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
              <CalendarDays className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">출결 이력이 없습니다.</p>
            </div>
          )}
          {view.recentRecords.map(record => {
            const session = sessions.find(item => item.id === record.session_id);
            return (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session?.title || '-'}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {record.checked_in_at ? formatDateTime(record.checked_in_at) : '기록 시간 없음'}
                    {record.exception_category && ` · ${record.exception_category}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {record.demerit_points > 0 && (
                    <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive tabular-nums">
                      +{record.demerit_points}
                    </span>
                  )}
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusColor[record.status]}`}>
                    {statusLabel[record.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={absenceOpen} onOpenChange={setAbsenceOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>결석 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>세션 선택</Label>
              <Select value={absenceSessionId} onValueChange={setAbsenceSessionId}>
                <SelectTrigger><SelectValue placeholder="세션을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {view.availableForAbsence.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title} ({new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {absenceType === 'excused_absent' && (
              <div className="space-y-2">
                <Label>사유 선택</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXCUSED_CATEGORIES.map(category => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setAbsenceCategory(category.value)}
                      className={`py-2 px-3 rounded-md text-sm transition-colors active:scale-[0.97] border ${
                        absenceCategory === category.value
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {absenceType === 'unexcused_absent' && (
              <div className="space-y-2">
                <Label>사유 작성 *</Label>
                <textarea
                  value={absenceNote}
                  onChange={event => setAbsenceNote(event.target.value)}
                  placeholder="결석 사유를 상세하게 작성해주세요"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground text-right">{absenceNote.length}/500</p>
              </div>
            )}

            {absenceType === 'excused_absent' && (
              <div className="space-y-2">
                <Label>비고 (선택)</Label>
                <Input
                  value={absenceNote}
                  onChange={event => setAbsenceNote(event.target.value)}
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
