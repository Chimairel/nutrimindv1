import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label 
            htmlFor={id} 
            className="font-display text-xs font-bold tracking-wide text-brand-text/90"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={`
            w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text shadow-sm outline-none backdrop-blur-md placeholder:text-brand-muted/60
            transition-all duration-200
            hover:border-brand-green/25 focus:border-brand-green/55 focus:bg-brand-surface focus:ring-4 focus:ring-brand-green/10
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-status-error-text/60 focus:border-status-error-text focus:ring-status-error-text/25' : ''}
            ${className}
          `}
          {...props}
        />
        {error ? (
          <span className="text-xs font-semibold text-status-error-text animate-pulse inline-flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </span>
        ) : helperText ? (
          <span className="text-xs text-brand-muted">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);


Input.displayName = 'Input';

export default Input;
