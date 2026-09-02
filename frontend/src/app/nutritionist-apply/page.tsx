'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileCheck2,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/axios';
import {
  applicantAvailabilitySchema,
  applicantCredentialSchema,
  applicantIdentitySchema,
  applicantProfileSchema,
  issuesToFields,
  type NutritionistApplicationForm,
} from '@/validation/nutritionist-application.schemas';

type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'CALL_REQUIRED' | 'CALL_SCHEDULED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';
type PublicApplication = {
  referenceCode: string;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  scheduledCallAt?: string;
  meetingUrl?: string;
  decisionReason?: string;
  invitationSentAt?: string;
};

const steps = [
  { label: 'Identity', icon: UserRound },
  { label: 'Credentials', icon: BadgeCheck },
  { label: 'Experience', icon: FileCheck2 },
  { label: 'Call', icon: Video },
  { label: 'Review', icon: ClipboardCheck },
];

const initialForm: NutritionistApplicationForm = {
  fullName: '', email: '', phoneNumber: '', prcLicenseNumber: '', prcLicenseExpiry: '',
  specialization: '', yearsOfExperience: '', university: '', professionalBio: '',
  callSlotOne: '', callSlotTwo: '', callSlotThree: '', consent: false,
};

const statusOrder: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'CALL_REQUIRED', 'CALL_SCHEDULED', 'APPROVED', 'ACTIVATED'];
const statusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Application submitted',
  UNDER_REVIEW: 'Credential review',
  CALL_REQUIRED: 'Ready to schedule',
  CALL_SCHEDULED: 'Verification call scheduled',
  APPROVED: 'Approved — activation pending',
  REJECTED: 'Application not approved',
  ACTIVATED: 'Nutritionist account activated',
};

