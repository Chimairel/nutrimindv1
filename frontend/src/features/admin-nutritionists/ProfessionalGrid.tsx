import { BadgeCheck } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import type { NutritionistRow } from './model';

export function ProfessionalGrid({
  nutritionists,
  workingId,
  onToggleLead,
}: {
  nutritionists: NutritionistRow[];
  workingId?: string | null;
  onToggleLead?: (nutritionist: NutritionistRow) => void;
}) {
  if (!nutritionists.length) {
    return <Card className="p-10 text-center text-sm text-brand-muted">No activated nutritionists yet.</Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {nutritionists.map((nutritionist) => (
        <Card key={nutritionist.id} className="p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <Avatar
                name={nutritionist.user.name}
                seed={nutritionist.user.image}
                size="md"
                className="border border-brand-green/30"
              />
              <span
                aria-label="Verified PRC Dietitian"
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-brand-border bg-brand-green text-[#07100d]"
              >
                <BadgeCheck className="h-3 w-3" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-brand-text">{nutritionist.user.name}</h3>
              <p className="truncate text-xs text-brand-muted">{nutritionist.user.email}</p>
              <p className="mt-1.5 break-all font-mono text-[9px] uppercase tracking-wider text-brand-muted">
                PRC {nutritionist.prcLicenseNumber}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-xl font-black text-brand-green">{nutritionist.totalVerified}</p>
              <p className="text-[9px] uppercase tracking-wider text-brand-muted">meals verified</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-brand-border pt-3">
            <div>
              <p className="text-xs font-bold text-brand-text">Lead review capability</p>
              <p className="text-[10px] text-brand-muted">Enhanced second reviews and governance actions</p>
            </div>
            <button
              type="button"
              disabled={!onToggleLead || workingId === nutritionist.id}
              onClick={() => onToggleLead?.(nutritionist)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                nutritionist.canLeadReview
                  ? 'bg-brand-green text-[#07100d]'
                  : 'border border-brand-border text-brand-muted'
              } disabled:opacity-50`}
            >
              {workingId === nutritionist.id ? 'Saving…' : nutritionist.canLeadReview ? 'Lead enabled' : 'Enable Lead'}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
