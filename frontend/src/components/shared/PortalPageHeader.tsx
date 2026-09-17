import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PortalPageHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export default function PortalPageHeader({ title, description, actions, meta, className = '' }: PortalPageHeaderProps) {
  return (
    <header className={`workspace-header ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-muted">{description}</p>
        </div>
        {(actions || meta) && (
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            {meta}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
