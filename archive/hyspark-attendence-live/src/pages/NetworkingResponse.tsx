import { useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleSlash2, Loader2, RotateCcw, Search, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { Surface } from '@/components/app-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import {
  getAutomaticNetworkingSession,
  isValidNetworkingToken,
  networkingStatusLabel,
  parseSessionNotes,
  serializeSessionNotes,
  type NetworkingAudience,
  type NetworkingStatus,
} from '@/lib/networking';
import { cn } from '@/lib/utils';

function getNetworkingParams() {
  const fromPath = new URLSearchParams(window.location.search);
  if (fromPath.has('s')) return fromPath;

  const hashQuery = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(hashQuery);
}

function getNetworkingAudience(params: URLSearchParams): NetworkingAudience {
  if (params.get('a') === 'staff') return 'staff';
  if (window.location.pathname.includes('/staff')) return 'staff';
  return 'member';
}

function normalizeName(value: string) {
  return value.replace(/\s/g, '').toLowerCase();
}

export default function NetworkingResponse() {
  const params = useMemo(getNetworkingParams, []);
  const sessionId = params.get('s') || '';
  const initialMemberId = params.get('m') || '';
  const audience = getNetworkingAudience(params);
  const token = params.get('t');
  const { sessions, profiles, loading, refreshData } = useApp();
  const [submitting, setSubmitting] = useState<NetworkingStatus | null>(null);
  const [localStatus, setLocalStatus] = useState<NetworkingStatus | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(initialMemberId);
  const [nameError, setNameError] = useState('');
  const [burstKey, setBurstKey] = useState(0);

  const explicitSession = sessionId ? sessions.find(item => item.id === sessionId) : null;
  const automaticSession = getAutomaticNetworkingSession(sessions);
  const session = explicitSession || automaticSession;
  const personalProfile = profiles.find(item => item.id === initialMemberId);
  const hasPersonalLink = Boolean(initialMemberId);
  const tokenOk = Boolean(session) && (!hasPersonalLink || Boolean(sessionId && isValidNetworkingToken(sessionId, initialMemberId, token, audience)));
  const networking = session ? parseSessionNotes(session.notes).networking : null;
  const responseMap = audience === 'staff' ? networking?.staff_responses : networking?.responses;
  const surveyEnabled = audience === 'staff' ? networking?.staff_enabled : networking?.enabled;
  const targetStatus: NetworkingStatus = audience === 'staff' ? 'attending' : 'not_attending';
  const eligibleProfiles = useMemo(() => (
    profiles
      .filter(profile => {
        if (profile.status !== 'active') return false;
        if (audience === 'staff') return profile.role === 'admin' || profile.role === 'staff';
        return profile.role === 'member';
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ko-KR'))
  ), [audience, profiles]);
  const normalizedQuery = normalizeName(nameQuery);
  const exactMatch = normalizedQuery
    ? eligibleProfiles.find(profile => normalizeName(profile.full_name) === normalizedQuery)
    : null;
  const selectedProfile = selectedProfileId
    ? eligibleProfiles.find(profile => profile.id === selectedProfileId) || personalProfile
    : null;
  const profile = selectedProfile || exactMatch || null;
  const suggestedProfiles = normalizedQuery
    ? eligibleProfiles
      .filter(profile => normalizeName(profile.full_name).includes(normalizedQuery))
      .slice(0, 6)
    : [];
  const currentStatus = localStatus || (profile ? responseMap?.[profile.id]?.status : null) || null;

  const triggerBurst = () => setBurstKey(key => key + 1);

  const submit = async (status: NetworkingStatus | null) => {
    if (!session || !tokenOk || !surveyEnabled) return;
    if (!profile) {
      const message = nameQuery.trim() ? '등록된 이름을 찾을 수 없습니다.' : '본인 이름을 먼저 검색해주세요.';
      setNameError(message);
      toast.error(message);
      return;
    }

    setSubmitting(status || targetStatus);
    const { data, error: fetchError } = await supabase
      .from('sessions')
      .select('notes')
      .eq('id', session.id)
      .single();

    if (fetchError) {
      setSubmitting(null);
      toast.error('조사 정보를 불러오지 못했습니다.');
      return;
    }

    const parsed = parseSessionNotes(data?.notes);
    const sourceResponses = audience === 'staff'
      ? parsed.networking.staff_responses
      : parsed.networking.responses;
    const nextResponses = { ...sourceResponses };

    if (status) {
      nextResponses[profile.id] = {
        member_id: profile.id,
        member_name: profile.full_name,
        status,
        updated_at: new Date().toISOString(),
      };
    } else {
      delete nextResponses[profile.id];
    }

    const nextNetworking = {
      ...parsed.networking,
      updated_at: new Date().toISOString(),
      responses: audience === 'member' ? nextResponses : parsed.networking.responses,
      staff_responses: audience === 'staff' ? nextResponses : parsed.networking.staff_responses,
    };

    const { error } = await supabase
      .from('sessions')
      .update({ notes: serializeSessionNotes(parsed.text, nextNetworking) })
      .eq('id', session.id);

    setSubmitting(null);

    if (error) {
      toast.error('응답 저장에 실패했습니다.');
      return;
    }

    setLocalStatus(status);
    triggerBurst();
    await refreshData();
    toast.success(status ? `${networkingStatusLabel[status]}로 저장되었습니다.` : '체크를 취소했습니다.');
  };

  const dateLabel = session
    ? new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
    : '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grid bg-soft-gradient">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const unavailable = !session || !tokenOk;
  const closed = !unavailable && !surveyEnabled;
  const isStaff = audience === 'staff';
  const title = isStaff ? '운영진 네트워킹 참여 체크' : '학회원 네트워킹 미참 체크';
  const mode = isStaff
    ? {
      badge: '운영진용',
      eyebrow: '가는 운영진만',
      headline: '참여하면 체크',
      subhead: '세션도 오고 네트워킹도 함께 가는 운영진만 응답합니다.',
      primaryRule: '참여하는 운영진',
      primaryRuleDetail: '세션 + 네트워킹 모두 참여',
      secondaryRule: '세션/네트워킹 불참자',
      secondaryRuleDetail: '체크하지 않아도 됩니다',
      actionLabel: '참여합니다',
      actionHelper: '이번 세션과 네트워킹에 모두 참여합니다',
      doneTitle: '참여 체크 완료',
      doneHelper: '운영진 참여자로 집계되었습니다.',
      accentClass: 'from-blue-700 via-blue-500 to-cyan-400',
      actionClassName: 'networking-action networking-action-staff',
      ruleClassName: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
      icon: Check,
      ruleIcon: CheckCircle2,
    }
    : {
      badge: '학회원용',
      eyebrow: '못 가는 사람만',
      headline: '미참이면 체크',
      subhead: '해당 없으면 이 페이지에서 아무것도 하지 않아도 됩니다.',
      primaryRule: '미참 학회원',
      primaryRuleDetail: '못 가는 경우에만 체크',
      secondaryRule: '해당 없는 학회원',
      secondaryRuleDetail: '그냥 닫으면 됩니다',
      actionLabel: '미참합니다',
      actionHelper: '이번 네트워킹은 참여하지 않습니다',
      doneTitle: '미참 체크 완료',
      doneHelper: '네트워킹 미참자로 집계되었습니다.',
      accentClass: 'from-blue-600 via-sky-500 to-cyan-400',
      actionClassName: 'networking-action networking-action-member',
      ruleClassName: 'border-sky-500/25 bg-sky-500/10 text-blue-700',
      icon: X,
      ruleIcon: CircleSlash2,
    };
  const actionLabel = mode.actionLabel;
  const actionHelper = mode.actionHelper;
  const actionIcon = mode.icon;
  const ActionIcon = actionIcon;
  const RuleIcon = mode.ruleIcon;
  const actionClassName = mode.actionClassName;

  return (
    <div className="networking-screen min-h-screen bg-grid bg-soft-gradient">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-4">
        <header className="flex items-center gap-2">
          <div className="networking-logo-spark">
            <img src={hysparkLogo} alt="하이스파크 pre" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-none tracking-tight">하이스파크 pre</p>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground">{title}</p>
          </div>
        </header>

        <main className="flex flex-1 items-center py-6">
          <Surface className="networking-shell w-full overflow-hidden rounded-[30px] p-0 shadow-xl shadow-primary/10">
            {burstKey > 0 && (
              <div key={burstKey} className="networking-burst" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
            {unavailable ? (
              <div className="p-8 text-center">
                <p className="text-lg font-extrabold">유효하지 않은 링크입니다</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  운영진이 보낸 링크로 다시 접속해주세요.
                </p>
              </div>
            ) : closed ? (
              <div className="p-8 text-center">
                <p className="text-lg font-extrabold">아직 조사가 열리지 않았습니다</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  운영진이 조사를 열면 이 링크에서 바로 응답할 수 있습니다.
                </p>
              </div>
            ) : (
              <div>
                <div className={cn('networking-hero bg-gradient-to-br px-5 pb-5 pt-5 text-white', mode.accentClass)}>
                  <div className="networking-hero-orb networking-hero-orb-a" />
                  <div className="networking-hero-orb networking-hero-orb-b" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black opacity-85">{dateLabel}</p>
                      <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight">{session.title}</h1>
                    </div>
                    <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-black shadow-sm shadow-white/10 backdrop-blur">
                      {mode.badge}
                    </span>
                  </div>
                  <div className="networking-glass-panel mt-5 rounded-3xl bg-white/14 p-4 shadow-inner shadow-white/10 ring-1 ring-white/18 backdrop-blur">
                    <p className="text-sm font-black opacity-85">{mode.eyebrow}</p>
                    <p className="mt-1 text-[34px] font-black leading-tight tracking-tight">{mode.headline}</p>
                    <p className="mt-2 text-sm font-semibold leading-5 text-white/88">{mode.subhead}</p>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className={cn('networking-rule-card rounded-2xl border p-3', mode.ruleClassName)}>
                      <div className="flex items-center gap-2">
                        <RuleIcon className="h-4 w-4" />
                        <p className="text-xs font-black">{mode.primaryRule}</p>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold opacity-80">{mode.primaryRuleDetail}</p>
                    </div>
                    <div className="networking-rule-card rounded-2xl border border-border/70 bg-white/75 p-3 text-muted-foreground shadow-sm shadow-blue-500/5 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <p className="text-xs font-black">{mode.secondaryRule}</p>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold opacity-80">{mode.secondaryRuleDetail}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                  <label htmlFor="networking-name" className="flex items-center gap-2 text-xs font-black text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">1</span>
                    이름 검색
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="networking-name"
                      value={profile && selectedProfileId ? profile.full_name : nameQuery}
                      onChange={event => {
                        setNameQuery(event.target.value);
                        setSelectedProfileId('');
                        setLocalStatus(null);
                        setNameError('');
                      }}
                      autoComplete="off"
                      placeholder="이름을 검색하세요"
                      className="networking-name-input h-14 rounded-2xl border-primary/15 bg-white/80 pl-9 text-lg font-black shadow-sm shadow-blue-500/10 backdrop-blur"
                    />
                  </div>
                  {nameError && (
                    <p className="text-xs font-semibold text-destructive">{nameError}</p>
                  )}
                  {suggestedProfiles.length > 0 && !selectedProfileId && (
                    <div className="overflow-hidden rounded-2xl border border-blue-100/80 bg-white/90 shadow-lg shadow-blue-500/10 backdrop-blur">
                      {suggestedProfiles.map(item => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            triggerBurst();
                            setSelectedProfileId(item.id);
                            setNameQuery(item.full_name);
                            setLocalStatus(null);
                            setNameError('');
                          }}
                          className="networking-suggestion-row app-focus-ring flex w-full items-center justify-between border-b border-border/60 px-3 py-3.5 text-left text-base font-black last:border-b-0 hover:bg-primary/5"
                        >
                          <span>{item.full_name}</span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">선택</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {profile && (
                    <div className="networking-selected-name flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm font-black text-primary">
                      <UserCheck className="h-4 w-4" />
                      {profile.full_name}님으로 체크합니다
                    </div>
                  )}
                </div>

                {currentStatus && (
                  <div className={cn('networking-rule-card rounded-3xl border px-4 py-4', mode.ruleClassName)}>
                    <p className="text-xs font-black opacity-80">현재 응답</p>
                    <p className="mt-1 text-xl font-black">{mode.doneTitle}</p>
                    <p className="mt-1 text-xs font-semibold opacity-75">{mode.doneHelper}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-black text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">2</span>
                    해당되는 경우만 누르기
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerBurst();
                      submit(targetStatus);
                    }}
                    disabled={!!submitting}
                    className={cn(
                      'app-focus-ring flex w-full items-center justify-between rounded-3xl border px-5 py-5 text-left transition active:scale-[0.99] disabled:opacity-60',
                      actionClassName
                    )}
                  >
                    <span>
                      <span className="block text-2xl font-black">{actionLabel}</span>
                      <span className="mt-1 block text-sm font-semibold opacity-80">{actionHelper}</span>
                    </span>
                    {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <ActionIcon className="h-7 w-7" />}
                  </button>
                  {currentStatus && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        triggerBurst();
                        submit(null);
                      }}
                      disabled={!!submitting}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 체크 취소
                    </Button>
                  )}
                </div>

                <p className="text-center text-[11px] leading-5 text-muted-foreground">
                  잘못 체크했다면 취소할 수 있습니다.
                </p>
                </div>
              </div>
            )}
          </Surface>
        </main>
      </div>
    </div>
  );
}
