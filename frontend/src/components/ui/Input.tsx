import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  validationState?: 'default' | 'error' | 'success';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      validationState = 'default',
      className = '',
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const resolvedId = id ?? (label ? generatedId : undefined);
    const resolvedValidationState = error ? 'error' : validationState;
    const messageId = resolvedId && (error || helperText) ? `${resolvedId}-${error ? 'error' : 'help'}` : undefined;
    const describedBy = [ariaDescribedBy, messageId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label htmlFor={resolvedId} className="font-display text-xs font-bold tracking-wide text-brand-text/90">
            {label}
          </label>
        )}
        <input
          id={resolvedId}
          ref={ref}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          data-validation-state={resolvedValidationState}
          className={`
            w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text shadow-sm outline-none backdrop-blur-md placeholder:text-brand-muted/60
            transition-all duration-200
            hover:border-brand-green/25 focus:bg-brand-surface focus:ring-4
            disabled:opacity-40 disabled:cursor-not-allowed
            ${resolvedValidationState === 'default' ? 'focus:border-brand-green/55 focus:ring-brand-green/10' : ''}
            ${resolvedValidationState === 'error' ? 'border-status-error-text/70 focus:border-status-error-text focus:ring-status-error-text/35' : ''}
            ${resolvedValidationState === 'success' ? 'border-brand-green/70 focus:border-brand-green focus:ring-brand-green/30' : ''}
            ${className}
          `}
          {...props}
        />
        {error ? (
          <span
            id={messageId}
            role="alert"
            className="text-xs font-semibold text-status-error-text inline-flex items-center gap-1"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </span>
        ) : helperText ? (
          <span id={messageId} className="text-xs text-brand-muted">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
