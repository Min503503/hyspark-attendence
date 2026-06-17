import { useEffect, useMemo, useState } from 'react';
import { Clipboard, MessageCircle, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';
import { EmptyState, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';
import {
  getAutomaticNetworkingSession,
  getNetworkingCounts,
  getNetworkingDeadlineLabel,
  getNetworkingTimeLabel,
  getSharedNetworkingMessage,
  parseSessionNotes,
  serializeSessionNotes,
  type NetworkingAudience,
  type NetworkingStatus,
} from '@/lib/networking';

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}

export default function AdminNetworking() {
  const {
    sessions,
    profiles,
    members,
    refreshData,
    addStaffProfile,
    updateStaffProfile,
    deleteStaffProfile,
  } = useApp();
  const candidateSessions = useMemo(() => (
    [...sessions]
      .filter(session => session.status !== 'archived')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  ), [sessions]);
  const defaultSession = getAutomaticNetworkingSession(candidateSessions) || candidateSessions[0];
  const [selectedSessionId, setSelectedSessionId] = useState(defaultSession?.id || '');

  const selectedSession = sessions.find(session => session.id === selectedSessionId) || defaultSession;
  const activeMembers = members.filter(member => member.role === 'member' && member.status === 'active');
  const allStaffProfiles = profiles.filter(profile => profile.role === 'admin' || profile.role === 'staff');
  const staffProfiles = allStaffProfiles.filter(profile => profile.status === 'active');
  const counts = selectedSession ? getNetworkingCounts(selectedSession, activeMembers, staffProfiles) : null;
  const [saving, setSaving] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff'>('staff');
  const [staffStatus, setStaffStatus] = useState<'active' | 'inactive'>('active');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [memberMessageDraft, setMemberMessageDraft] = useState('');
  const [staffMessageDraft, setStaffMessageDraft] = useState('');

  useEffect(() => {
    if (!selectedSession) return;
    setMemberMessageDraft(getSharedNetworkingMessage(selectedSession, 'member'));
    setStaffMessageDraft(getSharedNetworkingMessage(selectedSession, 'staff'));
  }, [selectedSession?.id]);

  const openStaffDialog = (profile?: Profile) => {
    setEditingStaff(profile || null);
    setStaffName(profile?.full_name || '');
    setStaffRole((profile?.role === 'admin' || profile?.role === 'staff') ? profile.role : 'staff');
    setStaffStatus(profile?.status || 'active');
    setStaffEmail(profile?.email || '');
    setStaffPhone(profile?.phone || '');
    setStaffDialogOpen(true);
  };

  const saveStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = staffName.trim();
    if (!trimmedName) return;

    const success = editingStaff
      ? await updateStaffProfile(editingStaff.id, {
        full_name: trimmedName,
        role: staffRole,
        status: staffStatus,
        email: staffEmail.trim(),
        phone: staffPhone.trim(),
      })
      : await addStaffProfile({
        full_name: trimmedName,
        role: staffRole,
        email: staffEmail.trim(),
        phone: staffPhone.trim(),
      });

    if (!success) {
      toast.error('운영진 저장에 실패했습니다.');
      return;
    }

    toast.success(editingStaff ? '운영진 정보가 수정되었습니다.' : '운영진이 추가되었습니다.');
    setStaffDialogOpen(false);
  };

  const removeStaff = async (profile: Profile) => {
    const confirmed = window.confirm(`${profile.full_name} 운영진을 명단에서 비활성화할까요?`);
    if (!confirmed) return;

    const success = await deleteStaffProfile(profile.id);
    if (success) {
      toast.success(`${profile.full_name} 운영진을 비활성화했습니다.`);
    } else {
      toast.error('운영진 비활성화에 실패했습니다.');
    }
  };

  const setSurveyEnabled = async (audience: NetworkingAudience, enabled: boolean, options?: { silent?: boolean }) => {
    if (!selectedSession) return false;
    setSaving(true);

    const parsed = parseSessionNotes(selectedSession.notes);
    const nextNetworking = {
      ...parsed.networking,
      enabled: audience === 'member' ? enabled : parsed.networking.enabled,
      staff_enabled: audience === 'staff' ? enabled : parsed.networking.staff_enabled,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('sessions')
      .update({ notes: serializeSessionNotes(parsed.text, nextNetworking) })
      .eq('id', selectedSession.id);

    setSaving(false);

    if (error) {
      toast.error('조사 상태 저장에 실패했습니다.');
      return false;
    }

    await refreshData();
    if (!options?.silent) {
      toast.success(enabled ? '네트워킹 조사를 시작했습니다.' : '네트워킹 조사를 닫았습니다.');
    }
    return true;
  };

  const copySharedMessage = async (audience: NetworkingAudience) => {
    if (!selectedSession) return;
    const message = audience === 'staff' ? staffMessageDraft : memberMessageDraft;
    const copied = await writeClipboard(message.trim() || getSharedNetworkingMessage(selectedSession, audience));
    if (!copied) {
      toast.error('복사에 실패했습니다. 문구 영역을 직접 드래그해서 복사해주세요.');
      return;
    }

    const started = await setSurveyEnabled(audience, true, { silent: true });
    if (started) {
      toast.success(audience === 'staff'
        ? '운영진 공통 문구를 복사했고 조사를 시작했습니다.'
        : '학회원 공통 문구를 복사했고 조사를 시작했습니다.');
    }
  };

  const setProfileNetworkingStatus = async (
    audience: NetworkingAudience,
    profile: Profile,
    status: NetworkingStatus | null,
  ) => {
    if (!selectedSession) return;
    setSaving(true);

    const { data, error: fetchError } = await supabase
      .from('sessions')
      .select('notes')
      .eq('id', selectedSession.id)
      .single();

    if (fetchError) {
      setSaving(false);
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
      .eq('id', selectedSession.id);

    setSaving(false);

    if (error) {
      toast.error('참여 상태 저장에 실패했습니다.');
      return;
    }

    await refreshData();
    toast.success(`${profile.full_name} 상태를 수정했습니다.`);
  };

  const memberRows = counts
    ? activeMembers.map(member => ({
      member,
      response: counts.responses[member.id],
    }))
    : [];
  const staffRows = counts
    ? staffProfiles.map(profile => ({
      profile,
      response: counts.staffResponses[profile.id],
    }))
    : [];
  const memberTotal = activeMembers.length;
  const memberNotAttending = counts?.notAttending.length || 0;
  const memberParticipants = counts?.assumedAttending.length || 0;
  const staffTotal = staffProfiles.length;
  const staffChecked = counts?.staffAttending.length || 0;
  const staffUnchecked = counts?.staffPending.length || 0;
  const combinedParticipants = memberParticipants + staffChecked;

  return (
    <PageShell size="xl" className="space-y-6">
      <PageHeader
        title="네트워킹 조사"
        description="학회원은 미참자만 체크하고, 운영진은 참여할 사람만 체크합니다."
        actions={
          selectedSession && (
            <>
              <Button variant="outline" size="sm" onClick={() => copySharedMessage('member')} disabled={saving}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> 학회원 문구 복사/시작
              </Button>
              <Button variant="outline" size="sm" onClick={() => copySharedMessage('staff')} disabled={saving || !staffProfiles.length}>
                <Clipboard className="mr-1.5 h-3.5 w-3.5" /> 운영진 문구 복사/시작
              </Button>
            </>
          )
        }
      />

      {!selectedSession || !counts ? (
        <EmptyState icon={Users} title="세션이 없습니다" description="세션을 먼저 생성하면 네트워킹 조사를 만들 수 있습니다." />
      ) : (
        <>
          <Surface className="animate-reveal-up p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold">{selectedSession.title}</h2>
                  {selectedSession.id === defaultSession?.id && (
                    <StatusPill tone="accent">자동 이번 주</StatusPill>
                  )}
                  <StatusPill tone={counts.enabled ? 'success' : 'neutral'}>
                    학회원 {counts.enabled ? '열림' : '닫힘'}
                  </StatusPill>
                  <StatusPill tone={counts.staffEnabled ? 'success' : 'neutral'}>
                    운영진 {counts.staffEnabled ? '열림' : '닫힘'}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(selectedSession.start_at).toLocaleString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="w-full lg:w-80">
                <Select value={selectedSession.id} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="h-11 bg-secondary/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateSessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.title} · {new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Surface>

          <Surface className="overflow-hidden border-primary/20">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-extrabold">카톡 미리보기</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                같은 URL을 단체방에 공유하면, 접속 시점의 이번 주 세션으로 자동 연결됩니다.
              </p>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#FEE500]/70 bg-[#FEE500]/20 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-extrabold text-foreground">학회원용 미리보기</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      미참자만 체크 · {getNetworkingDeadlineLabel()} · {getNetworkingTimeLabel()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 bg-card/90 text-[11px]" onClick={() => copySharedMessage('member')} disabled={saving}>
                    복사/시작
                  </Button>
                </div>
                <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-xs shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-muted-foreground">실제 복사 문구</p>
                    <p className="text-[10px] font-semibold text-muted-foreground/70">클릭해서 수정</p>
                  </div>
                  <Textarea
                    value={memberMessageDraft}
                    onChange={event => setMemberMessageDraft(event.target.value)}
                    className="min-h-40 resize-y border-border/70 bg-secondary/20 text-xs font-semibold leading-5 text-foreground"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-extrabold text-foreground">운영진용 미리보기</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      세션+네트워킹 참여자만 체크 · {getNetworkingDeadlineLabel()} · {getNetworkingTimeLabel()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 bg-card/90 text-[11px]" onClick={() => copySharedMessage('staff')} disabled={saving || !staffProfiles.length}>
                    복사/시작
                  </Button>
                </div>
                <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-xs shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-muted-foreground">실제 복사 문구</p>
                    <p className="text-[10px] font-semibold text-muted-foreground/70">클릭해서 수정</p>
                  </div>
                  <Textarea
                    value={staffMessageDraft}
                    onChange={event => setStaffMessageDraft(event.target.value)}
                    className="min-h-44 resize-y border-border/70 bg-secondary/20 text-xs font-semibold leading-5 text-foreground"
                  />
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold text-primary">이번 주 네트워킹 참여자</p>
                <p className="mt-1 text-5xl font-extrabold tabular-nums text-foreground">{combinedParticipants}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:w-72">
                <div className="rounded-xl border border-border/60 bg-card/70 p-3">
                  <p className="font-semibold text-muted-foreground">학회원 참여자</p>
                  <p className="mt-1 text-2xl font-extrabold text-status-present">{memberParticipants}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/70 p-3">
                  <p className="font-semibold text-muted-foreground">운영진 참여자</p>
                  <p className="mt-1 text-2xl font-extrabold text-primary">{staffChecked}</p>
                </div>
              </div>
            </div>
          </Surface>

          <div className="grid gap-3 lg:grid-cols-2">
            <Surface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-extrabold">학회원 명단</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-secondary/35 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">총 인원</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{memberTotal}</p>
                </div>
                <div className="rounded-xl bg-status-present/10 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">참여자</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-status-present">{memberParticipants}</p>
                </div>
                <div className="rounded-xl bg-status-absent/10 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">미참자</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-status-absent">{memberNotAttending}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">학회원은 미참자만 체크합니다. 참여자는 전체 학회원에서 미참자를 제외해 계산합니다.</p>
            </Surface>

            <Surface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-extrabold">운영진 명단</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-secondary/35 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">총 인원</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{staffTotal}</p>
                </div>
                <div className="rounded-xl bg-secondary/35 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">미참/미응답</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-muted-foreground">{staffUnchecked}</p>
                </div>
                <div className="rounded-xl bg-primary/10 px-3 py-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">참여자</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">{staffChecked}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">운영진 체크는 참여 체크입니다. 체크한 운영진만 참여 인원에 더합니다.</p>
            </Surface>
          </div>

          <div className="grid gap-4">
            <Surface className="overflow-hidden">
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-sm font-extrabold">학회원 참여/미참 현황</h2>
              </div>
              <div className="overflow-x-auto scrollbar-clean">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">이름</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">상태</th>
                      <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground md:table-cell">응답 시각</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map(({ member, response }) => (
                      <tr key={member.id} className="border-b last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-3 font-semibold">{member.full_name}</td>
                        <td className="px-4 py-3 text-center">
                          {response ? (
                            <StatusPill tone="danger">미참</StatusPill>
                          ) : (
                            <StatusPill tone="success">참여</StatusPill>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-center text-xs text-muted-foreground md:table-cell">
                          {response?.updated_at
                            ? new Date(response.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setProfileNetworkingStatus('member', member, response ? null : 'not_attending')}
                            className="h-8 px-2 text-[11px]"
                          >
                            {response ? '참여로 변경' : '미참 처리'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          </div>

          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="text-sm font-extrabold">운영진 명단/참여 현황</h2>
                <p className="mt-1 text-xs text-muted-foreground">명단에 등록된 운영진만 운영진용 조사 대상에 포함됩니다.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openStaffDialog()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 추가
              </Button>
            </div>
            <div className="overflow-x-auto scrollbar-clean">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/50">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">이름</th>
                    <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground md:table-cell">권한</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">상태</th>
                      <th className="hidden px-4 py-3 text-center font-semibold text-muted-foreground md:table-cell">응답 시각</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {allStaffProfiles.map(profile => {
                    const response = counts.staffResponses[profile.id];
                    return (
                    <tr key={profile.id} className="border-b last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-3 font-semibold">{profile.full_name}</td>
                      <td className="hidden px-4 py-3 text-center text-xs text-muted-foreground md:table-cell">
                        {profile.role === 'admin' ? '관리자' : '운영진'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {profile.status !== 'active'
                          ? <StatusPill>제외</StatusPill>
                          : response ? <StatusPill tone="accent">참여</StatusPill> : <StatusPill>미참</StatusPill>}
                      </td>
                      <td className="hidden px-4 py-3 text-center text-xs text-muted-foreground md:table-cell">
                        {response?.updated_at
                          ? new Date(response.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {profile.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => setProfileNetworkingStatus('staff', profile, response ? null : 'attending')}
                              className="h-8 px-2 text-[11px]"
                            >
                              {response ? '미참 처리' : '참여 처리'}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openStaffDialog(profile)} aria-label={`${profile.full_name} 수정`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {profile.status === 'active' && (
                            <Button size="sm" variant="ghost" onClick={() => removeStaff(profile)} aria-label={`${profile.full_name} 비활성화`}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
                  {allStaffProfiles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">등록된 운영진 프로필이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Surface>

          <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStaff ? '운영진 수정' : '운영진 추가'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveStaff} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>이름 *</Label>
                  <Input value={staffName} onChange={event => setStaffName(event.target.value)} placeholder="홍길동" required />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>권한</Label>
                    <Select value={staffRole} onValueChange={value => setStaffRole(value as 'admin' | 'staff')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">운영진</SelectItem>
                        <SelectItem value="admin">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>상태</Label>
                    <Select value={staffStatus} onValueChange={value => setStaffStatus(value as 'active' | 'inactive')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">활성</SelectItem>
                        <SelectItem value="inactive">비활성</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>이메일</Label>
                  <Input value={staffEmail} onChange={event => setStaffEmail(event.target.value)} placeholder="선택" />
                </div>
                <div className="space-y-2">
                  <Label>전화번호</Label>
                  <Input value={staffPhone} onChange={event => setStaffPhone(event.target.value)} placeholder="선택" />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground active:scale-[0.97]">
                  {editingStaff ? '수정 완료' : '추가'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </PageShell>
  );
}
