import React from 'react';
import Button from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🍽️',
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-8 border border-dashed border-brand-border rounded-2xl bg-brand-surface/40 max-w-md mx-auto my-6
        ${className}
      `}
    >
      <div className="text-4xl mb-4 bg-brand-border/40 p-4 rounded-full w-16 h-16 flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-brand-text mb-1.5 font-display">
        {title}
      </h3>
      <p className="text-sm text-brand-muted leading-relaxed mb-6 px-4">
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
