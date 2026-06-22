import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { invokeWithAdminToken } from '@/lib/adminApi';
import type { MemberWithSummary } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, UserPlus, ChevronRight, Users, AlertTriangle, Trash2, Loader2, Mail, Send, Check } from 'lucide-react';
import { toast } from 'sonner';
import { DataRow, EmptyState, MetricCard, PageHeader, PageShell, StatusPill, Surface } from '@/components/app-ui';
import { GMAIL_SENDER } from '@/lib/mail';

export default function AdminMembers() {
  const { members, addMember, updateMember, deleteMember } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCohort, setNewCohort] = useState('HySpark 5th');
  const [newEmail, setNewEmail] = useState('');
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [savingEmailId, setSavingEmailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [mailRecipients, setMailRecipients] = useState<MemberWithSummary[]>([]);
  const [mailTargetLabel, setMailTargetLabel] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  const filtered = members.filter(m =>
    m.full_name.includes(search) || m.cohort_label?.includes(search) || m.email?.includes(search)
  );
  const activeCount = members.filter(member => member.status === 'active').length;
  const riskCount = members.filter(member => member.summary.risk_state !== 'stable').length;
  const emailCount = members.filter(member => member.email?.trim()).length;
  const activeMembersWithEmail = members.filter(member => member.status === 'active' && member.email);
  const filteredMembersWithEmail = filtered.filter(member => member.email?.trim());

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addMember({ full_name: newName, cohort_label: newCohort, email: newEmail.trim() });
    toast.success(`${newName} 님이 추가되었습니다.`);
    setNewName('');
    setNewEmail('');
    setDialogOpen(false);
  };

  const getMemberEmailDraft = (member: MemberWithSummary) =>
    emailDrafts[member.id] ?? member.email ?? '';

  const isEmailDirty = (member: MemberWithSummary) =>
    getMemberEmailDraft(member).trim() !== (member.email?.trim() || '');

  const saveMemberEmail = async (member: MemberWithSummary) => {
    const nextEmail = getMemberEmailDraft(member).trim();
    const currentEmail = member.email?.trim() || '';
    if (nextEmail === currentEmail) return;

    setSavingEmailId(member.id);
    await updateMember(member.id, {
      full_name: member.full_name,
      cohort_label: member.cohort_label || '',
      status: member.status as 'active' | 'inactive',
      email: nextEmail,
    });
    setSavingEmailId(null);
    setEmailDrafts(prev => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
    toast.success(`${member.full_name} 이메일이 저장되었습니다.`);
  };

  const openMailDialog = (recipients: MemberWithSummary[], label: string) => {
    const uniqueRecipients = Array.from(
      new Map(
        recipients
          .filter(member => member.email)
          .map(member => [member.email!.toLowerCase(), member]),
      ).values(),
    );

    if (uniqueRecipients.length === 0) {
      toast.error('메일 주소가 등록된 학회원이 없습니다.');
      return;
    }

    setMailRecipients(uniqueRecipients);
    setMailTargetLabel(label);
    setMailSubject('');
    setMailBody('');
    setMailDialogOpen(true);
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailSubject.trim() || !mailBody.trim()) {
      toast.error('제목과 본문을 입력해주세요.');
      return;
    }

    setSendingMail(true);
    const { data, error } = await invokeWithAdminToken('send-member-email', {
      body: {
        recipientIds: mailRecipients.map(member => member.id),
        subject: mailSubject.trim(),
        body: mailBody.trim(),
        manual: true,
      },
    });
    setSendingMail(false);

    if (error) {
      const detail = error.message?.includes('Failed to send a request')
        ? '메일 서버가 배포되지 않았습니다. scripts/gmail/README.md 를 참고해 Supabase Function을 설정하세요.'
        : error.message;
      toast.error(detail || '메일 발송에 실패했습니다.');
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    toast.success(`${data?.sent ?? mailRecipients.length}명에게 메일을 발송했습니다.`);
    setMailDialogOpen(false);
  };

  const handleDelete = async (member: MemberWithSummary) => {
    const confirmed = window.confirm(
      `${member.full_name} 멤버를 삭제하시겠습니까?\n\n이 멤버의 기존 출결 기록도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    setDeletingId(member.id);
    const success = await deleteMember(member.id);
    setDeletingId(null);

    if (success) {
      toast.success(`${member.full_name} 멤버가 삭제되었습니다.`);
    } else {
      toast.error('멤버 삭제에 실패했습니다.');
    }
  };

  return (
    <PageShell size="md" className="space-y-6">
      <PageHeader
        title="멤버 관리"
        description="학회원 출결 상태와 벌점 흐름을 한 화면에서 확인합니다."
        actions={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openMailDialog(activeMembersWithEmail, '활성 학회원')}
            className="active:scale-[0.97]"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" /> 전체 메일
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground active:scale-[0.97]">
            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> 추가
          </Button>
        </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <MetricCard label="전체" value={members.length} icon={Users} />
        <MetricCard label="활성" value={activeCount} tone="success" />
        <MetricCard label="이메일" value={emailCount} icon={Mail} tone={emailCount > 0 ? 'accent' : 'default'} />
        <MetricCard label="주의" value={riskCount} icon={AlertTriangle} tone={riskCount > 0 ? 'warning' : 'default'} />
      </div>

      <Surface className="animate-reveal-up overflow-hidden" style={{ animationDelay: '100ms' }}>
        <div className="border-b border-border/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 bg-secondary/40 pl-9" placeholder="이름, 기수 또는 이메일 검색" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => openMailDialog(filteredMembersWithEmail, '검색된 학회원')}
                className="h-11 shrink-0 active:scale-[0.97]"
              >
                <Mail className="w-4 h-4 mr-1.5" /> 검색결과 메일
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 p-3">
          {filtered.map(m => (
            <DataRow key={m.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/members/${m.id}`)}
                  className="app-focus-ring w-full rounded-lg text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{m.full_name}</span>
                    {m.summary.risk_state === 'withdrawal' && <StatusPill tone="danger">탈회</StatusPill>}
                    {m.summary.risk_state === 'counseling' && <StatusPill tone="warning">면담</StatusPill>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>출석 <strong className="text-status-present">{m.summary.present}</strong></span>
                    <span>지각 <strong className="text-status-late">{m.summary.late}</strong></span>
                    <span>결석 <strong className="text-status-absent">{m.summary.absent}</strong></span>
                    <span>벌점 <strong className="text-foreground">{m.summary.demerit_points}</strong></span>
                  </div>
                </button>
                <div
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-2 py-1.5"
                  onClick={e => e.stopPropagation()}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    type="email"
                    value={getMemberEmailDraft(m)}
                    onChange={e => setEmailDrafts(prev => ({ ...prev, [m.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveMemberEmail(m);
                      }
                    }}
                    placeholder="이메일 추가 또는 수정"
                    disabled={savingEmailId === m.id}
                    className="h-8 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                  />
                  {(isEmailDirty(m) || savingEmailId === m.id) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 shrink-0 px-2 text-xs"
                      disabled={savingEmailId === m.id || !isEmailDirty(m)}
                      onClick={() => void saveMemberEmail(m)}
                    >
                      {savingEmailId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" />
                          저장
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {m.email && (
                  <button
                    type="button"
                    onClick={() => openMailDialog([m], m.full_name)}
                    className="app-focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`${m.full_name}에게 메일 보내기`}
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  disabled={deletingId === m.id}
                  className="app-focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-60"
                  aria-label={`${m.full_name} 삭제`}
                >
                  {deletingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </DataRow>
          ))}
          {filtered.length === 0 && (
            <EmptyState title="검색 결과가 없습니다" description="이름 또는 기수를 다시 확인해주세요." />
          )}
        </div>
      </Surface>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>멤버 추가</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label>기수</Label>
              <Input value={newCohort} onChange={e => setNewCohort(e.target.value)} placeholder="HySpark 5th" />
            </div>
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground active:scale-[0.97]">추가</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mailDialogOpen} onOpenChange={setMailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학회원 메일 발송</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendMail} className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">{mailTargetLabel}</strong> {mailRecipients.length}명에게 {GMAIL_SENDER} 계정으로 개별 발송합니다.
            </div>
            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input required value={mailSubject} onChange={e => setMailSubject(e.target.value)} placeholder="공지 제목" />
            </div>
            <div className="space-y-2">
              <Label>본문 *</Label>
              <Textarea required value={mailBody} onChange={e => setMailBody(e.target.value)} placeholder="학회원에게 보낼 내용을 입력하세요." className="min-h-40" />
            </div>
            <Button type="submit" disabled={sendingMail} className="w-full bg-primary text-primary-foreground active:scale-[0.97]">
              {sendingMail ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              발송
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
