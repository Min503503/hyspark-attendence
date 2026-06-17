import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Session } from '@/types';

export default function SessionEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { sessions, createSession, updateSession } = useApp();

  const editing = sessions.find(s => s.id === id);
  const isEdit = !!editing;

  const [form, setForm] = useState({
    title: '',
    start_date: '', start_time: '15:00',
    check_in_open_minutes: '20',
    attendance_deadline_minutes: '5', late_deadline_minutes: '30',
    notes: '',
  });

  useEffect(() => {
    if (editing) {
      const d = new Date(editing.start_at);
      setForm({
        title: editing.title,
        start_date: d.toISOString().slice(0, 10),
        start_time: d.toTimeString().slice(0, 5),
        check_in_open_minutes: String(editing.check_in_open_minutes),
        attendance_deadline_minutes: String(editing.attendance_deadline_minutes),
        late_deadline_minutes: String(editing.late_deadline_minutes),
        notes: editing.notes || '',
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
        check_in_open_minutes: parseInt(form.check_in_open_minutes),
        attendance_deadline_minutes: parseInt(form.attendance_deadline_minutes),
        late_deadline_minutes: parseInt(form.late_deadline_minutes),
        notes: form.notes,
      });
    } else {
      const title = generateTitle(form.start_date);
      await createSession({
        title,
        start_at: startAt,
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
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-reveal-up">
      <h1 className="text-2xl font-extrabold mb-6">{isEdit ? '세션 수정' : '세션 생성'}</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isEdit && (
              <div className="space-y-2">
                <Label>세션명</Label>
                <Input value={form.title} onChange={e => update('title', e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>체크인 오픈 (분 전)</Label>
                <Input type="number" value={form.check_in_open_minutes} onChange={e => update('check_in_open_minutes', e.target.value)} />
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
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={!form.start_date} className="bg-primary text-primary-foreground active:scale-[0.97]">
                {isEdit ? '수정 완료' : '저장'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>취소</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
