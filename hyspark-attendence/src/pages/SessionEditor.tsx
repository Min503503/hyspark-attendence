import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Session } from '@/types';
import { CalendarPlus } from 'lucide-react';
import { PageHeader, PageShell, Panel, BackLink } from '@/components/app-ui';
import {
  DEFAULT_ATTENDANCE_DEADLINE_MINUTES,
  DEFAULT_CHECK_IN_OPEN_MINUTES,
  DEFAULT_LATE_DEADLINE_MINUTES,
  DEFAULT_SESSION_START_TIME,
} from '@/lib/sessionDefaults';

function plainSessionNotes(notes?: string | null): string {
  if (!notes) return '';
  try {
    const parsed = JSON.parse(notes);
    if (parsed?.__hyspark_networking_v1__) return parsed.text || '';
  } catch {
    /* plain text */
  }
  return notes;
}

export default function SessionEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { sessions, createSession, updateSession } = useApp();

  const editing = sessions.find(s => s.id === id);
  const isEdit = !!editing;

  const [form, setForm] = useState({
    title: '',
    start_date: '', start_time: DEFAULT_SESSION_START_TIME,
    venue_name: '',
    venue_map_url: '',
    check_in_open_minutes: String(DEFAULT_CHECK_IN_OPEN_MINUTES),
    attendance_deadline_minutes: String(DEFAULT_ATTENDANCE_DEADLINE_MINUTES), late_deadline_minutes: String(DEFAULT_LATE_DEADLINE_MINUTES),
    notes: '',
  });

  useEffect(() => {
    if (editing) {
      const d = new Date(editing.start_at);
      setForm({
        title: editing.title,
        start_date: d.toISOString().slice(0, 10),
        start_time: d.toTimeString().slice(0, 5),
        venue_name: editing.venue_name || '',
        venue_map_url: editing.venue_map_url || '',
        check_in_open_minutes: String(editing.check_in_open_minutes),
        attendance_deadline_minutes: String(editing.attendance_deadline_minutes),
        late_deadline_minutes: String(editing.late_deadline_minutes),
        notes: plainSessionNotes(editing.notes),
      });
    }
  }, [editing]);

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const generateTitle = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekNum = sessions.length + 1;
    return `${month}/${day} ${weekNum}주차`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startAt = `${form.start_date}T${form.start_time}:00+09:00`;

    if (isEdit) {
      await updateSession({
        ...editing!,
        title: form.title || editing!.title,
        start_at: startAt,
        venue_name: form.venue_name.trim() || undefined,
        venue_map_url: form.venue_map_url.trim() || undefined,
        check_in_open_minutes: parseInt(form.check_in_open_minutes),
        attendance_deadline_minutes: parseInt(form.attendance_deadline_minutes),
        late_deadline_minutes: parseInt(form.late_deadline_minutes),
        notes: form.notes.trim() || undefined,
      });
    } else {
      const title = generateTitle(form.start_date);
      await createSession({
        title,
        start_at: startAt,
        venue_name: form.venue_name.trim() || undefined,
        venue_map_url: form.venue_map_url.trim() || undefined,
        check_in_open_minutes: parseInt(form.check_in_open_minutes),
        attendance_deadline_minutes: parseInt(form.attendance_deadline_minutes),
        late_deadline_minutes: parseInt(form.late_deadline_minutes),
        notes: form.notes,
        status: 'scheduled',
      });
    }
    navigate('/admin/sessions');
  };

  const previewTitle = !isEdit && form.start_date ? generateTitle(form.start_date) : '';

  return (
    <PageShell size="sm" className="space-y-6">
      <PageHeader
        title={isEdit ? '세션 수정' : '세션 생성'}
        description="시작 시간과 출석/지각 기준을 설정합니다."
        back={<BackLink onClick={() => navigate('/admin/sessions')} label="세션 목록" />}
      />
      <Panel title="세션 정보" icon={CalendarPlus}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {isEdit && (
              <div className="space-y-2">
                <Label>세션명</Label>
                <Input value={form.title} onChange={e => update('title', e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input type="date" required value={form.start_date} onChange={e => update('start_date', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} />
              </div>
            </div>
            {previewTitle && (
              <p className="text-sm text-muted-foreground">세션명: <span className="font-semibold text-foreground">{previewTitle}</span></p>
            )}
            <div className="space-y-2">
              <Label>세션 장소 *</Label>
              <Input
                required
                value={form.venue_name}
                onChange={e => update('venue_name', e.target.value)}
                placeholder="예: 강남 ○○빌딩 3층 세미나실 / 서울 강남구 ..."
              />
              <p className="text-[11px] text-muted-foreground">메일 리마인드에 크게 표시됩니다.</p>
            </div>
            <div className="space-y-2">
              <Label>네이버 지도 URL</Label>
              <Input
                type="url"
                value={form.venue_map_url}
                onChange={e => update('venue_map_url', e.target.value)}
                placeholder="https://map.naver.com/p/..."
              />
              <p className="text-[11px] text-muted-foreground">메일 장소 카드에 「네이버 지도에서 보기」 링크로 연결됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>체크인 오픈 (분 전)</Label>
                <Input type="number" value={form.check_in_open_minutes} onChange={e => update('check_in_open_minutes', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">0이면 시작 시간 정각에 자동으로 열립니다.</p>
              </div>
              <div className="space-y-2">
                <Label>출석마감 (분)</Label>
                <Input type="number" value={form.attendance_deadline_minutes} onChange={e => update('attendance_deadline_minutes', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>지각마감 (분)</Label>
                <Input type="number" value={form.late_deadline_minutes} onChange={e => update('late_deadline_minutes', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="메모" />
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button type="submit" disabled={!form.start_date || !form.venue_name.trim()} className="rounded-xl">
                {isEdit ? '수정 완료' : '저장'}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>취소</Button>
            </div>
          </form>
      </Panel>
    </PageShell>
  );
}
