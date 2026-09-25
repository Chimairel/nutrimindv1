'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

type Requirement = {
  area: string;
  condition: string;
  state: 'READY' | 'CONTEXT_REQUIRED' | 'DOCUMENT_REVIEW_REQUIRED';
  required: boolean;
  message: string;
};
type Document = {
  id: string;
  area: string;
  documentType: string;
  status: string;
  originalFileName: string;
  issuedAt: string | null;
  validUntil: string | null;
  createdAt: string;
  latestReview: { rationale: string; decision: string } | null;
};
type Workspace = {
  consentVersion: string;
  requirements: Requirement[];
  availableAreas: string[];
  documents: Document[];
  contexts: Array<{ area: string; responses: { medicationRisk?: string; recurrentHypoglycemia?: boolean | 'UNSURE' } }>;
};

const documentTypes = [
  ['MEDICAL_ABSTRACT', 'Medical abstract or diagnosis summary'],
  ['LABORATORY_REPORT', 'Laboratory report'],
  ['MEDICATION_LIST', 'Prescription or medication list'],
  ['DIET_ORDER', 'Clinician diet order'],
  ['DISCHARGE_INSTRUCTIONS', 'Hospital discharge instructions'],
  ['ALLERGY_ACTION_PLAN', 'Allergy action plan'],
  ['PRENATAL_SUMMARY', 'Prenatal summary'],
  ['OTHER', 'Other relevant clinical record'],
] as const;

