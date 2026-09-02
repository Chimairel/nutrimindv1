'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BadgeCheck, CalendarClock, CheckCircle2, GraduationCap, Mail, Phone, RotateCw, ShieldCheck, Stethoscope, UserCheck, Video, XCircle } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'CALL_REQUIRED' | 'CALL_SCHEDULED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';
interface NutritionistApplication {
  id: string; referenceCode: string; status: ApplicationStatus; fullName: string; email: string; phoneNumber: string;
  prcLicenseNumber: string; prcLicenseExpiry: string; specialization: string; yearsOfExperience: number;
  university: string; professionalBio: string; availableCallSlots: string[]; scheduledCallAt?: string;
  meetingUrl?: string; decisionReason?: string; invitationSentAt?: string; activatedAt?: string; createdAt: string;
}
interface NutritionistRow {
  id: string; prcLicenseNumber: string; prcLicenseExpiry: string; specialization?: string;
  isVerified: boolean; totalVerified: number; verifiedAt?: string; user: { id: string; name: string; email: string };
}
type ScheduleDraft = { scheduledCallAt: string; meetingUrl: string };
type ApplicationActionResponse = { data?: { data?: { invitationEmailSent?: boolean } } };

const statusLabel: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', CALL_REQUIRED: 'Call required', CALL_SCHEDULED: 'Call scheduled',
  APPROVED: 'Approved', REJECTED: 'Rejected', ACTIVATED: 'Activated',
};
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function AdminNutritionistsPage() {
  const [applications, setApplications] = useState<NutritionistApplication[]>([]);
  const [nutritionists, setNutritionists] = useState<NutritionistRow[]>([]);
  const [tab, setTab] = useState<'applications' | 'professionals'>('applications');
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [applicationResponse, nutritionistResponse] = await Promise.all([
        api.get('/admin/nutritionist-applications'), api.get('/admin/nutritionists'),
      ]);
      setApplications(applicationResponse.data?.data || []);
      setNutritionists(nutritionistResponse.data?.data || []);
    } catch (caught) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Professional records could not be loaded.' : 'Professional records could not be loaded.');
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const act = async (id: string, request: () => Promise<ApplicationActionResponse>, successMessage: string | ((result: ApplicationActionResponse) => string)) => {
    setWorkingId(id); setError(null); setNotice(null);
    try { const result = await request(); setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage); await fetchData(); }
    catch (caught) { setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'The application could not be updated.' : 'The application could not be updated.'); }
    finally { setWorkingId(null); }
  };

  const activeApplications = useMemo(() => applications.filter((item) => !['REJECTED', 'ACTIVATED'].includes(item.status)), [applications]);
  const completedApplications = useMemo(() => applications.filter((item) => ['REJECTED', 'ACTIVATED'].includes(item.status)), [applications]);
  const verified = nutritionists.filter((item) => item.isVerified);
  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><span className="animate-pulse text-brand-muted">Loading professional governance records...</span></div>;

  const renderApplication = (application: NutritionistApplication) => {
    const draft = scheduleDrafts[application.id] || { scheduledCallAt: toLocalInput(application.availableCallSlots?.[0]), meetingUrl: '' };
    const callOccurred = Boolean(application.scheduledCallAt && new Date(application.scheduledCallAt).getTime() <= Date.now());
    return (
      <Card key={application.id} className="overflow-hidden p-0">
        <div className="border-b border-brand-border/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green"><Stethoscope className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate font-display text-base font-black text-brand-text">{application.fullName}</h3><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-brand-muted">{application.referenceCode} · Applied {new Date(application.createdAt).toLocaleDateString()}</p></div></div>
            <span className="w-fit rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-green">{statusLabel[application.status]}</span>
          </div>
          <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
            <p className="flex items-center gap-2 rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted"><Mail className="h-3.5 w-3.5" />{application.email}</p>
            <p className="flex items-center gap-2 rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted"><Phone className="h-3.5 w-3.5" />{application.phoneNumber}</p>
            <p className="rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">PRC <strong className="ml-1 text-brand-text">{application.prcLicenseNumber}</strong></p>
            <p className="rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">Expires <strong className="ml-1 text-brand-text">{new Date(application.prcLicenseExpiry).toLocaleDateString()}</strong></p>
          </div>
          <div className="mt-4 space-y-2 text-xs leading-5 text-brand-muted"><p className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5" />{application.university}</p><p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" />{application.specialization} · {application.yearsOfExperience} year(s)</p><p className="rounded-xl border border-brand-border/60 p-3">{application.professionalBio}</p></div>
        </div>
        <div className="bg-brand-bgAlt/35 p-5 sm:p-6">
          {application.status === 'SUBMITTED' && <Button onClick={() => void act(application.id, () => api.patch(`/admin/nutritionist-applications/${application.id}/stage`, { status: 'UNDER_REVIEW' }), 'Credential review started.')} isLoading={workingId === application.id}><UserCheck className="h-4 w-4" />Begin credential review</Button>}
          {application.status === 'UNDER_REVIEW' && <Button onClick={() => void act(application.id, () => api.patch(`/admin/nutritionist-applications/${application.id}/stage`, { status: 'CALL_REQUIRED' }), 'Applicant advanced to the required call stage.')} isLoading={workingId === application.id}><Video className="h-4 w-4" />Credentials checked — require call</Button>}
          {application.status === 'CALL_REQUIRED' && <div className="space-y-4">
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-muted">Applicant availability</p><div className="flex flex-wrap gap-2">{application.availableCallSlots.map((slot) => <button key={slot} type="button" onClick={() => setScheduleDrafts((current) => ({ ...current, [application.id]: { ...draft, scheduledCallAt: toLocalInput(slot) } }))} className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-[10px] font-semibold text-brand-muted hover:border-brand-green/40">{new Date(slot).toLocaleString()}</button>)}</div></div>
            <div className="grid gap-3 sm:grid-cols-2"><Input id={`call-${application.id}`} type="datetime-local" label="Confirmed call schedule" value={draft.scheduledCallAt} onChange={(event) => setScheduleDrafts((current) => ({ ...current, [application.id]: { ...draft, scheduledCallAt: event.target.value } }))} /><Input id={`meeting-${application.id}`} type="url" label="Google Meet or Zoom link" value={draft.meetingUrl} onChange={(event) => setScheduleDrafts((current) => ({ ...current, [application.id]: { ...draft, meetingUrl: event.target.value } }))} placeholder="https://meet.google.com/..." /></div>
            <Button onClick={() => void act(application.id, () => api.patch(`/admin/nutritionist-applications/${application.id}/schedule`, { scheduledCallAt: new Date(draft.scheduledCallAt).toISOString(), meetingUrl: draft.meetingUrl }), 'Verification call scheduled.')} disabled={!draft.scheduledCallAt || !draft.meetingUrl} isLoading={workingId === application.id}><CalendarClock className="h-4 w-4" />Confirm call</Button>
          </div>}
          {application.status === 'CALL_SCHEDULED' && <div><div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4"><p className="flex items-center gap-2 text-sm font-bold text-brand-text"><CalendarClock className="h-4 w-4 text-brand-cyan" />{new Date(application.scheduledCallAt!).toLocaleString()}</p>{application.meetingUrl && <a href={application.meetingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-brand-green">Open meeting room</a>}</div><div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => void act(application.id, () => api.patch(`/admin/nutritionist-applications/${application.id}/decision`, { decision: 'approve' }), (result) => result.data?.data?.invitationEmailSent ? 'Application approved and invitation email sent.' : 'Application approved, but invitation delivery failed. Use resend after checking SMTP.')} disabled={!callOccurred} isLoading={workingId === application.id}><CheckCircle2 className="h-4 w-4" />Approve after call</Button>{!callOccurred && <p className="self-center text-[10px] text-brand-muted">Approval unlocks after the scheduled call time.</p>}</div></div>}
          {application.status === 'APPROVED' && <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-brand-muted">{application.invitationSentAt ? `Invitation sent ${new Date(application.invitationSentAt).toLocaleString()}` : 'Invitation delivery needs attention.'}</span><Button variant="secondary" onClick={() => void act(application.id, () => api.post(`/admin/nutritionist-applications/${application.id}/resend-invitation`), (result) => result.data?.data?.invitationEmailSent ? 'A new invitation email was sent.' : 'A new invitation was created, but email delivery failed.')} isLoading={workingId === application.id}><RotateCw className="h-4 w-4" />Resend invitation</Button></div>}
          {!['APPROVED', 'REJECTED', 'ACTIVATED'].includes(application.status) && <div className="mt-5 flex flex-col gap-3 border-t border-brand-border/60 pt-5 sm:flex-row"><Input id={`reject-${application.id}`} label="Rejection reason" value={rejectionReasons[application.id] || ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Required before rejecting" /><Button variant="danger" className="self-end" disabled={!rejectionReasons[application.id]?.trim()} onClick={() => void act(application.id, () => api.patch(`/admin/nutritionist-applications/${application.id}/decision`, { decision: 'reject', reason: rejectionReasons[application.id] }), 'Application rejected.')} isLoading={workingId === application.id}><XCircle className="h-4 w-4" />Reject</Button></div>}
          {application.status === 'REJECTED' && <p className="text-xs text-status-error-text">Reason: {application.decisionReason}</p>}
          {application.status === 'ACTIVATED' && <p className="flex items-center gap-2 text-sm font-bold text-brand-green"><BadgeCheck className="h-4 w-4" />Professional account activated</p>}
        </div>
      </Card>
    );
  };

  return <div className="portal-page space-y-7">
    <PortalPageHeader icon={Stethoscope} eyebrow="Professional governance" title="Nutritionist onboarding" description="Review applications, conduct required verification calls, and control professional access." meta={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/50">{activeApplications.length} active · {verified.length} professionals</span>} />
    {error && <div role="alert" className="rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">{error}</div>}
    {notice && <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.07] p-4 text-sm font-semibold text-brand-green">{notice}</div>}
    <div className="flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1"><button type="button" onClick={() => setTab('applications')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold ${tab === 'applications' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}>Applications ({applications.length})</button><button type="button" onClick={() => setTab('professionals')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold ${tab === 'professionals' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}>Active professionals ({verified.length})</button></div>
    {tab === 'applications' ? <><section><p className="portal-section-label mb-4">Active pipeline · {activeApplications.length}</p>{activeApplications.length ? <div className="grid gap-5 xl:grid-cols-2">{activeApplications.map(renderApplication)}</div> : <Card className="p-10 text-center text-sm text-brand-muted">No active applications.</Card>}</section>{completedApplications.length > 0 && <section><p className="portal-section-label mb-4">Completed applications · {completedApplications.length}</p><div className="grid gap-5 xl:grid-cols-2">{completedApplications.map(renderApplication)}</div></section>}</> : <section>{verified.length ? <div className="grid gap-4 lg:grid-cols-2">{verified.map((nutritionist) => <Card key={nutritionist.id} className="p-5"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green"><BadgeCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-brand-text">{nutritionist.user.name}</h3><p className="truncate text-xs text-brand-muted">{nutritionist.user.email}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted">PRC {nutritionist.prcLicenseNumber}</p></div><div className="text-right"><p className="font-display text-xl font-black text-brand-green">{nutritionist.totalVerified}</p><p className="text-[9px] uppercase tracking-wider text-brand-muted">meals verified</p></div></div></Card>)}</div> : <Card className="p-10 text-center text-sm text-brand-muted">No activated nutritionists yet.</Card>}</section>}
  </div>;
}
