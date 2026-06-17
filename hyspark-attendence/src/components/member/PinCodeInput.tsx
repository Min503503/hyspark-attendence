import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const CODE_LENGTH = 5;

interface PinCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function PinCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  className,
}: PinCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.padEnd(CODE_LENGTH, ' ').split('').slice(0, CODE_LENGTH);

  const focusInput = useCallback(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (value.length === CODE_LENGTH && onComplete) {
      onComplete(value);
    }
  }, [value, onComplete]);

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(next);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={event => handleChange(event.target.value)}
        disabled={disabled}
        className="absolute inset-0 z-10 cursor-text opacity-0"
        aria-label="출결코드 5자리"
        maxLength={CODE_LENGTH}
      />
      <div
        role="group"
        aria-label="출결코드 입력"
        onClick={focusInput}
        className={cn(
          'grid grid-cols-5 gap-2 sm:gap-3',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {digits.map((digit, index) => {
          const isActive = !disabled && index === value.length;
          const isFilled = digit.trim() !== '';

          return (
            <div
              key={index}
              className={cn(
                'member-pin-cell flex h-12 items-center justify-center rounded-xl border-2 text-xl font-extrabold tabular-nums transition-all duration-200 sm:h-14 sm:text-2xl',
                isActive && 'member-pin-cell-active border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
                !isActive && isFilled && 'border-primary/40 bg-primary/5 text-foreground',
                !isActive && !isFilled && 'border-border/70 bg-secondary/30 text-muted-foreground/30',
              )}
            >
              {isFilled ? digit : isActive ? '|' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
