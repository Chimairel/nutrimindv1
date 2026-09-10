import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { workspaceTools, type WorkspaceRole } from '@/lib/workspace-navigation';

export function WorkspaceLinkGrid({ role, exclude = [] }: { role: WorkspaceRole; exclude?: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {workspaceTools[role]
        .filter((tool) => !exclude.includes(tool.href))
        .map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface p-4 text-left transition-colors hover:border-brand-green/40 hover:bg-brand-green/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-sm font-bold text-brand-text">
                {label}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-muted" />
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-brand-muted">{description}</span>
            </span>
          </Link>
        ))}
    </div>
  );
}
