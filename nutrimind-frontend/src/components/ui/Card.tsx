import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  interactive = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        rounded-2xl border border-brand-border bg-brand-surface text-brand-text shadow-xl overflow-hidden
        ${interactive ? 'transition-all duration-300 hover:border-brand-green/40 hover:bg-brand-bgAlt/40 hover:shadow-2xl hover:shadow-brand-green/5 cursor-pointer hover:translate-y-[-2px]' : ''}
        ${className}
      `}
      {...props}
    >
      {header && (
        <div className="border-b border-brand-border px-6 py-4 bg-brand-bgAlt/50">
          {header}
        </div>
      )}
      <div className="px-6 py-5">
        {children}
      </div>
      {footer && (
        <div className="border-t border-brand-border px-6 py-4 bg-brand-bgAlt/30">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
