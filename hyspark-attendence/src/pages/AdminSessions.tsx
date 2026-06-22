import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Pencil, Trash2, CalendarDays, Radio, Archive, Sparkles, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, Panel, StatGrid, StatusPill } from '@/components/app-ui';
import { adminApi } from '@/lib/adminApi';
import { formatCampDuration, formatCampParticipationLabel } from '@/lib/campSurvey';
import { Switch } from '@/components/ui/switch';

const statusLabel: Record<string, string> = {
  draft: '임시', scheduled: '예정', open: '진행 중', closed: '종료', archived: '보관',
};

type CampSettingsRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  daily_open_time: string;
  daily_close_time: string;
  enabled: boolean;
};

type CampResponseRow = {
  id: string;
  camp_id: string;
  profile_id: string;
  response_date: string;
  from_time: string;
  to_time: string;
  duration_minutes: number;
  demerit_credit: number;
  submitted_at: string;
  attended?: boolean;
  time_slots?: string[] | null;
  memberName?: string;
  profiles?: { full_name?: string; email?: string } | null;
};

function formatTimeValue(value: string) {
  return value.slice(0, 5);
}

export default function AdminSessions() {
  const { sessions, deleteSession, members, campResponsesByMember, refreshData } = useApp();
  const navigate = useNavigate();
  const [campSettings, setCampSettings] = useState<CampSettingsRow[]>([]);
  const [campResponses, setCampResponses] = useState<CampResponseRow[]>([]);
  const [campLoading, setCampLoading] = useState(true);
  const [campToggling, setCampToggling] = useState(false);

  const loadCamp = useCallback(async () => {
    setCampLoading(true);
    const [settingsRes, responsesRes] = await Promise.all([
      adminApi<{ settings?: CampSettingsRow[] }>('get_camp_settings', {}),
      adminApi<{ responses?: CampResponseRow[] }>('get_camp_responses', {}),
    ]);
    if (settingsRes.error) toast.error(settingsRes.error.message);
    else setCampSettings(settingsRes.data?.settings || []);
    if (responsesRes.error) toast.error(responsesRes.error.message);
    else setCampResponses(responsesRes.data?.responses || []);
    setCampLoading(false);
  }, []);

  useEffect(() => {
    loadCamp();
  }, [loadCamp]);

  const activeCamp = useMemo(
    () => campSettings.find(row => row.enabled) || campSettings[0] || null,
    [campSettings],
  );

  const campResponseRows = useMemo(() => {
    if (campResponses.length > 0) {
      return campResponses.map(row => ({
        ...row,
        memberName: row.profiles?.full_name || members.find(m => m.id === row.profile_id)?.full_name || '-',
        from_time: formatTimeValue(row.from_time),
        to_time: formatTimeValue(row.to_time),
      }));
    }
    return Object.entries(campResponsesByMember).flatMap(([profileId, entries]) => {
      const member = members.find(m => m.id === profileId);
      return entries.map(entry => ({
        id: entry.id,
        camp_id: activeCamp?.id || '',
        profile_id: profileId,
        response_date: entry.response_date,
        from_time: entry.from_time,
        to_time: entry.to_time,
        time_slots: entry.time_slots,
        duration_minutes: entry.duration_minutes,
        demerit_credit: entry.demerit_credit,
        submitted_at: '',
        attended: entry.attended,
        memberName: member?.full_name || '-',
      }));
    });
  }, [campResponses, campResponsesByMember, members, activeCamp]);

  const handleToggleCamp = async (enabled: boolean) => {
    if (!activeCamp) return;
    setCampToggling(true);
    const { error } = await adminApi('toggle_camp_enabled', { campId: activeCamp.id, enabled });
    setCampToggling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(enabled ? '캠프가 활성화되었습니다.' : '캠프가 비활성화되었습니다.');
    await Promise.all([loadCamp(), refreshData()]);
  };

  const exportCampCsv = () => {
    const header = '이름,날짜,시작,종료,참여시간(분),벌점상쇄';
    const lines = campResponseRows.map(row =>
      [
        row.memberName,
        row.response_date,
        row.from_time,
        row.to_time,
        row.duration_minutes,
        row.demerit_credit,
      ].join(','),
    );
    const blob = new Blob([`\uFEFF${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `camp-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeSessions = [...sessions.filter(s => s.status !== 'closed')]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  const closedSessions = [...sessions.filter(s => s.status === 'closed')]
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  const openCount = sessions.filter(session => session.status === 'open').length;
  const scheduledCount = sessions.filter(session => session.status === 'scheduled').length;

  const renderSession = (s: typeof sessions[0], dimmed = false) => (
    <DataRow
      key={s.id}
      className={`relative flex items-center justify-between gap-3 ${
        dimmed
          ? 'bg-muted/50 opacity-70 hover:opacity-90'
          : ''
      }`}
      onClick={() => navigate(`/admin/sessions/${s.id}`)}
      chevron
    >
      <div className="min-w-0 flex-1 pr-8">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-bold ${dimmed ? 'text-muted-foreground' : ''}`}>{s.title}</span>
          <StatusPill tone={s.status === 'open' ? 'success' : s.status === 'scheduled' ? 'accent' : 'neutral'}>
            {statusLabel[s.status]}
          </StatusPill>
          {s.status === 'open' && <span className="h-2 w-2 rounded-full bg-status-present animate-pulse-dot" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(s.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            {' '}
            {new Date(s.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {s.venue_name && <span className="truncate">{s.venue_name}</span>}
        </div>
      </div>
      <div className="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/sessions/${s.id}/edit`); }}
          className="app-focus-ring p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="세션 수정"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`"${s.title}" 세션을 삭제하시겠습니까?`)) {
              deleteSession(s.id);
              toast.success('세션이 삭제되었습니다.');
            }
          }}
          className="app-focus-ring p-2 rounded-lg hover:bg-destructive/10 transition-colors"
          aria-label="세션 삭제"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </DataRow>
  );

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="세션"
        description="출석 오픈, 일정 생성, 종료 세션 확인을 한 흐름에서 처리합니다."
        actions={
        <Button size="sm" onClick={() => navigate('/admin/sessions/new')} className="rounded-xl">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> 세션 생성
        </Button>
        }
      />

      <StatGrid className="grid-cols-3">
        <MetricCard label="전체" value={sessions.length} icon={CalendarDays} />
        <MetricCard label="진행 중" value={openCount} icon={Radio} tone={openCount > 0 ? 'success' : 'default'} />
        <MetricCard label="예정" value={scheduledCount} icon={Clock} tone="accent" />
      </StatGrid>

      <Panel
        title="캠프 일일 설문"
        icon={Sparkles}
        description="미니 스타트업 캠프 참여 시간 수집 · 벌점 상쇄 · 22:00 자동 리마인드"
        action={
          campResponseRows.length > 0 ? (
            <Button size="sm" variant="outline" onClick={exportCampCsv} className="rounded-xl">
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          ) : undefined
        }
      >
        {campLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            캠프 정보 불러오는 중…
          </div>
        ) : activeCamp ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
              <div>
                <p className="text-sm font-bold">{activeCamp.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activeCamp.start_date} ~ {activeCamp.end_date}
                  {' · '}
                  운영 {formatTimeValue(activeCamp.daily_open_time)}-{formatTimeValue(activeCamp.daily_close_time)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {activeCamp.enabled ? '활성' : '비활성'}
                </span>
                <Switch
                  checked={activeCamp.enabled}
                  disabled={campToggling}
                  onCheckedChange={handleToggleCamp}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricCard label="응답 수" value={campResponseRows.length} icon={Sparkles} />
              <MetricCard
                label="참여 멤버"
                value={new Set(campResponseRows.map(row => row.profile_id)).size}
                icon={CalendarDays}
              />
              <MetricCard
                label="총 상쇄"
                value={campResponseRows.reduce((sum, row) => sum + Number(row.demerit_credit), 0).toFixed(2)}
                icon={Clock}
              />
            </div>

            {campResponseRows.length === 0 ? (
              <EmptyState icon={Sparkles} title="아직 응답이 없습니다" description="캠프 기간 중 멤버가 설문을 제출하면 여기에 표시됩니다." />
            ) : (
              <div className="space-y-2">
                {campResponseRows.slice(0, 20).map(row => (
                  <DataRow key={row.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{row.memberName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.response_date}
                        {' · '}
                        {formatCampParticipationLabel(row)}
                      </p>
                    </div>
                    {row.attended === false ? (
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">미참여</span>
                    ) : (
                      <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                        -{Number(row.demerit_credit).toFixed(2)}점
                      </span>
                    )}
                  </DataRow>
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={Sparkles} title="등록된 캠프가 없습니다" description="DB 마이그레이션 후 캠프 설정이 표시됩니다." />
        )}
      </Panel>

      <Panel title="예정/진행 세션" icon={CalendarDays}>
        <div className="space-y-2">
          {activeSessions.map(s => renderSession(s))}
          {activeSessions.length === 0 && (
            <EmptyState icon={CalendarDays} title="예정된 세션이 없습니다" description="세션 생성을 눌러 다음 주차를 등록하세요." />
          )}
        </div>
      </Panel>

      {closedSessions.length > 0 && (
        <Panel title="종료된 세션" icon={Archive}>
          <div className="space-y-2">
            {closedSessions.map(s => renderSession(s, true))}
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
