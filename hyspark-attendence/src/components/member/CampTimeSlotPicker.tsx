import { useCallback, useEffect, useRef } from 'react';
import {
  buildCampTimeSlots,
  CAMP_SLOT_MINUTES,
  formatMinutesToTime,
  parseTimeToMinutes,
} from '@/lib/campSurvey';
import { cn } from '@/lib/utils';

type CampTimeSlotPickerProps = {
  openTime: string;
  closeTime: string;
  selected: string[];
  onChange: (slots: string[]) => void;
  disabled?: boolean;
};

type PaintMode = 'add' | 'remove';

export default function CampTimeSlotPicker({
  openTime,
  closeTime,
  selected,
  onChange,
  disabled = false,
}: CampTimeSlotPickerProps) {
  const slots = buildCampTimeSlots(openTime, closeTime);
  const selectedSet = new Set(selected);
  const dragRef = useRef<{ active: boolean; mode: PaintMode }>({ active: false, mode: 'add' });
  const selectionRef = useRef(selected);

  useEffect(() => {
    selectionRef.current = selected;
  }, [selected]);

  const applySlot = useCallback((slot: string, mode: PaintMode) => {
    const next = new Set(selectionRef.current);
    if (mode === 'add') next.add(slot);
    else next.delete(slot);
    const sorted = [...next].sort();
    selectionRef.current = sorted;
    onChange(sorted);
  }, [onChange]);

  const beginPaint = (slot: string) => {
    if (disabled) return;
    const mode: PaintMode = selectedSet.has(slot) ? 'remove' : 'add';
    dragRef.current = { active: true, mode };
    applySlot(slot, mode);
  };

  const continuePaint = (slot: string) => {
    if (disabled || !dragRef.current.active) return;
    applySlot(slot, dragRef.current.mode);
  };

  const endPaint = () => {
    dragRef.current.active = false;
  };

  const showHourLabel = (slot: string, index: number) => {
    if (index === 0) return true;
    const prev = parseTimeToMinutes(slots[index - 1]);
    const curr = parseTimeToMinutes(slot);
    if (prev === null || curr === null) return false;
    return Math.floor(curr / 60) !== Math.floor(prev / 60);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground">
        참여한 시간을 드래그해서 칠해 주세요 (30분 단위 · 끊어져도 OK)
      </p>
      <div
        className="select-none overflow-hidden rounded-xl border border-border/60 bg-secondary/20"
        onPointerLeave={endPaint}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
      >
        <div className="grid grid-cols-[2.75rem_1fr] gap-0">
          {slots.map((slot, index) => {
            const active = selectedSet.has(slot);
            const hourLabel = showHourLabel(slot, index);
            const minutePart = slot.slice(3, 5);
            const isHourStart = minutePart === '00';
            const hourDivider = isHourStart && index > 0;

            return (
              <div key={slot} className="contents">
                <div
                  className={cn(
                    'flex items-center justify-end border-r border-border/40 px-2 text-[10px] font-bold tabular-nums text-muted-foreground',
                    hourLabel ? 'pt-1' : 'py-0',
                    hourDivider && 'border-t-2 border-t-foreground/30',
                    !hourDivider && index > 0 && 'border-t border-t-border/25',
                  )}
                >
                  {hourLabel ? (
                    <span className="text-[11px] text-foreground/80">{slot.slice(0, 2)}시</span>
                  ) : (
                    <span className="text-[9px] opacity-50">{minutePart}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onPointerDown={event => {
                    event.preventDefault();
                    beginPaint(slot);
                  }}
                  onPointerEnter={() => continuePaint(slot)}
                  className={cn(
                    'h-5 w-full transition-colors touch-none',
                    hourDivider && 'border-t-2 border-t-foreground/30',
                    !hourDivider && index > 0 && 'border-t border-t-border/25',
                    active
                      ? 'bg-primary hover:bg-primary/90'
                      : 'bg-background/80 hover:bg-primary/15',
                    index === slots.length - 1 && 'border-b border-b-border/40',
                  )}
                  aria-pressed={active}
                  aria-label={`${slot}–${formatMinutesToTime((parseTimeToMinutes(slot) ?? 0) + CAMP_SLOT_MINUTES)} ${active ? '선택됨' : '선택 안 됨'}`}
                />
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {openTime.slice(0, 5)}–{closeTime.slice(0, 5)} · 한 칸 = {CAMP_SLOT_MINUTES}분 · When2Meet처럼 드래그 가능
      </p>
    </div>
  );
}
