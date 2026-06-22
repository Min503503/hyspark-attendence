import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Loader2, Mail, Send, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { adminApi, invokeWithAdminToken } from '@/lib/adminApi';
import { PUBLIC_URLS } from '@/lib/brand';
import { GMAIL_SENDER } from '@/lib/mail';
import {
  EMAIL_KIND_LABELS,
  EmailTemplateKind,
  SAMPLE_EMAIL_DATA,
  buildEmailSubject,
  buildManualEmailHtml,
  manualEmailHeadline,
} from '@/lib/emailHtmlTemplates';
import {
  AUTOMATION_TIMING,
  EmailAutomationRule,
  EmailAutomationRun,
  EmailSendLog,
  findRuleForKind,
  orderedStandardRules,
} from '@/lib/emailAutomation';
import {
  AUTOMATION_SCHEDULE_POLICY,
  describeAutomationSendForSession,
  upcomingAutomationSessions,
} from '@/lib/emailSchedule';
import { buildPreviewHtmlAsync, sendTemplateEmails } from '@/lib/emailTestSend';
import { TEST_EMAIL_RECIPIENT } from '@/lib/emailTestPolicy';
import {
  buildCampSurveyPreviewHtml,
  buildCampSurveyPreviewHtmlAsync,
  formatCampTodayLabel,
  sendCampSurveyTestEmails,
} from '@/lib/campSurveyEmail';
import { memberPortalUrlForProfile } from '@/lib/memberPortalToken';
import { memberPortalUrl } from '@/lib/brand';
import MemberRecipientPicker from '@/components/MemberRecipientPicker';
import { PageHeader, PageShell, Panel, AdminTabBar, StatusPill } from '@/components/app-ui';

const TEST_SESSION_PREFIX = '[테스트]';
import { cn } from '@/lib/utils';
import type { Session } from '@/types';

const TEST_KINDS: EmailTemplateKind[] = [
  'session_reminder_5d',
  'session_reminder_1d',
  'session_open',
  'checkin_complete',
];

