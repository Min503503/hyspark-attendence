import { CalendarCheck, ClipboardList, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MemberTab = 'checkin' | 'stats' | 'history';

const TABS: { id: MemberTab; label: string; icon: typeof ScanLine }[] = [
  { id: 'checkin', label: '출석', icon: ScanLine },
  { id: 'stats', label: '내 출결', icon: CalendarCheck },
  { id: 'history', label: '기록', icon: ClipboardList },
];

interface MemberBottomNavProps {
  active: MemberTab;
  onChange: (tab: MemberTab) => void;
  checkInBadge?: boolean;
}

export default function MemberBottomNav({ active, onChange, checkInBadge }: MemberBottomNavProps) {
  return (
    <nav
      className="member-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80"
      aria-label="학회원 메뉴"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const showBadge = tab.id === 'checkin' && checkInBadge && !isActive;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-status-present animate-pulse-dot" />
                )}
              </span>
              <span className={cn('text-[10px] font-bold', isActive && 'text-primary')}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
