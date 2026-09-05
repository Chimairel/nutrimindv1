'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { safetyInputsFromProfile } from '@/lib/safety-intake';

export default function OnboardingAllergiesPage() {
  const router = useRouter();
  const { profile, isLoading } = useProfile();
  const { refreshSession } = useAuth();
  const initialEntries = useMemo(() => safetyInputsFromProfile(profile), [profile]);

  return (
    <div className="min-h-screen bg-brand-bg p-4 text-brand-text sm:p-6">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 py-8">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-brand-muted">
            <span>Step 4 of 6</span><span className="text-brand-green">67% completed</span>
          </div>
          <Progress value={67} className="bg-brand-border/40" />
        </div>
        <Card className="border-brand-border/80 p-5 shadow-2xl sm:p-8">
          <button type="button" onClick={() => router.push('/onboarding/conditions')}
            className="mb-5 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
            <ArrowLeft className="h-3 w-3" /> Back to conditions
          </button>
          <h1 className="font-display text-2xl font-extrabold text-brand-green">Food safety</h1>
          <p className="mt-2 text-sm text-brand-muted">Record allergies, intolerances, and foods or ingredients you avoid as separate entries.</p>
          <div className="my-6 flex gap-2 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-3 text-xs text-status-pending-text">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Each category is evaluated together. An unsupported entry is retained and routes automatic compatibility to review.
          </div>
          {isLoading ? <p className="text-sm text-brand-muted">Loading your safety profile…</p> : (
            <StructuredSafetyIntake
              initialEntries={initialEntries}
              editableDomains={['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
              submitLabel="Save and continue"
              onSaved={async () => { await refreshSession(); router.push('/onboarding/shopping-day'); }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
