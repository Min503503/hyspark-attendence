import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PENALTY_POLICY, getRiskState } from '@/types';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/app-ui';
import PinCodeInput from '@/components/member/PinCodeInput';
import SessionPhaseBar from '@/components/member/SessionPhaseBar';
import AttendanceRing from '@/components/member/AttendanceRing';
import MemberBottomNav, { type MemberTab } from '@/components/member/MemberBottomNav';
import AbsenceDialog from '@/components/member/AbsenceDialog';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  formatDateTime,
  formatTime,
  getMemberInitial,
  getRiskLabel,
  getRiskTone,
  getSessionTimeline,
} from '@/lib/member-utils';
import { cn } from '@/lib/utils';

type CheckInResult = 'present' | 'late' | 'absent' | 'already' | 'error' | null;

type MemberHomeProps = {
  initialIntent?: 'absence' | 'checkin' | null;
  onIntentHandled?: () => void;
};

export default function MemberHome({ initialIntent = null, onIntentHandled }: MemberHomeProps) {
  const { currentUser, sessions, getMemberRecords, checkIn, submitAbsenceRequest } = useApp();
  const records = getMemberRecords(currentUser?.id || '');

  const [activeTab, setActiveTab] = useState<MemberTab>('checkin');
  const [now, setNow] = useState(() => new Date());
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [absenceOpen, setAbsenceOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!initialIntent) return;
    if (initialIntent === 'absence') {
      setAbsenceOpen(true);
    }
    if (initialIntent === 'checkin') {
      setActiveTab('checkin');
    }
    onIntentHandled?.();
  }, [initialIntent, onIntentHandled]);

  const view = useMemo(() => {
    const presentCount = records.filter(record => record.status === 'present').length;
    const lateCount = records.filter(record => record.status === 'late').length;
    const absentCount = records.filter(record =>
      record.status === 'absent' || record.status === 'excused_absent' || record.status === 'unexcused_absent',
    ).length;
    const demeritPoints = records.reduce((sum, record) => sum + record.demerit_points, 0);
    const riskState = getRiskState(demeritPoints);
    const countedRecords = records.filter(record =>
      ['present', 'late', 'absent', 'excused_absent', 'unexcused_absent'].includes(record.status),
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
      });
    const recordedSessionIds = new Set(records.map(record => record.session_id));
    const availableForAbsence = sessions.filter(
      session => (session.status === 'scheduled' || session.status === 'open') && !recordedSessionIds.has(session.id),
    );

    const openTimeline = openSession ? getSessionTimeline(openSession, now) : null;
    const existingOpenRecord = openSession
      ? records.find(record => record.session_id === openSession.id)
      : undefined;

    return {
      presentCount,
      lateCount,
      absentCount,
      demeritPoints,
      riskState,
      attendanceRate,
      openSession,
      openTimeline,
      existingOpenRecord,
      nextSession,
      recentRecords,
      availableForAbsence,
    };
  }, [records, sessions, now]);

  const isCheckInAvailable = view.openSession?.status === 'open'
    && view.openSession?.attendance_code_status === 'active'
    && !view.existingOpenRecord;

  const handleCheckIn = async (submittedCode?: string) => {
    const finalCode = submittedCode ?? code;
    if (!view.openSession || !currentUser || finalCode.length < 5) return;

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const response = await checkIn(view.openSession.id, currentUser.id, finalCode);
    setLoading(false);

    if (response.success) {
      if (response.existing) {
        setResult('already');
        setResultMsg(`이미 체크인 완료 (${ATTENDANCE_STATUS_LABEL[response.status || 'present']})`);
      } else {
        setResult(response.status as CheckInResult);
        setResultMsg(response.message);
      }
    } else {
      setResult('error');
      setResultMsg(response.message);
    }
  };

  const handleAbsenceSubmit = async (payload: {
    sessionId: string;
    type: 'excused_absent' | 'unexcused_absent';
    categoryLabel?: string;
    note?: string;
  }) => {
    if (!currentUser) return;
    await submitAbsenceRequest(
      payload.sessionId,
      currentUser.id,
      payload.type,
      payload.categoryLabel,
      payload.note,
    );
    toast.success('결석 신청이 완료되었습니다.');
  };

  const resultConfig = {
    present: { icon: CheckCircle2, tone: 'text-status-present', bg: 'bg-status-present/10' },
    late: { icon: AlertTriangle, tone: 'text-status-late', bg: 'bg-status-late/10' },
    absent: { icon: XCircle, tone: 'text-status-absent', bg: 'bg-status-absent/10' },
    already: { icon: CheckCircle2, tone: 'text-muted-foreground', bg: 'bg-secondary/60' },
    error: { icon: XCircle, tone: 'text-destructive', bg: 'bg-destructive/10' },
  };

  const cohortLabel = currentUser?.cohort_label || 'HySpark 학회원';

  return (
    <div className="member-shell pb-20">
      <div className="member-hero px-4 pb-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="member-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-primary-foreground">
            {getMemberInitial(currentUser?.full_name || '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-tight">{currentUser?.full_name}님</p>
            <p className="truncate text-[11px] font-medium text-primary-foreground/70">{cohortLabel}</p>
          </div>
          <StatusPill tone={getRiskTone(view.riskState)}>
            {getRiskLabel(view.riskState)}
          </StatusPill>
        </div>
      </div>

      <div className="px-3">
        {activeTab === 'checkin' && (
          <section className="space-y-3">
            {view.openSession && view.openTimeline ? (
              <div className="member-card overflow-hidden">
                <div className="member-card-accent px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-present animate-pulse-dot" />
                      <span className="text-[11px] font-extrabold text-primary">출석 진행 중</span>
                    </div>
                    <StatusPill tone="accent">{view.openTimeline.phaseLabel}</StatusPill>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground">오늘의 세션</p>
                    <h2 className="mt-0.5 text-lg font-extrabold tracking-tight">{view.openSession.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(view.openSession.start_at)} 시작
                      </span>
                      {view.openSession.venue_name && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {view.openSession.venue_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <SessionPhaseBar
                    phase={view.openTimeline.phase}
                    now={now}
                    attendanceDeadline={view.openTimeline.attendanceDeadline}
                    lateDeadline={view.openTimeline.lateDeadline}
                    compact
                  />

                  {view.existingOpenRecord ? (
                    <div className="rounded-xl bg-secondary/50 px-3 py-4 text-center">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-status-present" />
                      <p className="mt-2 text-base font-extrabold">
                        {ATTENDANCE_STATUS_LABEL[view.existingOpenRecord.status]} 처리됨
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {view.existingOpenRecord.checked_in_at
                          ? formatDateTime(view.existingOpenRecord.checked_in_at)
                          : '이미 이 세션 출결이 기록되어 있습니다.'}
                      </p>
                    </div>
                  ) : result ? (
                    <div className={cn('rounded-xl px-3 py-4 text-center', resultConfig[result].bg)}>
                      {(() => {
                        const Icon = resultConfig[result].icon;
                        return <Icon className={cn('mx-auto h-8 w-8', resultConfig[result].tone)} />;
                      })()}
                      <p className="mt-2 text-base font-extrabold">{resultMsg}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setResult(null); setCode(''); }}
                        className="mt-3 h-8"
                      >
                        확인
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <PinCodeInput
                        value={code}
                        onChange={setCode}
                        onComplete={handleCheckIn}
                        disabled={!isCheckInAvailable || loading}
                      />
                      <Button
                        onClick={() => handleCheckIn()}
                        disabled={!isCheckInAvailable || code.length < 5 || loading}
                        className="member-cta h-11 w-full text-sm font-extrabold active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '체크인하기'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="member-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">오늘의 세션</p>
                    <h2 className="mt-0.5 text-base font-extrabold tracking-tight">아직 열린 출석이 없습니다</h2>
                    {view.nextSession ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        다음 세션{' '}
                        <strong className="font-bold text-foreground">
                          {formatDateTime(view.nextSession.start_at)}
                        </strong>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">예정된 세션이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view.availableForAbsence.length > 0 && (
              <button
                type="button"
                onClick={() => setAbsenceOpen(true)}
                className="member-action-row flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-3 text-left shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">결석 신청</p>
                    <p className="text-[10px] text-muted-foreground">
                      {view.availableForAbsence.length}개 세션 신청 가능
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">신청</span>
              </button>
            )}
          </section>
        )}

        {activeTab === 'stats' && (
          <section className="stagger-children space-y-4">
            <div className="member-card p-5">
              <div className="flex items-center gap-5">
                <AttendanceRing rate={view.attendanceRate} />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">누적 출석률</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      출석 + 지각 / 전체 세션
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-secondary/50 p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground">벌점</p>
                      <p className="text-xl font-extrabold tabular-nums">{view.demeritPoints}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/50 p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground">결석</p>
                      <p className="text-xl font-extrabold tabular-nums text-status-absent">{view.absentCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: '출석', value: view.presentCount, tone: 'text-status-present' },
                  { label: '지각', value: view.lateCount, tone: 'text-status-late' },
                  { label: '결석', value: view.absentCount, tone: 'text-status-absent' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-border/50 bg-background/60 p-3 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
                    <p className={cn('mt-0.5 text-xl font-extrabold tabular-nums', item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {view.riskState !== 'stable' && (
              <div className={cn(
                'flex items-center gap-3 rounded-2xl border p-4',
                view.riskState === 'withdrawal'
                  ? 'border-destructive/20 bg-destructive/8 text-destructive'
                  : 'border-warning/25 bg-warning/10 text-warning',
              )}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold leading-relaxed">
                  {view.riskState === 'withdrawal'
                    ? '탈회 기준에 도달했습니다. 운영진에게 문의하세요.'
                    : '면담 기준에 도달했습니다. 운영진에게 문의하세요.'}
                </p>
              </div>
            )}

            <div className="member-card p-5">
              <h3 className="text-sm font-extrabold">벌점 정책</h3>
              <div className="mt-3 space-y-2">
                {[
                  { label: '지각', value: `${PENALTY_POLICY.late_points}점` },
                  { label: '결석', value: `${PENALTY_POLICY.absent_points}점` },
                  { label: '면담 기준', value: `${PENALTY_POLICY.counseling_threshold}점 이상` },
                  { label: '탈회 기준', value: `${PENALTY_POLICY.withdrawal_threshold}점 이상` },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-bold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="stagger-children space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-extrabold">출결 기록</h2>
              <span className="text-[11px] font-medium text-muted-foreground">총 {view.recentRecords.length}건</span>
            </div>

            {view.recentRecords.length === 0 ? (
              <div className="member-card px-6 py-12 text-center">
                <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-muted-foreground">출결 이력이 없습니다</p>
                <p className="mt-1 text-xs text-muted-foreground">첫 세션 출석 후 기록이 표시됩니다.</p>
              </div>
            ) : (
              <div className="member-timeline space-y-0">
                {view.recentRecords.map((record, index) => {
                  const session = sessions.find(item => item.id === record.session_id);
                  const tone = ATTENDANCE_STATUS_TONE[record.status] ?? 'neutral';

                  return (
                    <div key={record.id} className="member-timeline-item relative flex gap-3 pb-4">
                      {index < view.recentRecords.length - 1 && (
                        <span className="member-timeline-line absolute left-[15px] top-8 bottom-0 w-px bg-border/60" />
                      )}
                      <div className={cn(
                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-card',
                        tone === 'success' && 'border-status-present/40',
                        tone === 'warning' && 'border-status-late/40',
                        tone === 'danger' && 'border-status-absent/40',
                        tone === 'neutral' && 'border-border',
                      )}>
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          tone === 'success' && 'bg-status-present',
                          tone === 'warning' && 'bg-status-late',
                          tone === 'danger' && 'bg-status-absent',
                          tone === 'neutral' && 'bg-muted-foreground',
                        )} />
                      </div>
                      <div className="member-card min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{session?.title || '-'}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {record.checked_in_at
                                ? formatDateTime(record.checked_in_at)
                                : session?.start_at
                                  ? formatDateTime(session.start_at)
                                  : '기록 시간 없음'}
                            </p>
                            {record.exception_category && (
                              <p className="mt-1 text-[11px] text-muted-foreground">{record.exception_category}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusPill tone={tone}>
                              {ATTENDANCE_STATUS_LABEL[record.status]}
                            </StatusPill>
                            {record.demerit_points > 0 && (
                              <span className="text-[10px] font-bold tabular-nums text-destructive">
                                +{record.demerit_points}점
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <MemberBottomNav
        active={activeTab}
        onChange={setActiveTab}
        checkInBadge={Boolean(view.openSession && !view.existingOpenRecord)}
      />

      <AbsenceDialog
        open={absenceOpen}
        onOpenChange={setAbsenceOpen}
        sessions={view.availableForAbsence}
        onSubmit={handleAbsenceSubmit}
      />
    </div>
  );
}
