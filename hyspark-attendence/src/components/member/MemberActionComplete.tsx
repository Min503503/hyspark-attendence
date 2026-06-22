import { CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MemberActionCompleteProps = {
  title: string;
  description?: string;
  variant?: 'success' | 'info';
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};

const variantStyles = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-status-present',
    bg: 'bg-status-present/10',
  },
  info: {
    icon: Info,
    iconClass: 'text-primary',
    bg: 'bg-primary/10',
  },
};

export default function MemberActionComplete({
  title,
  description,
  variant = 'success',
  onDismiss,
  dismissLabel = '확인',
  className,
}: MemberActionCompleteProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div className={cn('rounded-xl px-4 py-5 text-center', styles.bg, className)}>
      <Icon className={cn('mx-auto h-9 w-9', styles.iconClass)} />
      <p className="mt-2.5 text-base font-extrabold tracking-tight">{title}</p>
      {description && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {onDismiss && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="mt-4 h-9 min-w-[7rem] font-bold"
        >
          {dismissLabel}
        </Button>
      )}
    </div>
  );
}
