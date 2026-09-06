import { BadgeCheck } from 'lucide-react';
import Card from '@/components/ui/Card';
import type { NutritionistRow } from './model';

export function ProfessionalGrid({ nutritionists }: { nutritionists: NutritionistRow[] }) {
  if (!nutritionists.length) {
    return <Card className="p-10 text-center text-sm text-brand-muted">No activated nutritionists yet.</Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {nutritionists.map((nutritionist) => (
        <Card key={nutritionist.id} className="p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-brand-text">{nutritionist.user.name}</h3>
              <p className="truncate text-xs text-brand-muted">{nutritionist.user.email}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted">
                PRC {nutritionist.prcLicenseNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-black text-brand-green">{nutritionist.totalVerified}</p>
              <p className="text-[9px] uppercase tracking-wider text-brand-muted">meals verified</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
