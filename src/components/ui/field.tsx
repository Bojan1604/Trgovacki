'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full bg-surface text-ink border border-hairline-strong/60 rounded-md px-2 h-8 text-base ' +
  'placeholder:text-ink-4 transition-[border-color,box-shadow] duration-100 ' +
  'hover:border-hairline-strong focus:border-accent focus:ring-[2.5px] focus:ring-accent/18 focus:outline-none ' +
  'disabled:bg-surface-3 disabled:text-ink-3 disabled:cursor-not-allowed';

export function Label({
  children,
  required,
  hint,
  className,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('flex items-baseline gap-1 text-sm font-medium text-ink-2 mb-1', className)}
    >
      {children}
      {required && <span className="text-negative">*</span>}
      {hint && <span className="text-xs font-normal text-ink-4">{hint}</span>}
    </label>
  );
}

export interface FieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  help?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({ label, required, hint, error, help, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label required={required} hint={hint} htmlFor={htmlFor}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-negative">{error}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-ink-4">{help}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string | null;
  help?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, help, hint, required, prefix, suffix, className, containerClassName, ...props },
  ref,
) {
  const id = useId();
  const control = (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-2 text-ink-4 pointer-events-none flex items-center">{prefix}</span>
      )}
      <input
        ref={ref}
        id={props.id ?? id}
        required={required}
        className={cn(
          CONTROL,
          prefix && 'pl-7',
          suffix && 'pr-8',
          error && 'border-negative focus:border-negative focus:ring-negative/18',
          className,
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute right-2 text-xs text-ink-4 pointer-events-none">{suffix}</span>
      )}
    </div>
  );

  if (!label && !error && !help) return <div className={containerClassName}>{control}</div>;
  return (
    <Field label={label} required={required} hint={hint} error={error} help={help} className={containerClassName} htmlFor={props.id ?? id}>
      {control}
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  help?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, help, options, placeholder, required, className, containerClassName, children, ...props },
  ref,
) {
  const id = useId();
  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={props.id ?? id}
        required={required}
        className={cn(CONTROL, 'appearance-none pr-7 cursor-pointer', error && 'border-negative', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-ink-4 pointer-events-none" />
    </div>
  );

  if (!label && !error && !help) return <div className={containerClassName}>{control}</div>;
  return (
    <Field label={label} required={required} error={error} help={help} className={containerClassName} htmlFor={props.id ?? id}>
      {control}
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | null }>(
  function Textarea({ label, error, required, className, ...props }, ref) {
    const id = useId();
    const control = (
      <textarea
        ref={ref}
        id={props.id ?? id}
        className={cn(CONTROL, 'h-auto min-h-[64px] py-1.5 resize-y', error && 'border-negative', className)}
        {...props}
      />
    );
    if (!label && !error) return control;
    return (
      <Field label={label} required={required} error={error} htmlFor={props.id ?? id}>
        {control}
      </Field>
    );
  },
);

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-2.5 no-select', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-px h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-positive' : 'bg-hairline-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-base leading-[18px]">{label}</span>}
          {description && <span className="block text-sm text-ink-3">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-1.5 no-select', disabled ? 'opacity-50' : 'cursor-pointer', className)}>
      <span
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
        className={cn(
          'grid place-items-center size-[15px] rounded-[4px] border transition-colors duration-100',
          checked || indeterminate
            ? 'bg-accent border-accent text-white'
            : 'bg-surface border-hairline-strong hover:border-ink-4',
        )}
      >
        {indeterminate ? (
          <span className="block h-[1.5px] w-[7px] rounded-full bg-white" />
        ) : checked ? (
          <svg viewBox="0 0 12 12" className="size-[10px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6.2 4.6 8.8 10 3.4" />
          </svg>
        ) : null}
      </span>
      {label && <span className="text-base">{label}</span>}
    </label>
  );
}
