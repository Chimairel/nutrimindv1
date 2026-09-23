import { ListChecks, Sparkles, ShieldCheck, FileText, Repeat2, CheckCircle2, Clock3 } from 'lucide-react';
import type { SelectOption } from '@/components/ui/Select';

export const HISTORY_SOURCE_OPTIONS: SelectOption[] = [
  {
    value: 'All',
    label: 'All Sources',
    icon: <Sparkles className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'SYSTEM_GENERATED',
    label: 'KAINARA',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'USER_LOGGED',
    label: 'Outside Meal',
    icon: <FileText className="h-3.5 w-3.5 text-brand-muted dark:text-white/40" />,
  },
  {
    value: 'USER_SWAPPED',
    label: 'Swapped',
    icon: <Repeat2 className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
];

export const HISTORY_STATUS_OPTIONS: SelectOption[] = [
  {
    value: 'All',
    label: 'All Statuses',
    icon: <ListChecks className="h-3.5 w-3.5 text-brand-muted dark:text-white/40" />,
  },
  {
    value: 'DONE',
    label: 'Done',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'SKIPPED',
    label: 'Skipped',
    icon: <Clock3 className="h-3.5 w-3.5 text-amber-500" />,
  },
  {
    value: 'VOIDED',
    label: 'Voided',
    icon: <Clock3 className="h-3.5 w-3.5 text-brand-muted" />,
  },
];
