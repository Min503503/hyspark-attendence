const KST = "Asia/Seoul";

type Ymd = { year: number; month: number; day: number };

type SessionLike = {
  start_at: string;
  check_in_open_minutes?: number | null;
  attendance_code_issued_at?: string | null;
  status?: string;
  attendance_code_status?: string | null;
};

function getKstYmd(date: Date): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function getKstWeekday(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: KST, weekday: "short" }).format(date);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return map[label] ?? 0;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateAtKst(ymd: Ymd, hour: number, minute = 0): Date {
  return new Date(`${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}T${pad2(hour)}:${pad2(minute)}:00+09:00`);
}

function addDays(ymd: Ymd, days: number): Ymd {
  const utc = Date.UTC(ymd.year, ymd.month - 1, ymd.day + days);
  const shifted = new Date(utc);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function mondayOfWeek(ymd: Ymd): Ymd {
  const weekday = getKstWeekday(dateAtKst(ymd, 12));
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(ymd, -daysFromMonday);
}

export function compute5DayReminderSendAt(sessionStartAt: string | Date): Date {
  const sessionYmd = getKstYmd(new Date(sessionStartAt));
  const anchor = addDays(sessionYmd, -5);
  const monday = mondayOfWeek(anchor);
  return dateAtKst(monday, 10, 0);
}

export function compute1DayReminderSendAt(sessionStartAt: string | Date): Date {
  const start = new Date(sessionStartAt);
  return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

export function computeSessionOpenSendAt(session: SessionLike): Date | null {
  if (session.attendance_code_issued_at) {
    return new Date(session.attendance_code_issued_at);
  }
  if (session.status !== "scheduled" && session.status !== "open") return null;
  const openMinutes = session.check_in_open_minutes ?? 15;
  return new Date(new Date(session.start_at).getTime() - openMinutes * 60 * 1000);
}

export function computeAutomationSendAtFromRule(
  rule: { trigger_type: string; offset_minutes: number },
  session: SessionLike,
): Date | null {
  if (rule.trigger_type === "session_before") {
    if (rule.offset_minutes === -7200) return compute5DayReminderSendAt(session.start_at);
    if (rule.offset_minutes === -1440) return compute1DayReminderSendAt(session.start_at);
    return null;
  }
  if (rule.trigger_type === "session_open") return computeSessionOpenSendAt(session);
  return null;
}