function friendly(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

export default function ClinicalEvidenceWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [area, setArea] = useState('');
  const [documentType, setDocumentType] = useState<string>(documentTypes[0][0]);
  const [file, setFile] = useState<File | null>(null);
  const [issuedAt, setIssuedAt] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [supersedesDocumentId, setSupersedesDocumentId] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [medicationRisk, setMedicationRisk] = useState('UNSURE');
  const [recurrentHypoglycemia, setRecurrentHypoglycemia] = useState<'YES' | 'NO' | 'UNSURE'>('UNSURE');

  const load = useCallback(async () => {
    try {
      const response = await api.get('/user/clinical-evidence');
      const next = response.data.data as Workspace;
      setWorkspace(next);
      const available = next.availableAreas;
      if (!area && available.length) setArea(available[0]);
      const diabetes = next.contexts.find((item) => item.area === 'DIABETES')?.responses;
      if (diabetes?.medicationRisk) setMedicationRisk(diabetes.medicationRisk);
      if (diabetes?.recurrentHypoglycemia !== undefined)
        setRecurrentHypoglycemia(diabetes.recurrentHypoglycemia === 'UNSURE' ? 'UNSURE' : diabetes.recurrentHypoglycemia ? 'YES' : 'NO');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Clinical information could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitContext = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put('/user/clinical-evidence/diabetes-context', {
        medicationRisk,
        recurrentHypoglycemia: recurrentHypoglycemia === 'UNSURE' ? 'UNSURE' : recurrentHypoglycemia === 'YES',
      });
      setMessage('Diabetes context saved. Current meals will be checked again before use.');
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Diabetes context could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const submitDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !area || !consentAccepted) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('area', area);
      form.append('documentType', documentType);
      form.append('issuedAt', issuedAt);
      form.append('issuerName', issuerName);
      form.append('supersedesDocumentId', supersedesDocumentId);
      form.append('facts', '[]');
      form.append('consentAccepted', 'true');
      await api.post('/user/clinical-evidence/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage('Document uploaded privately. An RND will review whether it provides enough nutrition context.');
      setFile(null);
      setIssuedAt('');
      setIssuerName('');
      setSupersedesDocumentId('');
      setConsentAccepted(false);
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Document could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (item: Document) => {
    setError(null);
    try {
      const response = await api.get(`/user/clinical-evidence/documents/${item.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.originalFileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Document could not be downloaded.'));
    }
  };

  const withdraw = async (document: Document) => {
    if (!window.confirm('Withdraw this document? Plans and clearances that relied on it will need revalidation.')) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/user/clinical-evidence/documents/${document.id}`);
      setMessage('Document withdrawn. Affected meals were flagged for revalidation.');
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Document could not be withdrawn.'));
    } finally {
      setBusy(false);
    }
  };

  const areas = workspace?.availableAreas ?? [];
  return (
    <div className="portal-page max-w-4xl space-y-6">
      <Link href="/profile/health" className="text-sm font-semibold text-brand-green">← Health & goals</Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Private health context</p>
        <h1 className="mt-2 font-display text-3xl font-black">Clinical documents</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Share only the pages relevant to your nutrition plan. An RND checks whether they provide enough context;
          KAINARA does not diagnose conditions or authenticate medical records.
        </p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green">{message}</p>}
      {loading ? <p className="text-sm text-brand-muted">Loading clinical information…</p> : (
        <>
          <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h2 className="font-bold">What your plan needs</h2>
            <div className="mt-3 space-y-2">
              {workspace?.requirements.length ? workspace.requirements.map((item) => (
                <div key={item.area} className="rounded-xl border border-brand-border p-3 text-sm">
                  <p className="font-semibold">{friendly(item.condition)} · {item.state === 'READY' ? 'Ready' : item.state === 'CONTEXT_REQUIRED' ? 'Information needed' : 'RND document review needed'}</p>
                  <p className="mt-1 text-brand-muted">{item.message}</p>
                </div>
              )) : <p className="text-sm text-brand-muted">No condition requires a clinical document. Allergy restrictions still apply from your profile.</p>}
            </div>
          </section>

          {workspace?.requirements.some((item) => item.area === 'DIABETES') && (
            <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
              <h2 className="font-bold">Diabetes context</h2>
              <p className="mt-1 text-sm text-brand-muted">These answers help determine whether medication or low blood sugar makes supporting records necessary.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Medication type
                  <select value={medicationRisk} onChange={(event) => setMedicationRisk(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3">
                    <option value="UNSURE">I am unsure</option><option value="NONE">No diabetes medication</option><option value="INSULIN">Insulin</option><option value="SULFONYLUREA_OR_MEGLITINIDE">Sulfonylurea or meglitinide</option><option value="OTHER">Another medication</option>
                  </select>
                </label>
                <label className="text-sm">Repeated low blood sugar episodes
                  <select value={recurrentHypoglycemia} onChange={(event) => setRecurrentHypoglycemia(event.target.value as 'YES' | 'NO' | 'UNSURE')} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3">
                    <option value="UNSURE">I am unsure</option><option value="YES">Yes</option><option value="NO">No</option>
                  </select>
                </label>
              </div>
              <button type="button" disabled={busy} onClick={() => void submitContext()} className="mt-4 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-[#07100d] disabled:opacity-60">Save context</button>
            </section>
          )}

          <form onSubmit={submitDocument} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h2 className="font-bold">Upload a supporting document</h2>
            <p className="mt-1 text-sm text-brand-muted">PDF, JPG, or PNG up to 8 MB. Cover unrelated identifiers before uploading. Do not include records about another person.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Related condition
                <select required value={area} onChange={(event) => setArea(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3">
                  {!area && <option value="">Select a condition</option>}
                  {areas.map((item) => <option key={item} value={item}>{friendly(item)}</option>)}
                </select>
              </label>
              <label className="text-sm">Document type
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3">
                  {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm">Document date, if shown
                <input type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3" />
              </label>
              <label className="text-sm">Issuer or clinic, if shown
                <input maxLength={180} value={issuerName} onChange={(event) => setIssuerName(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3" />
              </label>
              <label className="text-sm sm:col-span-2">Replace an earlier document, if applicable
                <select value={supersedesDocumentId} onChange={(event) => setSupersedesDocumentId(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3">
                  <option value="">New document</option>
                  {workspace?.documents.filter((item) => item.area === area && !['WITHDRAWN', 'SUPERSEDED'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.originalFileName} · {friendly(item.status)}</option>)}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">Choose file
                <input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-xl border border-brand-border bg-brand-bg p-3" />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-brand-muted">
              <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-1" />
              <span>I consent to KAINARA storing this sensitive document privately for nutrition review and allowing an assigned RND to view it. I can withdraw it later. Consent version: {workspace?.consentVersion}.</span>
            </label>
            <button type="submit" disabled={busy || !file || !consentAccepted} className="mt-4 rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-[#07100d] disabled:opacity-60">{busy ? 'Saving…' : 'Upload privately'}</button>
          </form>

          <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h2 className="font-bold">Your documents</h2>
            {workspace?.documents.length ? <div className="mt-3 space-y-3">{workspace.documents.map((item) => (
              <div key={item.id} className="rounded-xl border border-brand-border p-3 text-sm">
                <p className="break-all font-semibold">{item.originalFileName}</p>
                <p className="mt-1 text-brand-muted">{friendly(item.area)} · {friendly(item.status)} · uploaded {new Date(item.createdAt).toLocaleDateString()}</p>
                {item.validUntil && <p className="mt-1 text-brand-muted">RND review valid until {new Date(item.validUntil).toLocaleDateString()}</p>}
                {item.latestReview && <p className="mt-2 text-brand-muted">RND note: {item.latestReview.rationale}</p>}
                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={() => void download(item)} className="font-semibold text-brand-green underline">Download</button>
                  {!['WITHDRAWN', 'SUPERSEDED'].includes(item.status) && <button type="button" disabled={busy} onClick={() => void withdraw(item)} className="font-semibold text-red-400 underline">Withdraw</button>}
                </div>
              </div>
            ))}</div> : <p className="mt-2 text-sm text-brand-muted">No documents uploaded yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
