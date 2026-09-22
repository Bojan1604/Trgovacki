import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Gusta tablica. Visina retka 30px, zaglavlje 26px, hairline granice.
 * Namjerno bez zebra-pruga — razmak i tipografija nose strukturu.
 */
export function Table({
  children,
  className,
  dense,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn('w-full overflow-x-auto scroll-thin', className)}>
      <table className={cn('w-full border-collapse text-base', dense && '[&_td]:py-0.5')}>{children}</table>
    </div>
  );
}

export function THead({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return (
    <thead
      className={cn(
        'text-xs font-medium uppercase tracking-[0.04em] text-ink-3',
        sticky && 'sticky top-0 z-10 glass',
      )}
    >
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-hairline">{children}</tbody>;
}

export function TR({
  children,
  className,
  onClick,
  selected,
  muted,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  muted?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors duration-75',
        onClick && 'cursor-pointer hover:bg-surface-3/70',
        selected && 'bg-accent-soft hover:bg-accent-soft',
        muted && 'text-ink-3',
        className,
      )}
    >
      {children}
    </tr>
  );
}

interface CellProps {
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  width?: string | number;
}

export function TH({
  children,
  className,
  align = 'left',
  numeric,
  width,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & CellProps & { children?: ReactNode }) {
  return (
    <th
      style={width ? { width } : undefined}
      className={cn(
        'h-[26px] whitespace-nowrap px-2 font-medium hairline-b',
        align === 'right' || numeric ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align = 'left',
  numeric,
  width,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & CellProps & { children?: ReactNode }) {
  return (
    <td
      style={width ? { width } : undefined}
      className={cn(
        'h-[30px] px-2 align-middle',
        numeric && 'font-mono text-sm tnum',
        align === 'right' || numeric ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** Zaglavlje grupe redaka unutar tablice. */
export function TGroupRow({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr className="bg-surface-2">
      <td colSpan={colSpan} className="h-[24px] px-2 text-xs font-medium uppercase tracking-[0.04em] text-ink-3">
        {children}
      </td>
    </tr>
  );
}

/** Redak sa zbrojem na dnu tablice. */
export function TFootRow({ children }: { children: ReactNode }) {
  return (
    <tfoot className="border-t-2 border-hairline-strong/60 font-semibold">
      <tr>{children}</tr>
    </tfoot>
  );
}
