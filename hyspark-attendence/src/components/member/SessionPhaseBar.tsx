import { cn } from '@/lib/utils';
import type { SessionPhase } from '@/lib/member-utils';
import { formatRemaining } from '@/lib/member-utils';

const PHASES: { id: SessionPhase; label: string }[] = [
  { id: 'waiting', label: '대기' },
  { id: 'present', label: '출석' },
  { id: 'late', label: '지각' },
  { id: 'closed', label: '마감' },
];

interface SessionPhaseBarProps {
  phase: SessionPhase;
  now: Date;
  attendanceDeadline: Date;
  lateDeadline: Date;
  compact?: boolean;
}

export default function SessionPhaseBar({
  phase,
  now,
  attendanceDeadline,
  lateDeadline,
  compact = false,
}: SessionPhaseBarProps) {
  const activeIndex = PHASES.findIndex(item => item.id === phase);
  const countdownTarget = phase === 'present'
    ? attendanceDeadline
    : phase === 'late'
      ? lateDeadline
      : null;

  return (
    <div className={cn('space-y-3', compact && 'space-y-1.5')}>
      <div className="flex items-center gap-0.5">
        {PHASES.map((item, index) => {
          const isPast = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <div key={item.id} className="flex flex-1 items-center gap-0.5">
              <div className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full font-bold transition-all',
                    compact ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]',
                    isCurrent && 'member-phase-active scale-105',
                    isPast && 'bg-status-present text-white',
                    !isPast && !isCurrent && 'bg-secondary text-muted-foreground',
                  )}
                >
                  {isPast ? '✓' : index + 1}
                </div>
                <span
                  className={cn(
                    'font-semibold',
                    compact ? 'text-[9px]' : 'text-[10px]',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </div>
              {index < PHASES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors',
                    compact ? 'mb-3' : 'mb-4',
                    index < activeIndex ? 'bg-status-present' : 'bg-border/60',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {countdownTarget && (
        <div className={cn(
          'member-countdown flex items-center justify-between rounded-lg px-2.5',
          compact ? 'py-1.5' : 'rounded-xl px-3 py-2.5',
        )}>
          <span className={cn('font-semibold text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
            {phase === 'present' ? '출석 마감까지' : '지각 마감까지'}
          </span>
          <span className={cn('font-extrabold tabular-nums text-foreground', compact ? 'text-xs' : 'text-sm')}>
            {formatRemaining(now, countdownTarget)}
          </span>
        </div>
      )}
    </div>
  );
}
