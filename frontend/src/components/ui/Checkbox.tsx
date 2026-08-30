'use client';

import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  error?: boolean;
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className = '', label, error, id, ...props }, ref) => {
  return (
    <div className="flex items-center gap-3">
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        className={`
          peer h-5 w-5 shrink-0 rounded-md border border-brand-border bg-brand-surface/80
          outline-none transition-all duration-200 hover:border-brand-green/60 focus:ring-2 focus:ring-brand-green/20
          data-[state=checked]:border-brand-green data-[state=checked]:bg-brand-green data-[state=checked]:text-[#0d0d0d]
          disabled:cursor-not-allowed disabled:opacity-40
          ${error ? 'border-status-error-text/60' : ''}
          ${className}
        `}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[#0d0d0d]">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label
          htmlFor={id}
          className="cursor-pointer select-none text-sm font-medium tracking-wide text-brand-text peer-disabled:cursor-not-allowed peer-disabled:opacity-40"
        >
          {label}
        </label>
      )}
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export default Checkbox;
