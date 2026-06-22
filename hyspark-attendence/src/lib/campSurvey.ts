import { CAMP_DEMERIT_OFFSET } from '@/types';

export const CAMP_SLOT_MINUTES = 30;

export interface CampSettings {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  daily_open_time: string;
  daily_close_time: string;
  enabled: boolean;
}

export interface CampDailyResponse {
  id: string;
  attended: boolean;
  from_time: string;
  to_time: string;
  time_slots?: string[];
  duration_minutes: number;
  demerit_credit: number;
  submitted_at: string;
}

export interface CampSurveyContext {
  active: boolean;
  camp?: CampSettings;
  today?: CampDailyResponse | null;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function computeCampDurationMinutes(fromTime: string, toTime: string): number | null {
  const from = parseTimeToMinutes(fromTime);
  const to = parseTimeToMinutes(toTime);
  if (from === null || to === null || to <= from) return null;
  return to - from;
}

export function computeCampDemeritCredit(durationMinutes: number): number {
  const blocks = Math.floor(Math.max(durationMinutes, 0) / (CAMP_DEMERIT_OFFSET.hours_per_block * 60));
  return blocks * CAMP_DEMERIT_OFFSET.credit_per_block;
}

export function formatCampDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}시간`;
  if (hours === 0) return `${mins}분`;
  return `${hours}시간 ${mins}분`;
}

/** 캠프 운영 시간 내 30분 블록 목록 */
export function buildCampTimeSlots(openTime: string, closeTime: string): string[] {
  const open = parseTimeToMinutes(openTime);
  const close = parseTimeToMinutes(closeTime);
  if (open === null || close === null || close <= open) return [];
  const slots: string[] = [];
  for (let minutes = open; minutes < close; minutes += CAMP_SLOT_MINUTES) {
    slots.push(formatMinutesToTime(minutes));
  }
  return slots;
}

/** @deprecated use buildCampTimeSlots */
export const buildCampHourSlots = buildCampTimeSlots;

export function formatCampSlotEndLabel(slot: string): string {
  const start = parseTimeToMinutes(slot);
  if (start === null) return slot;
  return formatMinutesToTime(start + CAMP_SLOT_MINUTES);
}

/** 기존 연속 from~to 응답을 30분 블록으로 복원 */
export function expandCampResponseToSlots(
  fromTime: string,
  toTime: string,
  openTime: string,
  closeTime: string,
): string[] {
  const allowed = new Set(buildCampTimeSlots(openTime, closeTime));
  const from = parseTimeToMinutes(fromTime);
  const to = parseTimeToMinutes(toTime);
  if (from === null || to === null || to <= from) return [];
  const slots: string[] = [];
  for (let minutes = from; minutes < to; minutes += CAMP_SLOT_MINUTES) {
    const slot = formatMinutesToTime(minutes);
    if (allowed.has(slot)) slots.push(slot);
  }
  return slots;
}

function formatCampSlotRange(start: string, end: string): string {
  return `${start.slice(0, 5)}–${formatCampSlotEndLabel(end).slice(0, 5)}`;
}

export function formatCampTimeSlotsSummary(slots: string[]): string {
  if (slots.length === 0) return '—';
  const sorted = [...slots].sort();
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const prevMin = parseTimeToMinutes(rangeEnd);
    const currMin = parseTimeToMinutes(sorted[i]);
    if (prevMin !== null && currMin === prevMin + CAMP_SLOT_MINUTES) {
      rangeEnd = sorted[i];
      continue;
    }
    ranges.push(formatCampSlotRange(rangeStart, rangeEnd));
    rangeStart = sorted[i];
    rangeEnd = sorted[i];
  }
  ranges.push(formatCampSlotRange(rangeStart, rangeEnd));
  return ranges.join(', ');
}

export function computeCampDurationFromSlots(slots: string[]): number {
  return slots.length * CAMP_SLOT_MINUTES;
}

export function formatCampParticipationLabel(entry: {
  attended?: boolean;
  from_time: string;
  to_time: string;
  time_slots?: string[];
  duration_minutes: number;
}): string {
  if (entry.attended === false) return '오늘 출석 안 함';
  if (entry.time_slots?.length) {
    return `${formatCampTimeSlotsSummary(entry.time_slots)} · ${formatCampDuration(entry.duration_minutes)}`;
  }
  return `${entry.from_time} - ${entry.to_time} · ${formatCampDuration(entry.duration_minutes)}`;
}
