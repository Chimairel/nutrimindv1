import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  UserRound,
  Video,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { NutritionistApplicationForm } from '@/validation/nutritionist-application.schemas';

const steps = [
  { label: 'Identity', icon: UserRound },
  { label: 'Credentials', icon: BadgeCheck },
  { label: 'Experience', icon: FileCheck2 },
  { label: 'Call', icon: Video },
  { label: 'Review', icon: ClipboardCheck },
];

const stepTitles = [
  'Your identity',
  'Professional credentials',
  'Experience and background',
  'Verification call availability',
  'Review your application',
];

type Props = {
  error: string | null;
  errors: Record<string, string>;
  form: NutritionistApplicationForm;
  isLoading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onFieldChange: (field: keyof NutritionistApplicationForm, value: string | boolean) => void;
  onSubmit: () => void;
  step: number;
};

export function ApplicationWizard(props: Props) {
  const { error, errors, form, isLoading, onBack, onContinue, onFieldChange, onSubmit, step } = props;

  return (
    <div className="surface-panel rounded-[30px] p-6 sm:p-8">
      <div className="mb-8 grid grid-cols-5 gap-2">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const active = index <= step;
          return (
            <div key={item.label}>
              <div className={`h-1.5 rounded-full ${active ? 'bg-brand-accent' : 'bg-brand-border'}`} />
              <div
                className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${active ? 'text-brand-green' : 'text-brand-muted'}`}
              >
                <Icon className="hidden h-3 w-3 sm:block" />
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      <p className="portal-kicker !text-brand-green">Step {step + 1} of 5</p>
      <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">{stepTitles[step]}</h2>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          {error}
        </p>
      )}

      <div className="mt-7 space-y-5">
        {step === 0 && <IdentityFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 1 && <CredentialFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 2 && <ExperienceFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 3 && <AvailabilityFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 4 && <ApplicationReview form={form} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" disabled={step === 0 || isLoading} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={onContinue}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onSubmit} isLoading={isLoading}>
            <ClipboardCheck className="h-4 w-4" />
            Submit application
          </Button>
        )}
      </div>
    </div>
  );
}

type FieldProps = Pick<Props, 'errors' | 'form' | 'onFieldChange'>;

function IdentityFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <Input
        id="fullName"
        label="Full professional name"
        value={form.fullName}
        onChange={(event) => onFieldChange('fullName', event.target.value)}
        error={errors.fullName}
        autoComplete="name"
      />
      <Input
        id="applicationEmail"
        label="Professional email"
        type="email"
        value={form.email}
        onChange={(event) => onFieldChange('email', event.target.value)}
        error={errors.email}
        autoComplete="email"
      />
      <Input
        id="phoneNumber"
        label="Contact number"
        type="tel"
        value={form.phoneNumber}
        onChange={(event) => onFieldChange('phoneNumber', event.target.value)}
        error={errors.phoneNumber}
        placeholder="+63 9XX XXX XXXX"
        autoComplete="tel"
      />
    </>
  );
}

function CredentialFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <Input
        id="prcLicenseNumber"
        label="PRC license number"
        value={form.prcLicenseNumber}
        onChange={(event) => onFieldChange('prcLicenseNumber', event.target.value.toUpperCase())}
        error={errors.prcLicenseNumber}
      />
      <Input
        id="prcLicenseExpiry"
        label="License expiration date"
        type="date"
        value={form.prcLicenseExpiry}
        onChange={(event) => onFieldChange('prcLicenseExpiry', event.target.value)}
        error={errors.prcLicenseExpiry}
      />
      <Input
        id="specialization"
        label="Specialization"
        value={form.specialization}
        onChange={(event) => onFieldChange('specialization', event.target.value)}
        error={errors.specialization}
        placeholder="e.g. Clinical nutrition, diabetes care"
      />
    </>
  );
}

function ExperienceFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <Input
        id="yearsOfExperience"
        label="Years of professional experience"
        type="number"
        min="0"
        max="70"
        value={form.yearsOfExperience}
        onChange={(event) => onFieldChange('yearsOfExperience', event.target.value)}
        error={errors.yearsOfExperience}
      />
      <Input
        id="university"
        label="University or institution"
        value={form.university}
        onChange={(event) => onFieldChange('university', event.target.value)}
        error={errors.university}
      />
      <div>
        <label htmlFor="professionalBio" className="font-display text-xs font-bold text-brand-text/90">
          Professional background
        </label>
        <textarea
          id="professionalBio"
          rows={6}
          maxLength={2000}
          value={form.professionalBio}
          onChange={(event) => onFieldChange('professionalBio', event.target.value)}
          className={`mt-2 w-full rounded-2xl border bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:ring-4 ${errors.professionalBio ? 'border-status-error-text focus:ring-status-error-text/20' : 'border-brand-border focus:border-brand-green/55 focus:ring-brand-green/10'}`}
          placeholder="Tell the review team about your experience and areas of practice."
        />
        {errors.professionalBio && (
          <p className="mt-2 text-xs font-semibold text-status-error-text">{errors.professionalBio}</p>
        )}
        <p className="mt-1 text-right text-[10px] text-brand-muted">{form.professionalBio.length}/2000</p>
      </div>
    </>
  );
}

function AvailabilityFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <p className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4 text-sm leading-6 text-brand-muted">
        Provide at least two schedules when you can join a short online call. An administrator will select and confirm
        one.
      </p>
      {(['callSlotOne', 'callSlotTwo', 'callSlotThree'] as const).map((field, index) => (
        <Input
          key={field}
          id={field}
          label={['Preferred schedule', 'Alternative schedule', 'Third option (optional)'][index]}
          type="datetime-local"
          value={form[field]}
          onChange={(event) => onFieldChange(field, event.target.value)}
          error={errors[field]}
        />
      ))}
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${errors.consent ? 'border-status-error-text' : 'border-brand-border'}`}
      >
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(event) => onFieldChange('consent', event.target.checked)}
          className="mt-1 h-4 w-4 accent-brand-green"
        />
        <span className="text-xs leading-5 text-brand-muted">
          I confirm that the professional information provided is accurate and consent to credential verification and an
          online identity call.
        </span>
      </label>
      {errors.consent && <p className="text-xs font-semibold text-status-error-text">{errors.consent}</p>}
    </>
  );
}

function ApplicationReview({ form }: { form: NutritionistApplicationForm }) {
  const summary = [
    ['Applicant', form.fullName],
    ['Professional email', form.email],
    ['PRC license', form.prcLicenseNumber],
    ['License expires', form.prcLicenseExpiry],
    ['Specialization', form.specialization],
    ['Experience', `${form.yearsOfExperience} year(s)`],
    ['University', form.university],
  ];

  return (
    <div className="space-y-3">
      {summary.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-5 rounded-2xl bg-brand-bgAlt/60 px-4 py-3">
          <span className="text-xs text-brand-muted">{label}</span>
          <strong className="text-right text-xs text-brand-text">{value}</strong>
        </div>
      ))}
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4 text-xs leading-5 text-brand-muted">
        <ShieldCheck className="mb-2 h-4 w-4 text-brand-green" />
        Submitting creates an application only. It does not create a privileged account. An administrator must complete
        the review and verification call first.
      </div>
    </div>
  );
}
