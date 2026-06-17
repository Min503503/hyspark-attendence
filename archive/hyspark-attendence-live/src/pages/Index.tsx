import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Loader2, LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MemberHome from '@/pages/MemberHome';
import { Surface } from '@/components/app-ui';

function formatDeadlineTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRemaining(now: Date, target: Date) {
  const remainingSeconds = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
  if (remainingSeconds <= 0) return '마감됨';

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes.toString().padStart(2, '0')}분 ${seconds.toString().padStart(2, '0')}초 남음`;
  return `${minutes.toString().padStart(2, '0')}분 ${seconds.toString().padStart(2, '0')}초 남음`;
}

export default function Index() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { currentRole, currentUser, sessions, loginAsMember, logout } = useApp();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 120);
    return () => window.clearInterval(timer);
  }, []);

  const centisecondText = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
  const minuteProgress = `${((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * 100}%`;
  const sessionGuide = useMemo(() => {
    const nowTime = now.getTime();
    const targetSession = [...sessions]
      .filter(session => {
        const lateDeadline = new Date(session.start_at).getTime() + session.late_deadline_minutes * 60000;
        return (session.status === 'open' || session.status === 'scheduled') && lateDeadline >= nowTime;
      })
      .sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      })[0];

    if (!targetSession) return null;

    const start = new Date(targetSession.start_at);
    const openAt = new Date(start.getTime() - targetSession.check_in_open_minutes * 60000);
    const attendanceDeadline = new Date(start.getTime() + targetSession.attendance_deadline_minutes * 60000);
    const lateDeadline = new Date(start.getTime() + targetSession.late_deadline_minutes * 60000);
    const phase = now < openAt
      ? '출석 대기'
      : now < attendanceDeadline
        ? '출석 인정 중'
        : now < lateDeadline
          ? '지각 인정 중'
          : '결석 처리 기준 도달';

    return {
      title: targetSession.title,
      phase,
      start,
      attendanceDeadline,
      lateDeadline,
    };
  }, [now, sessions]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    const member = await loginAsMember(trimmedName);
    setSubmitting(false);

    if (!member) {
      setError('등록된 이름을 찾을 수 없습니다.');
    }
  };

  const isMemberSignedIn = currentRole === 'member' && currentUser?.role === 'member';

  return (
    <div className="min-h-screen bg-grid bg-soft-gradient">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <img src={hysparkLogo} alt="하이스파크 pre" className="h-8 w-8 object-contain" />
            <div>
              <p className="text-sm font-extrabold leading-none tracking-tight">하이스파크 pre</p>
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">HySpark 5th · 2026 Spring</p>
            </div>
          </Link>
          {isMemberSignedIn && (
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </header>

        <main className="flex-1">
          {isMemberSignedIn ? (
            <MemberHome />
          ) : (
            <div className="flex min-h-[calc(100vh-136px)] flex-col justify-center px-5 pb-10">
              <section className="animate-reveal-up space-y-4">
                <Surface className="relative overflow-hidden p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-4 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        현재 시간
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                        {now.toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                      <div className="mt-2 flex items-end gap-1.5 tabular-nums">
                        <p className="text-4xl font-extrabold leading-none tracking-tight text-foreground">
                          {now.toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                        <p className="min-w-11 translate-y-[-3px] text-sm font-extrabold leading-none text-muted-foreground">
                          .{centisecondText}
                        </p>
                      </div>
                    </div>
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/70 shadow-[0_0_0_5px_hsl(var(--accent)/0.08)]" />
                  </div>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-border/40">
                    <div className="h-full rounded-full bg-accent/55 transition-[width] duration-200 ease-out" style={{ width: minuteProgress }} />
                  </div>
                </Surface>

                <Surface className="p-5 shadow-lg">
                  <div className="mb-5 space-y-2">
                    <h1 className="spark-brand-mark text-3xl font-extrabold leading-tight tracking-tight">본인의 이름을 입력해주세요</h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                      등록된 학회원 이름을 확인한 뒤 개인 출결 화면으로 이동합니다.
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="member-name">이름</Label>
                      <Input
                        id="member-name"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        placeholder="홍길동"
                        autoComplete="name"
                        className="h-12 bg-secondary/40 text-base font-semibold"
                      />
                    </div>
                    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="h-12 w-full bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <>
                          확인
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {sessionGuide && (
                    <div className="mt-4 border-t border-border/45 pt-3">
                      <div className="rounded-lg bg-secondary/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 border-b border-border/45 pb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground/75">출결 기준 · {sessionGuide.title}</p>
                          <span className="text-[10px] font-semibold text-muted-foreground/70">
                            {sessionGuide.phase}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-muted-foreground/75">출석 인정</span>
                            <span className="text-right font-semibold tabular-nums text-foreground/80">
                              {formatDeadlineTime(sessionGuide.attendanceDeadline)}까지
                              <span className="ml-2 font-medium text-muted-foreground/70">{formatRemaining(now, sessionGuide.attendanceDeadline)}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-muted-foreground/75">지각 인정</span>
                            <span className="text-right font-semibold tabular-nums text-foreground/80">
                              {formatDeadlineTime(sessionGuide.lateDeadline)}까지
                              <span className="ml-2 font-medium text-muted-foreground/70">{formatRemaining(now, sessionGuide.lateDeadline)}</span>
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] leading-4 text-muted-foreground/60">
                          {formatDeadlineTime(sessionGuide.lateDeadline)} 이후에는 미인정 결석 기준입니다.
                        </p>
                      </div>
                    </div>
                  )}
                </Surface>
              </section>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
