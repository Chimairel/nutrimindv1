import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
  contentClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  interactive = false,
  contentClassName,
  className = '',
  ...props
}) => {
  const hasOuterPadding = /(?:^|\s)(?:p|px|py|pt|pr|pb|pl)-/.test(className);
  const resolvedContentClassName = contentClassName ?? (hasOuterPadding ? '' : 'px-6 py-5');

  return (
    <div
      className={`
        overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface/86 text-brand-text shadow-card backdrop-blur-xl transition-all duration-300
        ${interactive ? 'cursor-pointer hover:-translate-y-1 hover:border-brand-green/30 hover:shadow-card-hover' : ''}
        ${className}
      `}
      {...props}
    >
      {header && (
        <div className="border-b border-brand-border/45 px-6 pb-4 pt-5">
          {header}
        </div>
      )}
      <div className={resolvedContentClassName}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-brand-border/45 px-6 pb-5 pt-4">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
