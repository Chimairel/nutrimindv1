import { Droplets, Flame, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CalorieRing from '@/components/user/CalorieRing';
import type { UserProfileData } from '@/hooks/useProfile';

type Metrics = {
  caloriesConsumed: number;
  caloriesTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
  provisionalCalories: number;
  unresolvedMealCount: number;
};

type Props = {
  checkinDue: boolean;
  checkinStreak: number;
  metrics: Metrics;
  onAddWater: (amount: number) => void;
  onOpenCheckin: () => void;
  profile: UserProfileData['userProfile'];
  waterIntake: number;
};

export function DashboardHealthSnapshot({
  checkinDue,
  checkinStreak,
  onAddWater,
  onOpenCheckin,
  profile,
  waterIntake,
  layout = 'grid',
}: {
  checkinDue: boolean;
  checkinStreak: number;
  onAddWater: (amount: number) => void;
  onOpenCheckin: () => void;
  profile: UserProfileData['userProfile'];
  waterIntake: number;
  layout?: 'grid' | 'stack';
}) {
  return (
    <div
      className={
        layout === 'stack' ? 'flex flex-col gap-3 text-left' : 'order-4 grid grid-cols-1 gap-3 text-left md:grid-cols-3'
      }
      aria-label="Health snapshot"
    >
      <SnapshotCard title="Check-In Streak" icon={<Flame className="h-4 w-4" />}>
        <h4 className="font-display text-xl font-black text-brand-text">
          {checkinStreak} {checkinStreak === 1 ? 'Week' : 'Weeks'}
        </h4>
        <p className="mt-1 text-xs text-brand-muted">
          {checkinDue ? 'Your weekly check-in is due today!' : 'Streak active. Keep logging!'}
        </p>
        {checkinDue && (
          <Button variant="accent" size="sm" onClick={onOpenCheckin} className="mt-3 w-full text-xs font-bold">
            Complete Check-In
          </Button>
        )}
      </SnapshotCard>
      <SnapshotCard title="Weight Goals" icon={<Scale className="h-4 w-4" />}>
        <div className="flex items-baseline gap-2">
          <h4 className="font-display text-xl font-black text-brand-text">
            {profile?.weightKg ?? '--'} <span className="text-xs font-bold text-brand-muted">kg</span>
          </h4>
          {profile?.targetWeightKg && (
            <span className="text-xs font-semibold text-brand-muted">target: {profile.targetWeightKg} kg</span>
          )}
        </div>
        <p className="mt-1 text-xs text-brand-muted">{weightProgress(profile?.weightKg, profile?.targetWeightKg)}</p>
      </SnapshotCard>
      <SnapshotCard title="Water Intake" icon={<Droplets className="h-4 w-4" />}>
        <h4 className="font-display text-xl font-black text-brand-text">
          {waterIntake} <span className="text-xs font-bold text-brand-muted">/ 2500 mL</span>
        </h4>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-bgAlt">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan transition-all duration-300"
            style={{ width: `${Math.min(100, (waterIntake / 2500) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onAddWater(-250)}
            className="flex-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-1 text-xs font-bold text-brand-text hover:bg-brand-bgAlt"
          >
            -250mL
          </button>
          <button
            onClick={() => onAddWater(250)}
            className="flex-1 rounded-lg border border-brand-green bg-brand-green px-3 py-1 text-xs font-bold text-white hover:bg-brand-greenHover dark:text-brand-black"
          >
            +250mL
          </button>
        </div>
      </SnapshotCard>
    </div>
  );
}

export function DashboardNutritionBudgets({ metrics, className = '' }: { metrics: Metrics; className?: string }) {
  return (
    <div className={`grid grid-cols-1 items-center gap-6 md:grid-cols-3 ${className}`} aria-label="Nutrition budgets">
      <Card
        className="min-h-[300px] border border-brand-border/60 bg-brand-surface md:col-span-1"
        contentClassName="flex min-h-[300px] items-center justify-center p-6"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <CalorieRing consumed={metrics.caloriesConsumed} target={metrics.caloriesTarget} />
          {metrics.provisionalCalories > 0 && (
            <p className="rounded-full bg-status-pending-bg px-3 py-1 text-[11px] font-bold text-status-pending-text">
              Includes {Math.round(metrics.provisionalCalories)} provisional kcal
            </p>
          )}
          {metrics.unresolvedMealCount > 0 && (
            <p className="text-[11px] font-semibold text-brand-muted">
              {metrics.unresolvedMealCount} outside {metrics.unresolvedMealCount === 1 ? 'log has' : 'logs have'}{' '}
              unresolved food excluded
            </p>
          )}
        </div>
      </Card>
      <Card
        className="min-h-[300px] border border-brand-border/60 bg-brand-surface md:col-span-2"
        contentClassName="flex min-h-[300px] flex-col justify-center gap-6 p-6 md:p-8"
      >
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-brand-muted">
          Daily Macronutrient Budgets
        </h3>
        <MacroBar label="Protein" consumed={metrics.proteinConsumed} target={metrics.proteinTarget} tone="protein" />
        <MacroBar label="Carbohydrates" consumed={metrics.carbsConsumed} target={metrics.carbsTarget} tone="carbs" />
        <MacroBar label="Fat" consumed={metrics.fatConsumed} target={metrics.fatTarget} tone="fat" />
      </Card>
    </div>
  );
}

export function DashboardSummary(props: Props) {
  return (
    <>
      <DashboardHealthSnapshot
        checkinDue={props.checkinDue}
        checkinStreak={props.checkinStreak}
        onAddWater={props.onAddWater}
        onOpenCheckin={props.onOpenCheckin}
        profile={props.profile}
        waterIntake={props.waterIntake}
      />
      <div className="order-3">
        <DashboardNutritionBudgets metrics={props.metrics} />
      </div>
    </>
  );
}

function SnapshotCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card
      className="min-h-[118px] border border-brand-border/50 bg-brand-surface/80 hover:border-brand-green/25 hover:shadow-card-hover"
      contentClassName="flex h-full min-h-[118px] flex-col justify-between p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green">
          {icon}
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

function MacroBar({
  label,
  consumed,
  target,
  tone,
}: {
  label: string;
  consumed: number;
  target: number;
  tone: 'protein' | 'carbs' | 'fat';
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="font-extrabold uppercase tracking-wider" style={{ color: `var(--macro-${tone})` }}>
          {label}
        </span>
        <span className="text-brand-text">
          {Math.round(consumed)}g / {Math.round(target)}g
        </span>
      </div>
      <div
        className="h-4 w-full overflow-hidden rounded-full border border-brand-border/60"
        style={{ backgroundColor: 'var(--macro-track-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${Math.min(100, (consumed / Math.max(1, target)) * 100)}%`,
            backgroundColor: `var(--macro-${tone})`,
          }}
        />
      </div>
    </div>
  );
}

function weightProgress(weight?: number | null, target?: number | null) {
  if (!weight || !target) return 'Log weight to track progress';
  const difference = weight - target;
  if (difference === 0) return 'Target weight reached!';
  return `${Math.abs(difference).toFixed(1)} kg to target`;
}
