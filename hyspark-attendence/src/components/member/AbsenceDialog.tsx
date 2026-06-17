import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Session } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXCUSED_CATEGORIES } from '@/lib/member-utils';
import { cn } from '@/lib/utils';

interface AbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Session[];
  onSubmit: (payload: {
    sessionId: string;
    type: 'excused_absent' | 'unexcused_absent';
    categoryLabel?: string;
    note?: string;
  }) => Promise<void>;
}

export default function AbsenceDialog({ open, onOpenChange, sessions, onSubmit }: AbsenceDialogProps) {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [absenceType, setAbsenceType] = useState<'excused_absent' | 'unexcused_absent'>('excused_absent');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep(1);
    setSessionId('');
    setAbsenceType('excused_absent');
    setCategory('');
    setNote('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canProceedStep1 = Boolean(sessionId);
  const canProceedStep2 = absenceType === 'excused_absent' ? Boolean(category) : Boolean(note.trim());

  const handleSubmit = async () => {
    if (!sessionId) return;
    setLoading(true);
    const categoryLabel = absenceType === 'excused_absent'
      ? EXCUSED_CATEGORIES.find(item => item.value === category)?.label
      : undefined;
    await onSubmit({
      sessionId,
      type: absenceType,
      categoryLabel,
      note: note || undefined,
    });
    setLoading(false);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="mx-auto max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>결석 신청</DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3].map(number => (
              <div
                key={number}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step >= number ? 'bg-primary' : 'bg-border/60',
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>세션 선택</Label>
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="세션을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.title} ({new Date(session.start_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="h-11 w-full font-bold"
              >
                다음
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>결석 구분</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'excused_absent' as const, label: '인정 결석', desc: '사유 승인 시 벌점 없음' },
                    { value: 'unexcused_absent' as const, label: '미인정 결석', desc: '벌점 1.0점 부과' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAbsenceType(option.value);
                        setCategory('');
                        setNote('');
                      }}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-all active:scale-[0.98]',
                        absenceType === option.value
                          ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]'
                          : 'border-border/60 bg-secondary/30 hover:border-border',
                      )}
                    >
                      <p className="text-sm font-bold">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="h-11 flex-1">
                  이전
                </Button>
                <Button onClick={() => setStep(3)} disabled={!absenceType} className="h-11 flex-1 font-bold">
                  다음
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {absenceType === 'excused_absent' ? (
                <div className="space-y-3">
                  <Label>사유 선택</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXCUSED_CATEGORIES.map(item => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setCategory(item.value)}
                        className={cn(
                          'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]',
                          category === item.value
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border/60 bg-secondary/30',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>비고 (선택)</Label>
                    <Input
                      value={note}
                      onChange={event => setNote(event.target.value)}
                      placeholder="추가 설명이 있으면 입력하세요"
                      className="h-11"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>사유 작성 *</Label>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="결석 사유를 상세하게 작성해주세요"
                    className="min-h-[120px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    maxLength={500}
                  />
                  <p className="text-right text-[11px] text-muted-foreground">{note.length}/500</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="h-11 flex-1">
                  이전
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceedStep2 || loading}
                  className="h-11 flex-1 font-bold"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '신청하기'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
