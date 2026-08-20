import React from 'react';
import Button from '@/components/ui/Button';
import { Utensils } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Utensils className="h-8 w-8 text-brand-green" />,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`
        surface-panel mx-auto my-6 flex max-w-lg flex-col items-center justify-center rounded-[28px] border-dashed p-10 text-center
        ${className}
      `}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 p-4 text-brand-green shadow-cyan">
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
