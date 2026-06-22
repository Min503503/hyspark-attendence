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

  // Group slots by 1 hour (00 min and 30 min)
  const groupedSlots = [];
  for (let i = 0; i < slots.length; i += 2) {
    groupedSlots.push({
      hour: slots[i].slice(0, 2),
      slot00: slots[i],
      slot30: slots[i + 1] as string | undefined,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        참여한 시간을 드래그하거나 탭해 주세요 (30분 단위)
      </p>
      <div
        className="select-none overflow-hidden rounded-2xl border border-border/45 bg-secondary/10 p-3.5 space-y-2.5"
        onPointerLeave={endPaint}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
      >
        {groupedSlots.map((group) => {
          const active00 = selectedSet.has(group.slot00);
          const active30 = group.slot30 ? selectedSet.has(group.slot30) : false;

          return (
            <div key={group.slot00} className="grid grid-cols-[2.75rem_1fr_1fr] items-center gap-2">
              {/* Hour Label */}
              <div className="text-right text-xs font-black text-foreground/70 pr-1.5 tabular-nums">
                {group.hour}시
              </div>

              {/* 00 min Button */}
              <button
                type="button"
                disabled={disabled}
                onPointerDown={event => {
                  event.preventDefault();
                  beginPaint(group.slot00);
                }}
                onPointerEnter={() => continuePaint(group.slot00)}
                className={cn(
                  'h-10 rounded-xl border text-[11px] font-bold transition-all duration-200 touch-none flex items-center justify-center shadow-sm active:scale-[0.98]',
                  active00
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent ring-1 ring-blue-400/20'
                    : 'bg-background/80 border-border/50 hover:bg-primary/5 hover:border-primary/20 text-foreground/75'
                )}
                aria-pressed={active00}
                aria-label={`${group.slot00}–${formatMinutesToTime((parseTimeToMinutes(group.slot00) ?? 0) + CAMP_SLOT_MINUTES)} ${active00 ? '선택됨' : '선택 안 됨'}`}
              >
                00분 ~ 30분
              </button>

              {/* 30 min Button */}
              {group.slot30 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onPointerDown={event => {
                    event.preventDefault();
                    beginPaint(group.slot30!);
                  }}
                  onPointerEnter={() => continuePaint(group.slot30!)}
                  className={cn(
                    'h-10 rounded-xl border text-[11px] font-bold transition-all duration-200 touch-none flex items-center justify-center shadow-sm active:scale-[0.98]',
                    active30
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent ring-1 ring-indigo-400/20'
                      : 'bg-background/80 border-border/50 hover:bg-primary/5 hover:border-primary/20 text-foreground/75'
                  )}
                  aria-pressed={active30}
                  aria-label={`${group.slot30}–${formatMinutesToTime((parseTimeToMinutes(group.slot30) ?? 0) + CAMP_SLOT_MINUTES)} ${active30 ? '선택됨' : '선택 안 됨'}`}
                >
                  30분 ~ 00분
                </button>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground flex justify-between px-1">
        <span>운영 시간: {openTime.slice(0, 5)} ~ {closeTime.slice(0, 5)}</span>
        <span>한 칸 = {CAMP_SLOT_MINUTES}분 · 드래그 가능</span>
      </p>
    </div>
  );
}
