'use client';

import { useState } from 'react';
import { QueueHeader, QueueList, QueueRow, QueueSkeleton, queueLabel } from '@/components/shared/WorkspaceQueue';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';

type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'detail' | 'expanded' | 'isLoading' | 'people' | 'busy' | 'openPerson' | 'openingPersonId' | 'error'
  >;
};

export default function ProfileReviewQueue({ model }: SectionProps) {
  const { detail, expanded, isLoading, people, busy, openPerson, openingPersonId, error } = model;
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = people.filter((person) =>
    [person.name, ...person.conditions, ...person.allergies, person.profileStatus ?? ''].some((value) =>
      queueLabel(value).includes(query)
    )
  );

  return (
    <aside
      aria-label="Member review navigation"
      className={`${detail ? 'hidden lg:flex' : 'flex'} ${expanded ? '!hidden' : ''} min-h-0 w-full shrink-0 flex-col border-r border-brand-border/70 p-4 lg:w-[32%] lg:min-w-[280px] lg:max-w-[360px]`}
    >
      <QueueHeader
        title="Member queue"
        count={people.length}
        search={search}
        onSearch={setSearch}
        searchLabel="Search members or health context"
        description="Profile tasks and documents, grouped by member. Select a person to inspect their review."
      />
      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <QueueSkeleton count={5} label="Loading member profile queue" />
        </div>
      ) : visible.length ? (
        <QueueList label="Members awaiting review">
          {visible.map((person) => {
            const loading = openingPersonId === person.userId;
            const selected = openingPersonId ? loading : detail?.userId === person.userId;
            const conditions = person.conditions.filter((item) => item !== 'NONE').map(queueLabel);
            const allergies = person.allergies.filter((item) => item !== 'NONE').map(queueLabel);
            return (
              <QueueRow
                key={person.userId}
                title={person.name}
                selected={selected}
                loading={loading}
                disabled={busy}
                onSelect={() => void openPerson(person.userId)}
              >
                <span className="block break-words text-brand-muted [overflow-wrap:anywhere]">
                  Conditions: {conditions.join(', ') || 'none'} · Allergies: {allergies.join(', ') || 'none'}
                </span>
                <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span
                    className={
                      person.profileStatus === 'APPROVED' ? 'text-brand-green' : 'font-semibold text-brand-text'
                    }
                  >
                    {person.profileStatus
                      ? `Profile: ${queueLabel(person.profileStatus)}`
                      : 'No pending profile decision'}
                  </span>
                  <span className="text-brand-muted">
                    {person.documentCount} document{person.documentCount === 1 ? '' : 's'}
                  </span>
                </span>
              </QueueRow>
            );
          })}
        </QueueList>
      ) : (
        <p role="status" className="p-4 text-sm text-brand-muted">
          {people.length
            ? 'No members match your search.'
            : error
              ? 'The member queue is unavailable.'
              : 'Profile queue is clear.'}
        </p>
      )}
    </aside>
  );
}
