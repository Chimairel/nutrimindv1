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
    <header className={`portal-page-header ${className}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent text-[#07100d] shadow-neon">
              <Icon className="h-5 w-5" />
            </span>
            <p className="portal-kicker">{eyebrow}</p>
          </div>
          <h1 className="portal-title mt-6">{title}</h1>
          <p className="portal-subtitle mt-3">{description}</p>
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
