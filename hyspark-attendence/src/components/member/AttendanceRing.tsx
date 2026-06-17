import { cn } from '@/lib/utils';

interface AttendanceRingProps {
  rate: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function AttendanceRing({
  rate,
  size = 120,
  strokeWidth = 10,
  className,
}: AttendanceRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.min(Math.max(rate, 0), 100);
  const offset = circumference - (clampedRate / 100) * circumference;

  const toneColor = clampedRate >= 80
    ? 'hsl(var(--status-present))'
    : clampedRate >= 60
      ? 'hsl(var(--status-late))'
      : 'hsl(var(--status-absent))';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          opacity={0.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tabular-nums tracking-tight">{clampedRate}</span>
        <span className="text-[10px] font-bold text-muted-foreground">%</span>
      </div>
    </div>
  );
}
