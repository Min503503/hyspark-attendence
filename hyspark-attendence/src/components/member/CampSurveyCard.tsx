import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/app-ui';
import CampTimeSlotPicker from '@/components/member/CampTimeSlotPicker';
import MemberActionComplete from '@/components/member/MemberActionComplete';
import { supabase } from '@/integrations/supabase/client';
import {
  CampSurveyContext,
  computeCampDemeritCredit,
  computeCampDurationFromSlots,
  expandCampResponseToSlots,
  formatCampDuration,
  formatMinutesToTime,
  parseTimeToMinutes,
  CAMP_SLOT_MINUTES,
} from '@/lib/campSurvey';
import { CAMP_DEMERIT_OFFSET } from '@/types';
import { cn } from '@/lib/utils';

type CampSurveyMode = 'attended' | 'absent';

type CampSurveyCardProps = {
  memberId: string;
  focusOnMount?: boolean;
  onSaved?: () => void;
};

export default function CampSurveyCard({ memberId, focusOnMount = false, onSaved }: CampSurveyCardProps) {
  const [context, setContext] = useState<CampSurveyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<CampSurveyMode>('attended');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [justSubmitted, setJustSubmitted] = useState<{ title: string; description: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_camp_survey_context', {
      p_profile_id: memberId,
    });
    if (error) {
      toast.error(error.message);
      setContext({ active: false });
    } else {
      const ctx = data as CampSurveyContext;
      setContext(ctx);
      if (ctx.today && ctx.camp) {
        setMode(ctx.today.attended === false ? 'absent' : 'attended');
        if (ctx.today.attended !== false) {
          const slots = ctx.today.time_slots?.length
            ? ctx.today.time_slots
            : expandCampResponseToSlots(
              ctx.today.from_time,
              ctx.today.to_time,
              ctx.camp.daily_open_time,
              ctx.camp.daily_close_time,
            );
          setSelectedSlots(slots);
        } else {
          setSelectedSlots([]);
        }
      }
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const previewMinutes = useMemo(() => {
    if (mode === 'absent') return 0;
    return computeCampDurationFromSlots(selectedSlots);
  }, [mode, selectedSlots]);
  const previewCredit = useMemo(
    () => computeCampDemeritCredit(previewMinutes),
    [previewMinutes],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'attended' && selectedSlots.length === 0) {
      toast.error('참여한 시간을 하나 이상 선택해주세요.');
      return;
    }

    const sortedSlots = [...selectedSlots].sort();
    const fromTime = sortedSlots[0] ?? '10:00';
    const lastMin = parseTimeToMinutes(sortedSlots[sortedSlots.length - 1] ?? fromTime) ?? 0;
    const toTime = formatMinutesToTime(lastMin + CAMP_SLOT_MINUTES);

    setSubmitting(true);
    const { data, error } = await supabase.rpc('submit_camp_daily_response', {
      p_profile_id: memberId,
      p_from_time: fromTime,
      p_to_time: toTime,
      p_attended: mode === 'attended',
      p_time_slots: mode === 'attended' ? sortedSlots : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as { success?: boolean; message?: string };
    if (!result?.success) {
      toast.error(result?.message || '저장에 실패했습니다.');
      return;
    }

    setJustSubmitted({
      title: '제출 완료',
      description: mode === 'absent'
        ? '오늘 출석 안 함으로 기록했어요.'
        : result.message || '오늘 참여 시간이 저장되었습니다.',
    });
    await load();
    onSaved?.();
  };

  if (loading) {
    return (
      <Panel className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        캠프 설문 불러오는 중…
      </Panel>
    );
  }

  if (!context?.active || !context.camp) return null;

  const camp = context.camp;

  if (justSubmitted) {
    return (
      <Panel
        id="camp-survey-card"
        title={camp.title}
        icon={Sparkles}
        className={focusOnMount ? 'ring-2 ring-primary/30' : undefined}
      >
        <MemberActionComplete
          title={justSubmitted.title}
          description={justSubmitted.description}
          onDismiss={() => setJustSubmitted(null)}
        />
      </Panel>
    );
  }

  return (
    <Panel
      id="camp-survey-card"
      title={camp.title}
      icon={Sparkles}
      description={`${camp.start_date} ~ ${camp.end_date} · 운영 ${camp.daily_open_time}-${camp.daily_close_time}`}
      className={focusOnMount ? 'ring-2 ring-primary/30' : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          오늘 캠프 참여 여부를 알려주세요.
          참여하신 경우 <strong className="text-foreground">있었던 시간</strong>을 드래그해서 칠해 주세요.
          (12–1시, 2–5시처럼 끊어져 있어도 됩니다.)
          참여 {CAMP_DEMERIT_OFFSET.hours_per_block}시간마다 벌점 {CAMP_DEMERIT_OFFSET.credit_per_block}점이 상쇄됩니다.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'attended' as const, label: '참여함' },
            { value: 'absent' as const, label: '오늘 출석 안 함' },
          ]).map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                'rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
                mode === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 bg-secondary/30 text-muted-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'attended' ? (
          <CampTimeSlotPicker
            openTime={camp.daily_open_time}
            closeTime={camp.daily_close_time}
            selected={selectedSlots}
            onChange={setSelectedSlots}
            disabled={submitting}
          />
        ) : (
          <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-3 text-sm text-muted-foreground">
            오늘은 캠프에 참여하지 않았습니다. 벌점 상쇄는 적용되지 않습니다.
          </div>
        )}

        {mode === 'attended' && previewMinutes > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Clock className="h-4 w-4" />
              오늘 {formatCampDuration(previewMinutes)} 참여 ({selectedSlots.length * CAMP_SLOT_MINUTES}분)
            </div>
            <p className="mt-1 text-muted-foreground">
              벌점 <strong className="text-foreground">{previewCredit.toFixed(2)}점</strong> 상쇄 예정
            </p>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 space-y-2 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {context.today && (
            <p className="text-center text-[10px] text-muted-foreground">
              마지막 제출: {new Date(context.today.submitted_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
              {' · '}다시 제출하면 수정됩니다
            </p>
          )}

          <Button type="submit" disabled={submitting} className="h-12 w-full text-base font-bold shadow-sm">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'absent' ? (
              '출석 안 함 제출'
            ) : (
              '참여 시간 제출'
            )}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