function injectPreviewLogo(html: string) {
  if (typeof window === 'undefined') return html;
  const logoUrl = `${window.location.origin}/hyspark-logo.png`;
  return html.replaceAll(PUBLIC_URLS.emailLogo, logoUrl);
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function previewSessionForKind(kind: EmailTemplateKind, sessions: Session[]): Session | null {
  const real = sessions.filter(
    session => !session.title.startsWith(TEST_SESSION_PREFIX) && session.status !== 'archived',
  );
  if (real.length === 0) return null;

  const upcoming = real
    .filter(session => new Date(session.start_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  if (upcoming.length > 0) return upcoming[0];

  return [...real].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())[0];
}

export default function AdminEmail() {
  const { members, sessions } = useApp();
  const [rules, setRules] = useState<EmailAutomationRule[]>([]);
  const [logs, setLogs] = useState<EmailSendLog[]>([]);
  const [automationRuns, setAutomationRuns] = useState<EmailAutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [activeTab, setActiveTab] = useState('automation');
  const [selectedRuleKind, setSelectedRuleKind] = useState<EmailTemplateKind>('session_reminder_5d');
  const [automationPreviewMemberId, setAutomationPreviewMemberId] = useState('');
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);

  const [testKind, setTestKind] = useState<EmailTemplateKind>('session_reminder_5d');
  const [testSessionId, setTestSessionId] = useState('');
  const [testRecipientIds, setTestRecipientIds] = useState<string[]>([]);
  const [sendingTest, setSendingTest] = useState(false);

  const [manualSubject, setManualSubject] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [manualRecipientIds, setManualRecipientIds] = useState<string[]>([]);
  const [sendingManual, setSendingManual] = useState(false);
  const [campSettings, setCampSettings] = useState<{
    title: string;
    start_date: string;
    end_date: string;
    daily_open_time: string;
    daily_close_time: string;
    enabled: boolean;
  } | null>(null);
  const [sendingCampTest, setSendingCampTest] = useState(false);
  const [automationPreviewHtml, setAutomationPreviewHtml] = useState('');
  const [testPreviewHtml, setTestPreviewHtml] = useState('');
  const [campPreviewHtml, setCampPreviewHtml] = useState('');
  const [campSurveyMemberLink, setCampSurveyMemberLink] = useState(memberPortalUrl('camp-survey'));

  const membersWithEmail = useMemo(
    () => members.filter(m => m.status === 'active' && m.email),
    [members],
  );

  const standardRules = useMemo(() => orderedStandardRules(rules), [rules]);

  const automationSessions = useMemo(
    () => upcomingAutomationSessions(
      sessions.filter(session => !session.title.startsWith(TEST_SESSION_PREFIX)),
    ),
    [sessions],
  );

  const latestAutomationRun = automationRuns[0] ?? null;

  const cronLooksStale = useMemo(() => {
    if (!latestAutomationRun) return true;
    const ageMs = Date.now() - new Date(latestAutomationRun.checked_at).getTime();
    return ageMs > 15 * 60 * 1000;
  }, [latestAutomationRun]);

  const selectedRuleEntry = useMemo(
    () => standardRules.find(entry => entry.fixed.kind === selectedRuleKind) || standardRules[0],
    [standardRules, selectedRuleKind],
  );

  const automationPreviewSession = useMemo(
    () => previewSessionForKind(selectedRuleKind, sessions),
    [selectedRuleKind, sessions],
  );

  const selectableSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
    [sessions],
  );

  const selectedTestSession = useMemo(
    () => selectableSessions.find(session => session.id === testSessionId),
    [selectableSessions, testSessionId],
  );

  const automationPreviewMember = useMemo(
    () => membersWithEmail.find(member => member.id === automationPreviewMemberId) || membersWithEmail[0],
    [membersWithEmail, automationPreviewMemberId],
  );

  const automationPreviewMemberName = automationPreviewMember?.full_name || '홍길동';

  const previewMember = useMemo(() => {
    const picked = membersWithEmail.find(member => testRecipientIds.includes(member.id));
    return picked || membersWithEmail[0];
  }, [membersWithEmail, testRecipientIds]);

  const automationPreviewSubject = useMemo(() => {
    const sample = SAMPLE_EMAIL_DATA[selectedRuleKind];
    if (automationPreviewSession) {
      return buildEmailSubject(selectedRuleKind, {
        ...sample,
        sessionTitle: automationPreviewSession.title,
      });
    }
    return buildEmailSubject(selectedRuleKind, sample);
  }, [selectedRuleKind, automationPreviewSession]);

  useEffect(() => {
    if (!automationPreviewMember) {
      setAutomationPreviewHtml('');
      return;
    }
    let cancelled = false;
    const checkInExtra = selectedRuleKind === 'checkin_complete'
      ? { checkedInAt: new Date().toISOString(), attendanceStatus: 'present' as const }
      : undefined;
    const session = automationPreviewSession ?? {
      id: 'sample',
      title: SAMPLE_EMAIL_DATA[selectedRuleKind].sessionTitle,
      start_at: new Date().toISOString(),
      venue_name: SAMPLE_EMAIL_DATA[selectedRuleKind].venueName,
      venue_map_url: SAMPLE_EMAIL_DATA[selectedRuleKind].venueMapsUrl,
      check_in_open_minutes: SAMPLE_EMAIL_DATA[selectedRuleKind].checkInOpenMinutes ?? 15,
      geofence_radius_m: 100,
      session_code: 'sample',
      attendance_code: null,
      attendance_code_status: 'inactive' as const,
      attendance_code_issued_at: null,
      attendance_code_expires_at: null,
      qr_token: 'sample',
      status: 'scheduled' as const,
      attendance_rate: null,
    };

    void buildPreviewHtmlAsync(selectedRuleKind, session, automationPreviewMember, checkInExtra)
      .then(html => {
        if (!cancelled) setAutomationPreviewHtml(injectPreviewLogo(html));
      })
      .catch(err => {
        if (!cancelled) {
          console.error(err);
          setAutomationPreviewHtml('');
          toast.error('미리보기 링크 생성 실패 — 관리자 로그인 상태를 확인하세요.');
        }
      });

    return () => { cancelled = true; };
  }, [automationPreviewSession, automationPreviewMember, selectedRuleKind]);

  useEffect(() => {
    if (!selectedTestSession || !previewMember) {
      setTestPreviewHtml('');
      return;
    }
    let cancelled = false;
    const checkInExtra = testKind === 'checkin_complete'
      ? { checkedInAt: new Date().toISOString(), attendanceStatus: 'present' as const }
      : undefined;

    void buildPreviewHtmlAsync(testKind, selectedTestSession, previewMember, checkInExtra)
      .then(html => {
        if (!cancelled) setTestPreviewHtml(injectPreviewLogo(html));
      })
      .catch(err => {
        if (!cancelled) {
          console.error(err);
          setTestPreviewHtml('');
        }
      });

    return () => { cancelled = true; };
  }, [selectedTestSession, previewMember, testKind]);

  const manualPreviewMember = useMemo(() => {
    const picked = membersWithEmail.find(member => manualRecipientIds.includes(member.id));
    return picked || membersWithEmail[0];
  }, [membersWithEmail, manualRecipientIds]);

  const campTestMember = useMemo(
    () => membersWithEmail.find(
      member => member.email?.trim().toLowerCase() === TEST_EMAIL_RECIPIENT.toLowerCase(),
    ),
    [membersWithEmail],
  );

  const campDateRange = campSettings
    ? `${campSettings.start_date} ~ ${campSettings.end_date}`
    : '—';

  useEffect(() => {
    if (!campSettings) {
      setCampPreviewHtml('');
      return;
    }
    const member = campTestMember;
    if (!member) {
      setCampPreviewHtml(injectPreviewLogo(buildCampSurveyPreviewHtml({
        memberName: '홍길동',
        campTitle: campSettings.title,
        campDateRange,
      })));
      setCampSurveyMemberLink(memberPortalUrl('camp-survey'));
      return;
    }
    let cancelled = false;
    void buildCampSurveyPreviewHtmlAsync({
      memberId: member.id,
      memberName: member.full_name,
      campTitle: campSettings.title,
      campDateRange,
    }).then(html => {
      if (!cancelled) setCampPreviewHtml(injectPreviewLogo(html));
    });
    void memberPortalUrlForProfile('camp-survey', member.id).then(link => {
      if (!cancelled) setCampSurveyMemberLink(link);
    });
    return () => { cancelled = true; };
  }, [campDateRange, campSettings, campTestMember]);

  const campReminderLogs = useMemo(
    () => logs.filter(log => log.dedupe_key?.startsWith('camp-survey-') || log.subject.includes('캠프 참여 시간')),
    [logs],
  );

  const manualPreviewHtml = useMemo(() => {
    const subject = manualSubject.trim();
    const body = manualBody.trim();
    if (!subject || !body || !manualPreviewMember) return '';
    return injectPreviewLogo(buildManualEmailHtml({
      memberName: manualPreviewMember.full_name,
      headline: manualEmailHeadline(subject),
      bodyText: body,
    }));
  }, [manualSubject, manualBody, manualPreviewMember]);

  const load = useCallback(async () => {
    setLoading(true);
    const syncResult = await adminApi('sync_automation_rules', {});
    if (syncResult.error) toast.error(`규칙 동기화 실패: ${syncResult.error.message}`);
    const [rulesRes, logsRes, runsRes, campRes] = await Promise.all([
      supabase.from('email_automation_rules').select('*').order('sort_order'),
      supabase.from('email_send_logs').select('*').order('sent_at', { ascending: false }).limit(30),
      supabase.from('email_automation_runs').select('*').order('checked_at', { ascending: false }).limit(10),
      supabase.from('camp_settings').select('title, start_date, end_date, daily_open_time, daily_close_time, enabled').eq('enabled', true).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (rulesRes.error) toast.error(rulesRes.error.message);
    else setRules((rulesRes.data || []) as EmailAutomationRule[]);
    if (logsRes.error) toast.error(`발송 로그 불러오기 실패: ${logsRes.error.message}`);
    else setLogs((logsRes.data || []) as EmailSendLog[]);
    if (runsRes.error) toast.error(`자동화 실행 기록 불러오기 실패: ${runsRes.error.message}`);
    else setAutomationRuns((runsRes.data || []) as EmailAutomationRun[]);
    if (campRes.data) setCampSettings(campRes.data);
    else setCampSettings(null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (membersWithEmail.length === 0) return;
    const testMember = membersWithEmail.find(
      member => member.email?.trim().toLowerCase() === TEST_EMAIL_RECIPIENT.toLowerCase(),
    );
    setTestRecipientIds(prev => (
      prev.length > 0 ? prev : testMember ? [testMember.id] : []
    ));
    setManualRecipientIds(prev => (prev.length > 0 ? prev : membersWithEmail.map(member => member.id)));
    setAutomationPreviewMemberId(prev => (
      prev && membersWithEmail.some(member => member.id === prev)
        ? prev
        : membersWithEmail[0].id
    ));
  }, [membersWithEmail]);

  useEffect(() => {
    if (testSessionId || selectableSessions.length === 0) return;
    setTestSessionId(selectableSessions[0].id);
  }, [selectableSessions, testSessionId]);

  const toggleRule = async (rule: EmailAutomationRule) => {
    const nextEnabled = !rule.enabled;
    setTogglingRuleId(rule.id);
    setRules(prev => prev.map(item => (
      item.id === rule.id ? { ...item, enabled: nextEnabled } : item
    )));

    const { error } = await adminApi('toggle_automation_rule', {
      ruleId: rule.id,
      enabled: nextEnabled,
    });

    setTogglingRuleId(null);

    if (error) {
      setRules(prev => prev.map(item => (
        item.id === rule.id ? { ...item, enabled: rule.enabled } : item
      )));
      toast.error(error.message);
      return;
    }

    toast.success(nextEnabled ? `${rule.name} 자동 발송을 켰습니다.` : `${rule.name} 자동 발송을 껐습니다.`);
  };

  const selectRuleKind = (kind: EmailTemplateKind) => {
    setSelectedRuleKind(kind);
    setTestKind(kind);
  };

  const runAutomationNow = async () => {
    setRunningAutomation(true);
    const { data, error } = await invokeWithAdminToken('auto-open-sessions', {
      body: { trigger_source: 'admin_manual' },
    });
    setRunningAutomation(false);

    if (error) {
      toast.error(error.message || '자동화 실행 실패');
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }

    const email = data?.emailAutomation as { sent?: number; skipped?: number; failed?: number } | undefined;
    toast.success(
      `자동화 완료 · 발송 ${email?.sent ?? 0} · 스킵 ${email?.skipped ?? 0} · 실패 ${email?.failed ?? 0}`,
    );
    load();
  };

  const sendTestMail = async () => {
    if (!selectedTestSession) {
      toast.error('세션을 선택해주세요.');
      return;
    }
    if (testRecipientIds.length === 0) {
      toast.error('수신자를 선택해주세요.');
      return;
    }

    const recipients = membersWithEmail.filter(member => testRecipientIds.includes(member.id));
    if (recipients.every(member => member.email?.trim().toLowerCase() !== TEST_EMAIL_RECIPIENT.toLowerCase())) {
      toast.error(`테스트 발송은 ${TEST_EMAIL_RECIPIENT} 만 가능합니다.`);
      return;
    }

    const rule = findRuleForKind(rules, testKind);

    setSendingTest(true);
    const { error, sent } = await sendTemplateEmails({
      kind: testKind,
      session: selectedTestSession,
      members: recipients,
      ruleId: rule?.id,
      checkInExtra: testKind === 'checkin_complete'
        ? { checkedInAt: new Date().toISOString(), attendanceStatus: 'present' }
        : undefined,
    });
    setSendingTest(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${EMAIL_KIND_LABELS[testKind]} 메일 ${sent}건 발송`);
    load();
  };

  const sendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSubject.trim() || !manualBody.trim()) {
      toast.error('제목과 본문을 입력해주세요.');
      return;
    }
    if (manualRecipientIds.length === 0) {
      toast.error('수신자를 선택해주세요.');
      return;
    }

    setSendingManual(true);
    const { data, error } = await invokeWithAdminToken('send-member-email', {
      body: {
        recipientIds: manualRecipientIds,
        subject: manualSubject.trim(),
        body: manualBody.trim(),
        manual: true,
      },
    });
    setSendingManual(false);

    if (error) {
      toast.error(error.message || '발송 실패');
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }

    toast.success(`${data.sent}명에게 발송했습니다.`);
    setManualSubject('');
    setManualBody('');
    load();
  };

  const sendCampTestMail = async () => {
    if (!campSettings) {
      toast.error('활성화된 캠프 설정이 없습니다.');
      return;
    }
    if (!campTestMember) {
      toast.error(`테스트 발송은 ${TEST_EMAIL_RECIPIENT} 등록 멤버가 필요합니다.`);
      return;
    }

    setSendingCampTest(true);
    const { error, sent } = await sendCampSurveyTestEmails({
      members: [campTestMember],
      campTitle: campSettings.title,
      campDateRange,
    });
    setSendingCampTest(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`캠프 설문 리마인드 테스트 ${sent}건 발송 (${TEST_EMAIL_RECIPIENT})`);
    load();
  };

  const sessionTitle = (sessionId: string | null) =>
    sessions.find(s => s.id === sessionId)?.title || '-';

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="메일"
        description={`Gmail(${GMAIL_SENDER}) · 세션 일정에 맞춰 자동 발송됩니다`}
      />

      <AdminTabBar
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'automation', label: '자동 발송' },
          { id: 'camp', label: '캠프 설문' },
          { id: 'test', label: '테스트 발송' },
          { id: 'send', label: '수동 발송' },
          { id: 'logs', label: '발송 로그' },
        ]}
      />

      {activeTab === 'automation' && (
        <>
          <Panel
            title="자동화 실행 상태"
            icon={Activity}
            description="10분마다 + 월요일 10:00(KST)에 서버가 자동 실행합니다. 아래에서 마지막 결과를 확인하세요."
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-xs">
                  <div className="font-bold text-muted-foreground">스케줄</div>
                  <div className="mt-1 font-medium">매 10분 · 월요일 10:00 (5일 전 보강)</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-xs">
                  <div className="font-bold text-muted-foreground">마지막 실행</div>
                  <div className="mt-1 font-medium">
                    {latestAutomationRun
                      ? `${formatRelativeTime(latestAutomationRun.checked_at)} · ${new Date(latestAutomationRun.checked_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                      : '아직 기록 없음'}
                  </div>
                </div>
              </div>

              {latestAutomationRun && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusPill tone="accent">발송 {latestAutomationRun.sent}</StatusPill>
                  <StatusPill tone="neutral">스킵 {latestAutomationRun.skipped}</StatusPill>
                  <StatusPill tone={latestAutomationRun.failed > 0 ? 'danger' : 'neutral'}>
                    실패 {latestAutomationRun.failed}
                  </StatusPill>
                  <StatusPill tone="neutral">오픈 {latestAutomationRun.opened}</StatusPill>
                  <StatusPill tone="neutral">마감 {latestAutomationRun.closed}</StatusPill>
                </div>
              )}

              {cronLooksStale && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                  15분 이상 자동 실행 기록이 없습니다. cron이 아직 안 붙었거나 멈춘 상태일 수 있습니다. 아래 버튼으로 수동 실행해 보세요.
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                disabled={runningAutomation}
                onClick={() => void runAutomationNow()}
              >
                {runningAutomation
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  : <Activity className="mr-1.5 h-4 w-4" />}
                지금 자동화 실행
              </Button>
            </div>
          </Panel>

          <Panel
            title="자동 발송 규칙"
            icon={Settings2}
            description="규칙을 누르면 해당 상황의 메일 설정과 실제 발송 형태를 확인할 수 있습니다."
          >
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {standardRules.map(({ fixed, rule }, index) => {
                    const selected = selectedRuleKind === fixed.kind;
                    return (
                      <button
                        key={fixed.kind}
                        type="button"
                        onClick={() => selectRuleKind(fixed.kind)}
                        className={cn(
                          'flex items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border/60 bg-secondary/20 hover:bg-secondary/40',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-primary">{String.fromCharCode(9312 + index)}</span>
                            <span className="font-bold text-sm">{fixed.name}</span>
                            <StatusPill tone={rule?.enabled ? 'success' : 'neutral'}>{rule?.enabled ? 'ON' : 'OFF'}</StatusPill>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{fixed.description}</p>
                          <p className="mt-1.5 text-[11px] font-semibold text-primary">
                            {AUTOMATION_SCHEDULE_POLICY[fixed.kind]}
                          </p>
                          {automationSessions[0] ? (
                            <p className="mt-0.5 text-[11px] font-medium text-foreground/80">
                              {describeAutomationSendForSession(fixed.kind, automationSessions[0])}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">예정된 세션 없음</p>
                          )}
                        </div>
                        {rule && (
                          <div
                            className="shrink-0 pt-0.5"
                            onClick={event => event.stopPropagation()}
                            onKeyDown={event => event.stopPropagation()}
                          >
                            <Switch
                              checked={rule.enabled}
                              disabled={togglingRuleId === rule.id}
                              onCheckedChange={() => void toggleRule(rule)}
                              aria-label={`${fixed.name} 활성화`}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedRuleEntry && (
                  <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-extrabold">{selectedRuleEntry.fixed.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{AUTOMATION_TIMING[selectedRuleEntry.fixed.kind]}</p>
                      </div>
                      {selectedRuleEntry.rule && (
                        <StatusPill tone={selectedRuleEntry.rule.enabled ? 'success' : 'neutral'}>
                          자동 발송 {selectedRuleEntry.rule.enabled ? 'ON' : 'OFF'}
                        </StatusPill>
                      )}
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <div className="font-bold text-muted-foreground">발송 조건</div>
                        <div className="mt-1 font-medium">{AUTOMATION_SCHEDULE_POLICY[selectedRuleEntry.fixed.kind]}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {AUTOMATION_TIMING[selectedRuleEntry.fixed.kind]}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <div className="font-bold text-muted-foreground">메일 제목</div>
                        <div className="mt-1 font-medium break-all">{automationPreviewSubject}</div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 sm:col-span-2">
                        <div className="font-bold text-muted-foreground">다가오는 세션 발송 예정</div>
                        {automationSessions.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {automationSessions.map(session => (
                              <div
                                key={session.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/30 px-2.5 py-2"
                              >
                                <span className="min-w-0 truncate font-medium">{session.title}</span>
                                <span className="shrink-0 font-semibold text-primary">
                                  {describeAutomationSendForSession(selectedRuleEntry.fixed.kind, session)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 font-medium text-muted-foreground">예정된 세션이 없습니다.</div>
                        )}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 sm:col-span-2">
                        <div className="font-bold text-muted-foreground">미리보기 기준 세션</div>
                        <div className="mt-1 font-medium">
                          {automationPreviewSession
                            ? automationPreviewSession.title
                            : '샘플 세션 데이터'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>미리보기 멤버</Label>
                      <Select
                        value={automationPreviewMemberId}
                        onValueChange={setAutomationPreviewMemberId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="멤버 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {membersWithEmail.map(member => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
                              {member.email ? ` · ${member.email}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        선택한 멤버 이름으로 인사말이 표시됩니다. 실제 자동 발송은 활성 학회원 각자에게 개별 발송됩니다.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border/60 bg-[#eceff1]">
                      <div className="border-b border-border/40 bg-background/90 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {automationPreviewMemberName}님 기준 미리보기
                      </div>
                      <iframe
                        title={`${EMAIL_KIND_LABELS[selectedRuleKind]} 자동 발송 미리보기`}
                        srcDoc={automationPreviewHtml}
                        className="mx-auto block h-[620px] w-full bg-white"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}

      {activeTab === 'camp' && (
        <div className="space-y-4">
          <Panel
            title="캠프 일일 설문 — 어떻게 가나요?"
            icon={Sparkles}
            description="세션 출석과 별도. 캠프 기간 중 매일 밤 리마인드 메일 → 멤버가 참여 시간(또는 출석 안 함) 제출."
          >
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                불러오는 중…
              </div>
            ) : campSettings ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-xs">
                    <div className="font-bold text-muted-foreground">캠프</div>
                    <div className="mt-1 font-semibold">{campSettings.title}</div>
                    <div className="mt-0.5 text-muted-foreground">{campDateRange}</div>
                    <div className="mt-0.5 text-muted-foreground">
                      운영 {campSettings.daily_open_time.slice(0, 5)}-{campSettings.daily_close_time.slice(0, 5)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-xs">
                    <div className="font-bold text-muted-foreground">자동 발송</div>
                    <div className="mt-1 font-medium">매일 22:00 (KST)</div>
                    <div className="mt-0.5 text-muted-foreground">활성 학회원 전원 · 이메일 등록자</div>
                    <StatusPill tone={campSettings.enabled ? 'success' : 'neutral'} className="mt-2">
                      {campSettings.enabled ? '캠프 ON' : '캠프 OFF'}
                    </StatusPill>
                  </div>
                </div>

                <ol className="space-y-2 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-sm leading-relaxed">
                  <li><strong>1.</strong> 22:00에 「오늘 캠프 참여 시간 입력」 리마인드 메일 자동 발송</li>
                  <li><strong>2.</strong> 멤버가 메일 링크에서 설문 작성 (멤버 홈에는 노출되지 않음)</li>
                  <li><strong>3.</strong> 「참여함」→ 시간 입력 · 「오늘 출석 안 함」 선택 가능</li>
                  <li><strong>4.</strong> 참여 5시간마다 벌점 0.25점 상쇄 (출석 안 함은 상쇄 없음)</li>
                  <li><strong>5.</strong> 응답 집계는 <strong>세션</strong> 메뉴 → 캠프 일일 설문 패널</li>
                </ol>

                <div className="space-y-1.5">
                  <Label>멤버 설문 링크 (메일 CTA와 동일)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 break-all rounded-lg bg-secondary/50 px-3 py-2 text-xs">{campSurveyMemberLink}</code>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={campSurveyMemberLink} target="_blank" rel="noopener noreferrer">열기</a>
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-xs">
                  <div className="font-bold text-muted-foreground">오늘 기준 미리보기 일자</div>
                  <div className="mt-1 font-medium">{formatCampTodayLabel()}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">활성화된 캠프가 없습니다. 세션 페이지에서 캠프 ON/OFF를 확인하세요.</p>
            )}
          </Panel>

          {campSettings && (
            <Panel title="리마인드 메일 미리보기" icon={Mail}>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {campTestMember?.full_name || '홍길동'}님 기준 · 실제 22:00 자동 발송과 동일한 HTML
                </p>
                {campPreviewHtml && (
                  <iframe
                    title="캠프 설문 리마인드 미리보기"
                    srcDoc={campPreviewHtml}
                    className="mx-auto block h-[560px] w-full rounded-xl border border-border/60 bg-[#eceff1]"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                  />
                )}
                <Button
                  className="w-full sm:w-auto"
                  disabled={sendingCampTest || !campTestMember}
                  onClick={() => void sendCampTestMail()}
                >
                  {sendingCampTest ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  테스트 발송 ({TEST_EMAIL_RECIPIENT})
                </Button>
                {!campTestMember && (
                  <p className="text-xs text-destructive">멤버 관리에 {TEST_EMAIL_RECIPIENT} 이메일이 등록되어 있어야 테스트 발송할 수 있습니다.</p>
                )}
              </div>
            </Panel>
          )}

          {campReminderLogs.length > 0 && (
            <Panel title="최근 캠프 리마인드 발송" icon={Activity}>
              <div className="space-y-2">
                {campReminderLogs.slice(0, 10).map(log => (
                  <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold">{log.email}</p>
                      <p className="text-muted-foreground">{log.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={log.status === 'sent' ? 'success' : 'danger'}>{log.status}</StatusPill>
                      <span className="text-muted-foreground">
                        {new Date(log.sent_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {activeTab === 'test' && (
        <Panel
          title="테스트 발송"
          icon={Send}
          description={`실제 세션·수신자 기준으로 HTML을 확인하고 발송합니다. 테스트 발송은 ${TEST_EMAIL_RECIPIENT} 만 가능합니다.`}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>발송 규칙</Label>
                <Select value={testKind} onValueChange={value => setTestKind(value as EmailTemplateKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEST_KINDS.map(kind => (
                      <SelectItem key={kind} value={kind}>{EMAIL_KIND_LABELS[kind]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>세션</Label>
                <Select value={testSessionId} onValueChange={setTestSessionId}>
                  <SelectTrigger><SelectValue placeholder="세션 선택" /></SelectTrigger>
                  <SelectContent>
                    {selectableSessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.title.startsWith(TEST_SESSION_PREFIX) ? '🧪 ' : ''}{session.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>수신자</Label>
              <MemberRecipientPicker
                members={membersWithEmail}
                selectedIds={testRecipientIds}
                onChange={setTestRecipientIds}
              />
            </div>

            {testPreviewHtml && (
              <div className="space-y-2">
                <Label>실제 발송 미리보기 {previewMember ? `(${previewMember.full_name}님 기준)` : ''}</Label>
                <iframe
                  title="테스트 발송 미리보기"
                  srcDoc={testPreviewHtml}
                  className="mx-auto block h-[560px] w-full rounded-xl border border-border/60 bg-[#eceff1]"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
            )}

            <Button
              className="w-full sm:w-auto"
              disabled={sendingTest || !selectedTestSession || testRecipientIds.length === 0}
              onClick={() => void sendTestMail()}
            >
              {sendingTest ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {testRecipientIds.length}명에게 {EMAIL_KIND_LABELS[testKind]} 발송
            </Button>
          </div>
        </Panel>
      )}

      {activeTab === 'send' && (
        <Panel title="수동 발송" icon={Mail} description="공지 등 자유 형식 메일을 보냅니다. 실제 발송과 동일한 HTML로 미리 확인할 수 있습니다.">
          <form onSubmit={sendManual} className="space-y-4">
            <div className="space-y-2">
              <Label>수신자</Label>
              <MemberRecipientPicker
                members={membersWithEmail}
                selectedIds={manualRecipientIds}
                onChange={setManualRecipientIds}
              />
            </div>
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={manualSubject} onChange={e => setManualSubject(e.target.value)} placeholder="[HySpark] 공지" required />
            </div>
            <div className="space-y-2">
              <Label>본문</Label>
              <Textarea value={manualBody} onChange={e => setManualBody(e.target.value)} className="min-h-32" placeholder="학회원에게 보낼 내용" required />
            </div>

            {manualPreviewHtml && (
              <div className="space-y-2">
                <Label>실제 발송 미리보기 {manualPreviewMember ? `(${manualPreviewMember.full_name}님 기준)` : ''}</Label>
                <iframe
                  title="수동 발송 미리보기"
                  srcDoc={manualPreviewHtml}
                  className="mx-auto block h-[560px] w-full rounded-xl border border-border/60 bg-[#eceff1]"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
            )}

            <Button type="submit" disabled={sendingManual || manualRecipientIds.length === 0} className="w-full sm:w-auto">
              {sendingManual ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
              {manualRecipientIds.length}명에게 발송
            </Button>
          </form>
        </Panel>
      )}

      {activeTab === 'logs' && (
        <Panel title="최근 발송 로그" bodyClassName="p-0">
          <div className="divide-y divide-border/40 max-h-[480px] overflow-auto">
            {logs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">아직 발송 기록이 없습니다.</p>
            ) : logs.map(log => (
              <div key={log.id} className="px-4 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{log.subject}</span>
                  <StatusPill tone={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'danger' : 'neutral'}>
                    {log.status}
                  </StatusPill>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {log.email} · {sessionTitle(log.session_id)} · {new Date(log.sent_at).toLocaleString('ko-KR')}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
