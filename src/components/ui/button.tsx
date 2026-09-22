'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'pos';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_1px_1px_rgba(0,0,0,0.06)] hover:bg-accent-hover active:brightness-95',
  secondary:
    'bg-surface text-ink border border-hairline-strong/70 hover:bg-surface-3 active:bg-surface-3',
  outline:
    'bg-transparent text-ink border border-hairline-strong/70 hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'bg-negative text-white hover:brightness-110 active:brightness-95',
  success: 'bg-positive text-white hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1 rounded-sm',
  sm: 'h-7 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-8 px-3 text-base gap-1.5 rounded-md',
  lg: 'h-10 px-4 text-md gap-2 rounded-lg',
  pos: 'h-14 px-4 text-lg gap-2 rounded-xl font-medium',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconRight, block, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium no-select whitespace-nowrap',
        'transition-[background-color,color,box-shadow,transform] duration-100',
        'disabled:opacity-40 disabled:pointer-events-none active:scale-[0.985]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

/** Kvadratni gumb samo s ikonom — za alatne trake. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  function IconButton({ label, className, size = 'md', children, ...props }, ref) {
    const dims = size === 'xs' ? 'size-6' : size === 'sm' ? 'size-7' : size === 'lg' ? 'size-10' : 'size-8';
    return (
      <Button
        ref={ref}
        size={size}
        aria-label={label}
        title={label}
        className={cn('px-0', dims, className)}
        {...props}
      >
        {children}
      </Button>
    );
  },
);
