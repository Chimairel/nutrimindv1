import { AlertCircle, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { MealType } from '@/types';
import type { OutsideMealWarning } from './model';

type Props = {
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  mealName: string;
  mealType: MealType;
  notes: string;
  onClose: () => void;
  onMealNameChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (acknowledgeWarning: boolean) => void;
  onWarningCancel: () => void;
  warning: OutsideMealWarning | null;
};

const mealLabels: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

export function OutsideMealModal(props: Props) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="LOG OUTSIDE MEAL">
      <div className="flex flex-col gap-5 p-2 text-left">
        {props.error && (
          <div className="flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{props.error}</span>
          </div>
        )}
        {props.warning ? <WarningConfirmation {...props} warning={props.warning} /> : <OutsideMealForm {...props} />}
      </div>
    </Modal>
  );
}

function WarningConfirmation(props: Props & { warning: OutsideMealWarning }) {
  const estimate = props.warning.estimate;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-4 leading-relaxed text-status-pending-text">
        <span className="flex items-center gap-1.5 font-display text-sm font-extrabold uppercase">
          <AlertCircle className="h-4 w-4 shrink-0" /> Clinical Guardrail Alert!
        </span>
        <ul className="flex list-disc flex-col gap-2 pl-4 text-xs font-semibold">
          {props.warning.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>
      <Card className="flex flex-col gap-3 border-brand-border/60 bg-brand-bgAlt/50 p-5">
        <h4 className="font-display text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
          AI Nutrition Estimates
        </h4>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <MacroEstimate label="Cal" value={Math.round(estimate.calories)} />
          <MacroEstimate label="Prot" value={`${Math.round(estimate.proteinG)}g`} tone="protein" />
          <MacroEstimate label="Carb" value={`${Math.round(estimate.carbsG)}g`} tone="carbs" />
          <MacroEstimate label="Fat" value={`${Math.round(estimate.fatG)}g`} tone="fat" />
        </div>
      </Card>
      <div className="mt-2 flex gap-3">
        <Button
          variant="secondary"
          className="flex-1 text-xs font-bold"
          onClick={props.onWarningCancel}
          disabled={props.isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1 border-red-500/20 bg-red-500 text-xs font-bold text-white shadow-xl shadow-red-500/10 hover:bg-red-600"
          onClick={() => props.onSubmit(true)}
          isLoading={props.isLoading}
        >
          Log Anyway
        </Button>
      </div>
    </div>
  );
}

function MacroEstimate({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'protein' | 'carbs' | 'fat';
}) {
  const style = tone ? { backgroundColor: `var(--macro-${tone}-bg)`, color: `var(--macro-${tone})` } : undefined;
  return (
    <div className="rounded-lg border border-brand-border/20 bg-brand-border/30 p-2.5" style={style}>
      <span className="mb-0.5 block text-[9px] uppercase text-brand-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function OutsideMealForm(props: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(false);
      }}
      className="flex flex-col gap-5"
    >
      <Input
        id="mealName"
        label="Meal Name"
        placeholder="e.g. Pork Adobo with Hard Boiled Egg"
        value={props.mealName}
        onChange={(event) => props.onMealNameChange(event.target.value)}
        disabled={props.isLoading}
        required
      />
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold tracking-wide text-brand-text/90">Meal Category</label>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
          {(['BREAKFAST', 'LUNCH', 'DINNER'] as MealType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => props.onMealTypeChange(type)}
              className={`rounded-xl border py-2.5 outline-none transition-all duration-200 ${props.mealType === type ? 'border-brand-green bg-brand-green/10 font-bold text-brand-green' : 'border-brand-border bg-brand-surface/40 text-brand-muted hover:text-brand-text'}`}
            >
              {mealLabels[type]}
            </button>
          ))}
        </div>
      </div>
      <Input
        id="notes"
        label="Notes / Serving Size (Optional)"
        placeholder="e.g. Ate at Jollibee, standard chicken portion"
        value={props.notes}
        onChange={(event) => props.onNotesChange(event.target.value)}
        disabled={props.isLoading}
      />
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full py-3.5 text-xs font-bold tracking-wider"
        disabled={!props.mealName.trim()}
        isLoading={props.isLoading}
      >
        Log Meal Log
      </Button>
    </form>
  );
}
