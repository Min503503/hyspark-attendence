import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import hysparkLogo from '@/assets/hyspark-logo.png';

export function PageShell({
  children,
  className,
  size = 'lg',
}: {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const width = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
  }[size];

  return (
    <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8', width, className)}>
      {children}
    </div>
  );
}

export function BackLink({
  to,
  onClick,
  label = '뒤로',
}: {
  to?: string;
  onClick?: () => void;
  label?: string;
}) {
  const className =
    'app-focus-ring inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground';

  if (to) {
    return (
      <Link to={to} className={className}>
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="animate-reveal-up space-y-4">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground/80">{eyebrow}</p>
          )}
          <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-foreground sm:text-[1.875rem]">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        </div>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Surface({
  id,
  children,
  className,
  style,
  brand = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  brand?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
      style={style}
    >
      {brand && <SparkWatermark />}
      {children}
    </div>
  );
}

export function Panel({
  id,
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  style,
}: {
  id?: string;
  title?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <Surface id={id} className={className} style={style}>
      {title && (
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
              <h3 className="text-sm font-bold text-foreground">{title}</h3>
            </div>
            {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(title ? 'p-5' : 'p-5', bodyClassName)}>{children}</div>
    </Surface>
  );
}

export function SparkWatermark({ className }: { className?: string }) {
  return (
    <img
      src={hysparkLogo}
      alt=""
      aria-hidden="true"
      data-spark-watermark="true"
      className={cn(
        'pointer-events-none absolute -right-5 -top-7 h-28 w-28 rotate-[-10deg] object-contain opacity-[0.04] mix-blend-multiply',
        className,
      )}
    />
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  helper,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  helper?: ReactNode;
  onClick?: () => void;
}) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-status-present',
    warning: 'text-status-late',
    danger: 'text-status-absent',
    accent: 'text-primary',
  }[tone];

  const content = (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/80 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn('text-[1.75rem] font-extrabold leading-none tabular-nums tracking-tight', toneClass)}>
        {value}
      </p>
      {helper && <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{helper}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="app-focus-ring w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] hover:border-border hover:shadow-md active:scale-[0.995]"
      >
        {content}
      </button>
    );
  }

  return <Surface className="p-4">{content}</Surface>;
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4', className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Surface className="px-6 py-10 text-center">
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && <div className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">{description}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Surface>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
}) {
  const toneClass = {
    neutral: 'border-border bg-secondary/70 text-muted-foreground',
    success: 'border-status-present/20 bg-status-present/10 text-status-present',
    warning: 'border-status-late/20 bg-status-late/10 text-status-late',
    danger: 'border-status-absent/20 bg-status-absent/10 text-status-absent',
    accent: 'border-primary/20 bg-primary/8 text-primary',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DataRow({
  children,
  className,
  onClick,
  style,
  chevron = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
  chevron?: boolean;
}) {
  const baseClass = cn(
    'group w-full rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] hover:border-border hover:shadow-md active:scale-[0.995]',
    chevron && 'pr-3',
    className,
  );

  const inner = (
    <>
      {children}
      {chevron && (
        <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style} className={cn('relative', baseClass)}>
        {inner}
      </button>
    );
  }

  return (
    <div style={style} className={cn('relative', baseClass)}>
      {inner}
    </div>
  );
}

export function AdminTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-secondary/40 p-1 scrollbar-clean">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors',
            active === tab.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
