'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Grid2X2, Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { workspaceLabels, workspaceTools, type WorkspaceRole } from '@/lib/workspace-navigation';

export function WorkspaceTools({ role }: { role: WorkspaceRole }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const tools = workspaceTools[role].filter((tool) =>
    `${tool.label} ${tool.description} ${tool.group}`.toLowerCase().includes(query.toLowerCase().trim())
  );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 text-xs font-bold text-brand-text hover:border-brand-green/40"
      >
        <Grid2X2 className="h-4 w-4 text-brand-green" /> All tools
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={workspaceLabels[role]}
        description="Find a tool and continue where you left off."
        size="xl"
      >
        <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-bgAlt px-3">
          <Search className="h-4 w-4 text-brand-muted" />
          <input
            type="search"
            aria-label="Find a workspace tool"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meals, reports, settings…"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="mt-5 space-y-5">
          {[...new Set(tools.map((tool) => tool.group))].map((group) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-muted">{group}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {tools
                  .filter((tool) => tool.group === group)
                  .map(({ label, href, description, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="group flex gap-3 rounded-2xl border border-brand-border/60 p-3 transition-colors hover:border-brand-green/40 hover:bg-brand-green/5"
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-bold text-brand-text">
                          {label}
                          <ArrowUpRight className="h-3.5 w-3.5 text-brand-muted" />
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-brand-muted">{description}</span>
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
          {tools.length === 0 && (
            <p role="status" className="py-6 text-center text-sm text-brand-muted">
              No matching tools. Try another search.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
