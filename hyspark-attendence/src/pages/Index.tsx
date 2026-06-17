import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MemberHome from '@/pages/MemberHome';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import SessionPhaseBar from '@/components/member/SessionPhaseBar';
import {
  findRelevantSession,
  getSessionTimeline,
} from '@/lib/member-utils';

export default function Index() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const intent = searchParams.get('intent');
  const { currentRole, currentUser, sessions, loginAsMember, logout } = useApp();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sessionGuide = useMemo(() => {
    const targetSession = findRelevantSession(sessions, now);
    if (!targetSession) return null;
    return getSessionTimeline(targetSession, now);
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
      setError('등록된 이름을 찾을 수 없습니다. 운영진에게 문의하세요.');
    }
  };

  const isMemberSignedIn = currentRole === 'member' && currentUser?.role === 'member';
  const memberIntent = intent === 'absence' || intent === 'checkin' ? intent : null;

  const clearIntent = () => {
    if (!searchParams.has('intent')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('intent');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="member-portal min-h-[100dvh] bg-grid bg-soft-gradient">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-3">
          <Link to="/" className="app-focus-ring flex items-center gap-2 rounded-lg">
            <img src={hysparkLogo} alt={APP_NAME} className="h-8 w-8 object-contain" />
            <div>
              <p className="text-sm font-extrabold leading-none tracking-tight">{APP_NAME}</p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{APP_TAGLINE}</p>
            </div>
          </Link>
          {isMemberSignedIn && (
            <button
              type="button"
              onClick={logout}
              className="app-focus-ring rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {isMemberSignedIn ? (
            <MemberHome initialIntent={memberIntent} onIntentHandled={clearIntent} />
          ) : (
            <div className="flex flex-col px-4 pb-5 pt-1">
              <section className="member-card overflow-hidden p-4 shadow-md shadow-primary/5">
                <div className="mb-4">
                  <h1 className="text-lg font-extrabold leading-snug tracking-tight">
                    {memberIntent === 'absence' ? '이름 입력 후 결석 신청' : '학회원 이름을 입력하세요'}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {memberIntent === 'absence'
                      ? '등록된 이름으로 로그인하면 결석 신청 화면이 열립니다.'
                      : '등록된 이름으로 출석·결석 신청을 할 수 있습니다.'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="member-name" className="text-[11px] font-bold text-muted-foreground">
                      이름
                    </Label>
                    <Input
                      id="member-name"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="홍길동"
                      autoComplete="name"
                      autoFocus
                      className="member-name-input h-11 bg-secondary/40 text-base font-semibold"
                    />
                  </div>
                  {error && (
                    <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="member-cta h-11 w-full text-sm font-bold active:scale-[0.98]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {memberIntent === 'absence' ? '결석 신청하기' : '출석하기'}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {sessionGuide && (
                  <div className="mt-4 border-t border-border/45 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[11px] font-bold">{sessionGuide.session.title}</p>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {sessionGuide.phaseLabel}
                      </span>
                    </div>
                    <SessionPhaseBar
                      phase={sessionGuide.phase}
                      now={now}
                      attendanceDeadline={sessionGuide.attendanceDeadline}
                      lateDeadline={sessionGuide.lateDeadline}
                      compact
                    />
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
