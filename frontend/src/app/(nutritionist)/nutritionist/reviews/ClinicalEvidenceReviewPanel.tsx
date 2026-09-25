'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { ReviewTabs, type ReviewWorkspaceTab } from './GovernanceQueuePanel';

type QueueItem = {
  id: string; area: string; documentType: string; status: string; originalFileName: string;
  createdAt: string; factCount: number; user: { name: string; conditions: string[] };
  claimStatus: { active: boolean; claimedByName: string | null };
};
type Fact = { id: string; code: string; valueText: string | null; valueNumber: number | null; unit: string | null; reviewStatus: string };
type Detail = QueueItem & { facts: Fact[]; user: QueueItem['user'] & { allergies: string[]; contexts: Array<{ area: string; responses: Record<string, unknown> }> } };
const factCodes: Record<string, string[]> = {
  KIDNEY_DISEASE: ['CKD_STAGE', 'EGFR'],
  HEART_CONDITION: ['HEART_DIAGNOSIS'],
  DIABETES: ['DIABETES_MEDICATION'],
};

export default function ClinicalEvidenceReviewPanel({ onTabChange }: { onTabChange: (tab: ReviewWorkspaceTab) => void }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<'SUFFICIENT' | 'NEEDS_CLARIFICATION' | 'UNUSABLE'>('NEEDS_CLARIFICATION');
  const [rationale, setRationale] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [confirmedFactIds, setConfirmedFactIds] = useState<string[]>([]);
  const [factCode, setFactCode] = useState('');
  const [factValue, setFactValue] = useState('');
  const [confirmedFacts, setConfirmedFacts] = useState<Array<{ code: string; valueText: string }>>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/clinical-evidence');
      setQueue(response.data.data);
    } catch (cause) { setError(getApiErrorMessage(cause, 'The clinical queue could not be loaded.')); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const claim = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${id}`);
      setDetail(response.data.data);
      setConfirmedFactIds([]); setConfirmedFacts([]); setRationale(''); setValidUntil('');
      setFactCode(factCodes[response.data.data.area]?.[0] ?? 'OTHER');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not claim this document.')); }
    finally { setBusy(false); }
  };

  const download = async () => {
    if (!detail) return;
    setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${detail.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = detail.originalFileName; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not open the claimed document.')); }
  };

  const submit = async () => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/nutritionist/clinical-evidence/${detail.id}`, {
        decision, rationale, validUntil: decision === 'SUFFICIENT' ? validUntil : null,
        confirmedFactIds, unclearFactIds: [], confirmedFacts,
      });
      setDetail(null);
      await refresh();
    } catch (cause) { setError(getApiErrorMessage(cause, 'The clinical review could not be saved.')); }
    finally { setBusy(false); }
  };

  return <div className="m-3 h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-5 text-brand-text">
    <ReviewTabs value="clinical" onChange={onTabChange} />
    <div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="font-display text-xl font-bold">Clinical document review</h1><p className="text-sm text-brand-muted">Check the original record and confirm only facts relevant to nutrition planning. Sufficiency is not diagnosis or document authentication.</p></div><button type="button" onClick={() => void refresh()} className="rounded-xl border border-brand-border px-3 py-2 text-sm">Refresh</button></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-400">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,360px)_1fr]">
      <div className="space-y-2">{queue.length ? queue.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => void claim(item.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${detail?.id === item.id ? 'border-brand-green' : 'border-brand-border'}`}><strong>{item.user.name}</strong><p>{item.area.replace(/_/g, ' ')} · {item.documentType.replace(/_/g, ' ')}</p><p className="break-all text-brand-muted">{item.originalFileName}</p><p className="mt-1 text-xs text-brand-muted">{item.status.replace(/_/g, ' ')} · {new Date(item.createdAt).toLocaleDateString()}{item.claimStatus.active ? ` · claimed by ${item.claimStatus.claimedByName}` : ''}</p></button>) : <p className="text-sm text-brand-muted">No documents are waiting for review.</p>}</div>
      {detail ? <div className="space-y-4 rounded-xl border border-brand-border p-4">
        <div><h2 className="font-bold">{detail.user.name} · {detail.area.replace(/_/g, ' ')}</h2><p className="text-sm text-brand-muted">Declared conditions: {detail.user.conditions.join(', ') || 'none'} · Allergies: {detail.user.allergies.join(', ') || 'none'}</p>{detail.user.contexts.filter((item) => item.area === detail.area).map((item) => <p key={item.area} className="mt-1 text-sm text-brand-muted">Self-reported context: {Object.entries(item.responses).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join('; ')}</p>)}<button type="button" onClick={() => void download()} className="mt-2 text-sm font-semibold text-brand-green underline">Download original record</button></div>
        <div><h3 className="text-sm font-bold">Extracted facts</h3>{detail.facts.length ? detail.facts.map((fact) => <label key={fact.id} className="mt-2 flex gap-2 rounded-lg border border-brand-border p-2 text-sm"><input type="checkbox" checked={confirmedFactIds.includes(fact.id)} onChange={(event) => setConfirmedFactIds((ids) => event.target.checked ? [...ids, fact.id] : ids.filter((id) => id !== fact.id))} /><span>{fact.code}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''} <small className="text-brand-muted">({fact.reviewStatus})</small></span></label>) : <p className="text-sm text-brand-muted">No facts were transcribed. Add the relevant fact from the document below.</p>}</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><select value={factCode} onChange={(event) => setFactCode(event.target.value)} className="rounded-lg border border-brand-border bg-brand-bg p-2 text-sm">{(factCodes[detail.area] ?? ['OTHER']).map((code) => <option key={code} value={code}>{code.replace(/_/g, ' ')}</option>)}</select><input value={factValue} onChange={(event) => setFactValue(event.target.value)} placeholder="Exact value shown in record" className="rounded-lg border border-brand-border bg-brand-bg p-2 text-sm" /><button type="button" disabled={!factValue.trim()} onClick={() => { setConfirmedFacts((items) => [...items, { code: factCode, valueText: factValue.trim() }]); setFactValue(''); }} className="rounded-lg border border-brand-border px-3 text-sm">Add fact</button></div>
        {confirmedFacts.length > 0 && <p className="text-xs text-brand-muted">Confirmed from record: {confirmedFacts.map((fact) => `${fact.code}: ${fact.valueText}`).join('; ')}</p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Decision<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg p-2"><option value="NEEDS_CLARIFICATION">Needs clarification</option><option value="SUFFICIENT">Sufficient for nutrition review</option><option value="UNUSABLE">Unusable</option></select></label>{decision === 'SUFFICIENT' && <label className="text-sm">Review valid until<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg p-2" /></label>}</div>
        <label className="block text-sm">Review rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg p-2" /></label>
        <button type="button" disabled={busy || rationale.trim().length < 3 || (decision === 'SUFFICIENT' && !validUntil)} onClick={() => void submit()} className="rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-[#07100d] disabled:opacity-50">Record review</button>
      </div> : <p className="text-sm text-brand-muted">Select a document to claim its review.</p>}
    </div>
  </div>;
}
