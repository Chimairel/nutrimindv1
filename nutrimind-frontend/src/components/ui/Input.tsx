import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full gap-1.5">
        {label && (
          <label 
            htmlFor={id} 
            className="text-sm font-semibold tracking-wide text-brand-text/90"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={`
            w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-base text-brand-text placeholder-brand-muted
            transition-all duration-200 outline-none
            focus:border-brand-green focus:ring-2 focus:ring-brand-green/20
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-status-error-text/60 focus:border-status-error-text focus:ring-status-error-text/25' : ''}
            ${className}
          `}
          {...props}
        />
        {error ? (
          <span className="text-xs font-semibold text-status-error-text animate-pulse">
            ⚠️ {error}
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
