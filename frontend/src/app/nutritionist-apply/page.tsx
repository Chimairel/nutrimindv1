'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-error';
import PublicHeader from '@/components/shared/PublicHeader';
import api from '@/lib/axios';
import { ApplicationSidebar } from '@/features/nutritionist-application/ApplicationSidebar';
import { ApplicationStatusCard } from '@/features/nutritionist-application/ApplicationStatusCard';
import { ApplicationTrackingForm } from '@/features/nutritionist-application/ApplicationTrackingForm';
import { ApplicationWizard } from '@/features/nutritionist-application/ApplicationWizard';
import { initialApplicationForm, type PublicApplication } from '@/features/nutritionist-application/model';
import {
  applicantAvailabilitySchema,
  applicantCredentialSchema,
  applicantIdentitySchema,
  applicantProfileSchema,
  issuesToFields,
  type NutritionistApplicationForm,
} from '@/validation/nutritionist-application.schemas';

export default function NutritionistApplyPage() {
  const [mode, setMode] = useState<'apply' | 'track'>('apply');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialApplicationForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [application, setApplication] = useState<PublicApplication | null>(null);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');

  useEffect(() => {
    if (window.location.hash === '#track') setMode('track');
  }, []);

  const stepValidation = useMemo(
    () => [
      () => applicantIdentitySchema.safeParse(form),
      () => applicantCredentialSchema.safeParse(form),
      () => applicantProfileSchema.safeParse(form),
      () => applicantAvailabilitySchema.safeParse(form),
    ],
    [form]
  );

  const setField = (field: keyof NutritionistApplicationForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const nextStep = () => {
    setError(null);
    const result = step < 4 ? stepValidation[step]?.() : undefined;
    if (result && !result.success) {
      setErrors(issuesToFields(result.error));
      setError('Please correct the highlighted fields before continuing.');
      return;
    }
    setErrors({});
    setStep((current) => Math.min(4, current + 1));
  };

  const submitApplication = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const availableCallSlots = [form.callSlotOne, form.callSlotTwo, form.callSlotThree]
        .filter(Boolean)
        .map((value) => new Date(value).toISOString());
      const response = await api.post('/nutritionist-applications', {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        prcLicenseNumber: form.prcLicenseNumber.trim(),
        prcLicenseExpiry: new Date(`${form.prcLicenseExpiry}T23:59:59`).toISOString(),
        specialization: form.specialization.trim(),
        yearsOfExperience: Number(form.yearsOfExperience),
        university: form.university.trim(),
        professionalBio: form.professionalBio.trim(),
        availableCallSlots,
        consent: true,
      });
      setApplication(response.data.data);
      setTrackingReference(response.data.data.referenceCode);
      setTrackingEmail(response.data.data.email);
    } catch (caught) {
      setError(getApplicationError(caught, 'Application could not be submitted.'));
    } finally {
      setIsLoading(false);
    }
  };

  const lookupStatus = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/nutritionist-applications/status', {
        referenceCode: trackingReference,
        email: trackingEmail,
      });
      setApplication(response.data.data);
    } catch (caught) {
      setError(getApplicationError(caught, 'Application was not found.'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (nextMode: 'apply' | 'track') => {
    setMode(nextMode);
    setApplication(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <PublicHeader />
      <main className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <ApplicationSidebar />
          <section>
            <ModeSelector mode={mode} onChange={switchMode} />
            {application ? (
              <ApplicationStatusCard application={application} />
            ) : mode === 'track' ? (
              <ApplicationTrackingForm
                email={trackingEmail}
                error={error}
                isLoading={isLoading}
                onEmailChange={setTrackingEmail}
                onReferenceChange={setTrackingReference}
                onSubmit={lookupStatus}
                referenceCode={trackingReference}
              />
            ) : (
              <ApplicationWizard
                error={error}
                errors={errors}
                form={form}
                isLoading={isLoading}
                onBack={() => {
                  setStep((current) => Math.max(0, current - 1));
                  setError(null);
                }}
                onContinue={nextStep}
                onFieldChange={setField}
                onSubmit={submitApplication}
                step={step}
              />
            )}
          </section>
        </div>
      </main>
      <footer className="border-t border-brand-border px-5 py-8 text-center text-xs text-brand-muted">
        Need help? Contact the NutriMind administration team through your official application correspondence. ·{' '}
        <Link href="/" className="font-bold text-brand-green">
          Return home
        </Link>
      </footer>
    </div>
  );
}

function ModeSelector({ mode, onChange }: { mode: 'apply' | 'track'; onChange: (mode: 'apply' | 'track') => void }) {
  return (
    <div className="mb-6 flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1">
      {(['apply', 'track'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${mode === option ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}
        >
          {option === 'apply' ? 'Apply online' : 'Track application'}
        </button>
      ))}
    </div>
  );
}

function getApplicationError(caught: unknown, fallback: string) {
  return getApiErrorMessage(caught, fallback);
}
