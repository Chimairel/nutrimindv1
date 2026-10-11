import { UtensilsCrossed, ShieldCheck, UserCheck } from 'lucide-react';
import { formatBadgeCount } from '@/lib/badge-count';
import type { ReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';
import SharedWorkspaceTabs from '@/components/ui/WorkspaceTabs';

export type ReviewWorkspace = 'meal' | 'case' | 'profile';

const WORKSPACE_TABS = [
  { key: 'meal', label: 'Meal verification', icon: UtensilsCrossed },
  { key: 'case', label: 'Case approval', icon: ShieldCheck },
  { key: 'profile', label: 'Member queue', icon: UserCheck },
] as const;

export default function WorkspaceTabs({
  value,
  onChange,
  counts,
}: {
  value: ReviewWorkspace;
  onChange: (value: ReviewWorkspace) => void;
  counts: ReviewWorkCounts | null;
}) {
  return (
    <SharedWorkspaceTabs
      value={value}
      onChange={onChange}
      label="RND review queues"
      stackOnMobile
      items={WORKSPACE_TABS.map(({ key, label, icon: Icon }) => ({
        value: key,
        label,
        icon: <Icon className="h-4 w-4 shrink-0" />,
        count: counts && counts[key] > 0 ? formatBadgeCount(counts[key]) : undefined,
        countLabel: counts && counts[key] > 0 ? `${counts[key]} outstanding` : undefined,
      }))}
    />
  );
}
