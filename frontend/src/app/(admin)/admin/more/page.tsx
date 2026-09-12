import Link from 'next/link';
import { workspaceTools } from '@/lib/workspace-navigation';
export default function AdminToolsPage() {
  return (
    <div className="portal-page space-y-5">
      <h1 className="font-display text-2xl font-bold">Administrator tools</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaceTools.ADMIN.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex gap-3 rounded-2xl border border-brand-border bg-brand-surface p-4"
          >
            <Icon className="h-5 w-5 shrink-0 text-brand-green" />
            <div>
              <h2 className="font-semibold">{label}</h2>
              <p className="mt-1 text-sm text-brand-muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
