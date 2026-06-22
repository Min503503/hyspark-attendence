import { describe, expect, it } from 'vitest';
import {
  buildCampTimeSlots,
  buildCampWeekdays,
  CAMP_SLOT_MINUTES,
  computeCampDurationFromSlots,
  expandCampResponseToSlots,
  formatCampTimeSlotsSummary,
  pickDefaultCampSurveyDate,
} from '@/lib/campSurvey';

describe('campSurvey time slots', () => {
  it('buildCampTimeSlots: 10:00-22:00 → 30분 × 24칸', () => {
    const slots = buildCampTimeSlots('10:00', '22:00');
    expect(slots).toHaveLength(24);
    expect(slots[0]).toBe('10:00');
    expect(slots[1]).toBe('10:30');
    expect(slots[slots.length - 1]).toBe('21:30');
  });

  it('discontinuous 30-min selection totals correct duration', () => {
    const slots = ['12:00', '12:30', '13:00', '13:30', '14:00', '15:00', '15:30', '16:00'];
    expect(computeCampDurationFromSlots(slots)).toBe(8 * CAMP_SLOT_MINUTES);
    expect(formatCampTimeSlotsSummary(slots)).toBe('12:00–14:30, 15:00–16:30');
  });

  it('expandCampResponseToSlots restores legacy continuous range', () => {
    const slots = expandCampResponseToSlots('10:00', '11:30', '10:00', '22:00');
    expect(slots).toEqual(['10:00', '10:30', '11:00']);
  });

  it('buildCampWeekdays: Mon–Fri only within range', () => {
    expect(buildCampWeekdays('2026-06-22', '2026-06-26')).toEqual([
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
    ]);
  });

  it('pickDefaultCampSurveyDate prefers today when eligible', () => {
    const days = buildCampWeekdays('2026-06-22', '2026-06-26').map(date => ({
      date,
      weekday_label: '월',
    }));
    expect(pickDefaultCampSurveyDate(days, '2026-06-24')).toBe('2026-06-24');
    expect(pickDefaultCampSurveyDate(days, '2026-06-28')).toBe('2026-06-26');
  });
});
