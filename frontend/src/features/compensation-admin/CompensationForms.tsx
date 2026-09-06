import type { FormEvent } from 'react';
import { Calculator, Plus } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { compensationFieldClass, type Policy } from './model';

export type PolicyForm = {
  version: string;
  baseRetainer: string;
  capUnits: string;
  bands: string;
  effectiveFrom: string;
};

export type PeriodForm = { policyId: string; start: string; end: string };

type Props = {
  activePolicies: Policy[];
  busy: string | null;
  onPeriodChange: (value: PeriodForm) => void;
  onPeriodSubmit: (event: FormEvent) => void;
  onPolicyChange: (value: PolicyForm) => void;
  onPolicySubmit: (event: FormEvent) => void;
  periodForm: PeriodForm;
  policyForm: PolicyForm;
};

export function CompensationForms(props: Props) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Plus className="h-5 w-5 text-brand-green" />
          <div>
            <h2 className="font-display text-lg font-black">Draft policy</h2>
            <p className="text-xs text-brand-muted">Amounts are inactive until another admin activates this version.</p>
          </div>
        </div>
        <form onSubmit={props.onPolicySubmit} className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Version"
            value={props.policyForm.version}
            onChange={(version) => props.onPolicyChange({ ...props.policyForm, version })}
            placeholder="2026-Q4-demo"
          />
          <TextField
            label="Base retainer · PHP"
            value={props.policyForm.baseRetainer}
            onChange={(baseRetainer) => props.onPolicyChange({ ...props.policyForm, baseRetainer })}
            type="number"
            min="0"
            step="0.01"
          />
          <TextField
            label="Workload cap · units"
            value={props.policyForm.capUnits}
            onChange={(capUnits) => props.onPolicyChange({ ...props.policyForm, capUnits })}
            type="number"
            min="0"
            step="0.001"
          />
          <TextField
            label="Effective from"
            value={props.policyForm.effectiveFrom}
            onChange={(effectiveFrom) => props.onPolicyChange({ ...props.policyForm, effectiveFrom })}
            type="datetime-local"
          />
          <label className="text-xs text-brand-muted sm:col-span-2">
            Bands · units:PHP, comma separated
            <input
              required
              className={`${compensationFieldClass} mt-1`}
              value={props.policyForm.bands}
              onChange={(event) => props.onPolicyChange({ ...props.policyForm, bands: event.target.value })}
            />
          </label>
          <Button className="sm:col-span-2" isLoading={props.busy === 'policy-new'}>
            <Plus className="h-4 w-4" /> Create inactive draft
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Calculator className="h-5 w-5 text-brand-cyan" />
          <div>
            <h2 className="font-display text-lg font-black">Open period</h2>
            <p className="text-xs text-brand-muted">The active policy is locked to the new period.</p>
          </div>
        </div>
        <form onSubmit={props.onPeriodSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-brand-muted sm:col-span-2">
            Active policy
            <select
              required
              className={`${compensationFieldClass} mt-1`}
              value={props.periodForm.policyId}
              onChange={(event) => props.onPeriodChange({ ...props.periodForm, policyId: event.target.value })}
            >
              <option value="">Select policy</option>
              {props.activePolicies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.version}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Start"
            value={props.periodForm.start}
            onChange={(start) => props.onPeriodChange({ ...props.periodForm, start })}
            type="datetime-local"
          />
          <TextField
            label="End"
            value={props.periodForm.end}
            onChange={(end) => props.onPeriodChange({ ...props.periodForm, end })}
            type="datetime-local"
          />
          <Button className="sm:col-span-2" isLoading={props.busy === 'period-new'}>
            <Plus className="h-4 w-4" /> Open period
          </Button>
        </form>
      </Card>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-xs text-brand-muted">
      {label}
      <input
        required
        className={`${compensationFieldClass} mt-1`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
    </label>
  );
}
