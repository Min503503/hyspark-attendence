import type { Session } from '@/types';

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: '출석',
  late: '지각',
  early_leave: '조퇴',
  absent: '결석',
  excused_absent: '인정 결석',
  unexcused_absent: '미인정 결석',
};

export const ATTENDANCE_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  present: 'success',
  late: 'warning',
  early_leave: 'warning',
  absent: 'danger',
  excused_absent: 'neutral',
  unexcused_absent: 'danger',
};

export const EXCUSED_CATEGORIES = [
  { value: 'family', label: '가족 경조사' },
  { value: 'startup', label: '창업 활동' },
  { value: 'illness', label: '질병' },
  { value: 'exam', label: '학교/국가 자격시험' },
];

export type SessionPhase = 'waiting' | 'present' | 'late' | 'closed';

export interface SessionTimeline {
  session: Session;
  phase: SessionPhase;
  phaseLabel: string;
  openAt: Date;
  attendanceDeadline: Date;
  lateDeadline: Date;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDeadlineTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRemaining(now: Date, target: Date) {
  const remainingSeconds = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
  if (remainingSeconds <= 0) return '마감됨';

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes.toString().padStart(2, '0')}분 ${seconds.toString().padStart(2, '0')}초`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getSessionTimeline(session: Session, now: Date): SessionTimeline {
  const start = new Date(session.start_at);
  const openAt = new Date(start.getTime() - session.check_in_open_minutes * 60000);
  const attendanceDeadline = new Date(start.getTime() + session.attendance_deadline_minutes * 60000);
  const lateDeadline = new Date(start.getTime() + session.late_deadline_minutes * 60000);

  let phase: SessionPhase;
  let phaseLabel: string;

  if (now < openAt) {
    phase = 'waiting';
    phaseLabel = '출석 대기';
  } else if (now < attendanceDeadline) {
    phase = 'present';
    phaseLabel = '출석 인정';
  } else if (now < lateDeadline) {
    phase = 'late';
    phaseLabel = '지각 인정';
  } else {
    phase = 'closed';
    phaseLabel = '마감';
  }

  return { session, phase, phaseLabel, openAt, attendanceDeadline, lateDeadline };
}

export function findRelevantSession(sessions: Session[], now: Date): Session | null {
  const nowTime = now.getTime();
  return [...sessions]
    .filter(session => {
      const lateDeadline = new Date(session.start_at).getTime() + session.late_deadline_minutes * 60000;
      return (session.status === 'open' || session.status === 'scheduled') && lateDeadline >= nowTime;
    })
    .sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    })[0] ?? null;
}

export function getMemberInitial(name: string) {
  return name.trim().charAt(0) || '?';
}

export function getRiskLabel(riskState: 'stable' | 'counseling' | 'withdrawal') {
  if (riskState === 'counseling') return '면담';
  if (riskState === 'withdrawal') return '탈회';
  return '정상';
}

export function getRiskTone(riskState: 'stable' | 'counseling' | 'withdrawal') {
  if (riskState === 'withdrawal') return 'danger' as const;
  if (riskState === 'counseling') return 'warning' as const;
  return 'success' as const;
}
