import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PortalPageHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export default function PortalPageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  meta,
  className = '',
}: PortalPageHeaderProps) {
  return (
    <header className={`workspace-header ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent text-[#07100d]">
              <Icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold text-brand-muted">{eyebrow}</p>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{title}</h1>
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
