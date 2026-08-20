import React from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-2xl font-display font-extrabold tracking-tight transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:ring-offset-2 focus:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100';
  
  const variants = {
    primary: 'border border-brand-accent/70 bg-brand-accent text-brand-black shadow-neon hover:-translate-y-0.5 hover:brightness-95',
    secondary: 'border border-brand-border/80 bg-brand-surface/85 text-brand-text shadow-sm backdrop-blur-md hover:-translate-y-0.5 hover:border-brand-green/35 hover:bg-brand-bgAlt/80',
    accent: 'border border-brand-green/70 bg-brand-green text-white shadow-sm shadow-brand-green/20 hover:-translate-y-0.5 hover:bg-brand-greenHover dark:text-brand-black',
    danger: 'border border-status-error-text/70 bg-status-error-text text-white shadow-sm hover:-translate-y-0.5 hover:brightness-90',
    ghost: 'border border-transparent bg-transparent text-brand-muted hover:border-brand-border/70 hover:bg-brand-surface/70 hover:text-brand-text',
  };

  const sizes = {
    sm: 'min-h-9 px-4 py-2 text-xs',
    md: 'min-h-11 px-5 py-2.5 text-sm',
    lg: 'min-h-[52px] px-7 py-3.5 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      data-button-variant={variant}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