function StatusCard({ application }: { application: PublicApplication }) {
  const activeIndex = statusOrder.indexOf(application.status);
  return (
    <div className="surface-panel rounded-[30px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="portal-kicker !text-brand-green">Application status</p>
          <h2 className="mt-2 font-display text-2xl font-black text-brand-text">{statusLabels[application.status]}</h2>
          <p className="mt-2 text-sm text-brand-muted">{application.fullName} · {application.email}</p>
        </div>
        <span className="w-fit rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 font-mono text-[10px] font-bold text-brand-green">{application.referenceCode}</span>
      </div>

      {application.status === 'REJECTED' ? (
        <div className="mt-6 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm text-status-error-text">
          {application.decisionReason || 'The administrator recorded a final decision. Contact NutriMind if you need clarification.'}
        </div>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-6">
          {statusOrder.map((status, index) => {
            const reached = activeIndex >= index;
            return (
              <div key={status} className="relative">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${reached ? 'border-brand-accent bg-brand-accent text-[#07100d]' : 'border-brand-border bg-brand-bgAlt text-brand-muted'}`}>
                  {reached ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-brand-muted">{statusLabels[status]}</p>
              </div>
            );
          })}
        </div>
      )}

      {application.status === 'CALL_SCHEDULED' && application.scheduledCallAt && (
        <div className="mt-6 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-text"><CalendarClock className="h-4 w-4 text-brand-cyan" />{new Date(application.scheduledCallAt).toLocaleString()}</p>
          {application.meetingUrl && <a href={application.meetingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-brand-green hover:text-brand-cyan">Open meeting link</a>}
        </div>
      )}
      {application.status === 'APPROVED' && <p className="mt-6 text-sm leading-6 text-brand-muted">{application.invitationSentAt ? 'Check your email for the private activation link. It expires after 72 hours.' : 'Your application is approved, but invitation delivery is still pending. Contact NutriMind administration for a new invitation.'}</p>}
    </div>
  );
}

export default function NutritionistApplyPage() {
  const [mode, setMode] = useState<'apply' | 'track'>('apply');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [application, setApplication] = useState<PublicApplication | null>(null);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');

  useEffect(() => {
    if (window.location.hash === '#track') setMode('track');
  }, []);

  const setField = (field: keyof NutritionistApplicationForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const stepValidation = useMemo(() => [
    () => applicantIdentitySchema.safeParse(form),
    () => applicantCredentialSchema.safeParse(form),
    () => applicantProfileSchema.safeParse(form),
    () => applicantAvailabilitySchema.safeParse(form),
  ], [form]);

  const nextStep = () => {
    setError(null);
    if (step < 4) {
      const result = stepValidation[step]?.();
      if (result && !result.success) {
        setErrors(issuesToFields(result.error));
        setError('Please correct the highlighted fields before continuing.');
        return;
      }
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
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Application could not be submitted.' : 'Application could not be submitted.');
    } finally {
      setIsLoading(false);
    }
  };

  const lookupStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/nutritionist-applications/status', { referenceCode: trackingReference, email: trackingEmail });
      setApplication(response.data.data);
    } catch (caught) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Application was not found.' : 'Application was not found.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <PublicHeader />
      <main className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="futuristic-grid relative overflow-hidden rounded-[32px] bg-[#07100d] p-7 text-white lg:sticky lg:top-24 lg:h-fit lg:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]"><Stethoscope className="h-5 w-5" /></span>
            <p className="mt-7 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">Professional review team</p>
            <h1 className="mt-4 font-display text-4xl font-black leading-[1.02] tracking-[-0.045em]">Bring professional judgment into the loop.</h1>
            <p className="mt-5 text-sm leading-7 text-white/50">Registered nutritionist-dietitians from anywhere in the Philippines can apply online. Access is granted only after credential review and a one-on-one verification call.</p>
            <div className="mt-8 space-y-3">
              {['Online professional application', 'Manual PRC credential review', 'Required admin verification call', 'Private account invitation'].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/70"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 font-mono text-[10px] text-brand-accent">0{index + 1}</span>{item}</div>
              ))}
            </div>
            <p className="mt-7 text-[11px] leading-5 text-white/35">Submitting an application does not grant access or guarantee employment. NutriMind administrators review every applicant.</p>
          </aside>

          <section>
            <div className="mb-6 flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1">
              <button type="button" onClick={() => { setMode('apply'); setApplication(null); setError(null); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${mode === 'apply' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}>Apply online</button>
              <button type="button" onClick={() => { setMode('track'); setApplication(null); setError(null); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${mode === 'track' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}>Track application</button>
            </div>

            {application ? <StatusCard application={application} /> : mode === 'track' ? (
              <form onSubmit={lookupStatus} className="surface-panel rounded-[30px] p-6 sm:p-8">
                <p className="portal-kicker !text-brand-green">Private status lookup</p>
                <h2 className="mt-3 font-display text-3xl font-black">Track your application</h2>
                <p className="mt-3 text-sm leading-6 text-brand-muted">Use the reference code shown after submission together with the same email address you applied with.</p>
                {error && <p role="alert" className="mt-5 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">{error}</p>}
                <div className="mt-7 space-y-4">
                  <Input id="tracking-reference" label="Application reference" value={trackingReference} onChange={(event) => setTrackingReference(event.target.value.toUpperCase())} placeholder="NM-XXXXXXXXXXXX" required />
                  <Input id="tracking-email" label="Application email" type="email" value={trackingEmail} onChange={(event) => setTrackingEmail(event.target.value)} placeholder="professional@example.com" required />
                  <Button type="submit" size="lg" isLoading={isLoading} className="w-full"><Search className="h-4 w-4" />Check status</Button>
                </div>
              </form>
            ) : (
              <div className="surface-panel rounded-[30px] p-6 sm:p-8">
                <div className="mb-8 grid grid-cols-5 gap-2">
                  {steps.map((item, index) => { const Icon = item.icon; const active = index <= step; return <div key={item.label}><div className={`h-1.5 rounded-full ${active ? 'bg-brand-accent' : 'bg-brand-border'}`} /><div className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${active ? 'text-brand-green' : 'text-brand-muted'}`}><Icon className="hidden h-3 w-3 sm:block" />{item.label}</div></div>; })}
                </div>

                <p className="portal-kicker !text-brand-green">Step {step + 1} of 5</p>
                <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">{['Your identity', 'Professional credentials', 'Experience and background', 'Verification call availability', 'Review your application'][step]}</h2>
                {error && <p role="alert" className="mt-5 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">{error}</p>}

                <div className="mt-7 space-y-5">
                  {step === 0 && <><Input id="fullName" label="Full professional name" value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} error={errors.fullName} autoComplete="name" /><Input id="applicationEmail" label="Professional email" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} error={errors.email} autoComplete="email" /><Input id="phoneNumber" label="Contact number" type="tel" value={form.phoneNumber} onChange={(event) => setField('phoneNumber', event.target.value)} error={errors.phoneNumber} placeholder="+63 9XX XXX XXXX" autoComplete="tel" /></>}
                  {step === 1 && <><Input id="prcLicenseNumber" label="PRC license number" value={form.prcLicenseNumber} onChange={(event) => setField('prcLicenseNumber', event.target.value.toUpperCase())} error={errors.prcLicenseNumber} /><Input id="prcLicenseExpiry" label="License expiration date" type="date" value={form.prcLicenseExpiry} onChange={(event) => setField('prcLicenseExpiry', event.target.value)} error={errors.prcLicenseExpiry} /><Input id="specialization" label="Specialization" value={form.specialization} onChange={(event) => setField('specialization', event.target.value)} error={errors.specialization} placeholder="e.g. Clinical nutrition, diabetes care" /></>}
                  {step === 2 && <><Input id="yearsOfExperience" label="Years of professional experience" type="number" min="0" max="70" value={form.yearsOfExperience} onChange={(event) => setField('yearsOfExperience', event.target.value)} error={errors.yearsOfExperience} /><Input id="university" label="University or institution" value={form.university} onChange={(event) => setField('university', event.target.value)} error={errors.university} /><div><label htmlFor="professionalBio" className="font-display text-xs font-bold text-brand-text/90">Professional background</label><textarea id="professionalBio" rows={6} maxLength={2000} value={form.professionalBio} onChange={(event) => setField('professionalBio', event.target.value)} className={`mt-2 w-full rounded-2xl border bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:ring-4 ${errors.professionalBio ? 'border-status-error-text focus:ring-status-error-text/20' : 'border-brand-border focus:border-brand-green/55 focus:ring-brand-green/10'}`} placeholder="Tell the review team about your experience and areas of practice." />{errors.professionalBio && <p className="mt-2 text-xs font-semibold text-status-error-text">{errors.professionalBio}</p>}<p className="mt-1 text-right text-[10px] text-brand-muted">{form.professionalBio.length}/2000</p></div></>}
                  {step === 3 && <><p className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4 text-sm leading-6 text-brand-muted">Provide at least two schedules when you can join a short online call. An administrator will select and confirm one.</p><Input id="callSlotOne" label="Preferred schedule" type="datetime-local" value={form.callSlotOne} onChange={(event) => setField('callSlotOne', event.target.value)} error={errors.callSlotOne} /><Input id="callSlotTwo" label="Alternative schedule" type="datetime-local" value={form.callSlotTwo} onChange={(event) => setField('callSlotTwo', event.target.value)} error={errors.callSlotTwo} /><Input id="callSlotThree" label="Third option (optional)" type="datetime-local" value={form.callSlotThree} onChange={(event) => setField('callSlotThree', event.target.value)} error={errors.callSlotThree} /><label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${errors.consent ? 'border-status-error-text' : 'border-brand-border'}`}><input type="checkbox" checked={form.consent} onChange={(event) => setField('consent', event.target.checked)} className="mt-1 h-4 w-4 accent-brand-green" /><span className="text-xs leading-5 text-brand-muted">I confirm that the professional information provided is accurate and consent to credential verification and an online identity call.</span></label>{errors.consent && <p className="text-xs font-semibold text-status-error-text">{errors.consent}</p>}</>}
                  {step === 4 && <div className="space-y-3">{[['Applicant', form.fullName], ['Professional email', form.email], ['PRC license', form.prcLicenseNumber], ['License expires', form.prcLicenseExpiry], ['Specialization', form.specialization], ['Experience', `${form.yearsOfExperience} year(s)`], ['University', form.university]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-5 rounded-2xl bg-brand-bgAlt/60 px-4 py-3"><span className="text-xs text-brand-muted">{label}</span><strong className="text-right text-xs text-brand-text">{value}</strong></div>)}<div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4 text-xs leading-5 text-brand-muted"><ShieldCheck className="mb-2 h-4 w-4 text-brand-green" />Submitting creates an application only. It does not create a privileged account. An administrator must complete the review and verification call first.</div></div>}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button type="button" variant="secondary" disabled={step === 0 || isLoading} onClick={() => { setStep((current) => Math.max(0, current - 1)); setError(null); }}><ArrowLeft className="h-4 w-4" />Back</Button>
                  {step < 4 ? <Button type="button" onClick={nextStep}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Button type="button" onClick={submitApplication} isLoading={isLoading}><ClipboardCheck className="h-4 w-4" />Submit application</Button>}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <footer className="border-t border-brand-border px-5 py-8 text-center text-xs text-brand-muted">Need help? Contact the NutriMind administration team through your official application correspondence. · <Link href="/" className="font-bold text-brand-green">Return home</Link></footer>
    </div>
  );
}
