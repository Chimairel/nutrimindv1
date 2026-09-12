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
        overflow-hidden rounded-2xl border border-brand-border bg-brand-surface text-brand-text shadow-sm transition-colors duration-150
        ${interactive ? 'cursor-pointer hover:border-brand-green/40 hover:shadow-md' : ''}
        ${className}
      `}
      {...props}
    >
      {header && <div className="border-b border-brand-border/45 px-6 pb-4 pt-5">{header}</div>}
      <div className={resolvedContentClassName}>{children}</div>
      {footer && <div className="border-t border-brand-border/45 px-6 pb-5 pt-4">{footer}</div>}
    </div>
  );
};

export default Card;
