'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorUser: { name: string; role: string } | null;
}

interface SafetyIncident {
  id: string;
  reason: string;
  createdAt: string;
  mealLibrary: { mealName: string; status: string; safetyEvidenceStatus: string };
  flaggedByNutritionist: { user: { name: string } };
}

export default function AdminOperationsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [auditResponse, incidentResponse] = await Promise.all([
        api.get('/admin/audit-events?limit=30'),
        api.get('/admin/safety-incidents'),
      ]);
      setEvents(auditResponse.data?.data?.events || []);
      setIncidents(incidentResponse.data?.data || []);
    } catch {
      setError('Could not load operational records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={ShieldCheck}
        eyebrow="Governance"
        title="Safety and audit operations"
        description="Review pending safety flags and a privacy-conscious record of consequential account and meal-review actions."
        meta={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-xs font-bold text-brand-green focus-visible:ring-2 focus-visible:ring-brand-cyan"><RefreshCw className="h-4 w-4" />Refresh</button>}
      />

      {error && <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

      <section>
        <p className="portal-section-label mb-4">Pending safety incidents</p>
        <div className="space-y-3">
          {!loading && incidents.length === 0 && <Card className="p-6 text-sm text-brand-muted">No pending meal-library safety flags.</Card>}
          {incidents.map((incident) => (
            <Card key={incident.id} className="p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"><AlertTriangle className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="font-bold text-brand-text">{incident.mealLibrary.mealName}</p><p className="mt-1 text-sm text-brand-muted">{incident.reason}</p><p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-brand-muted">Flagged by {incident.flaggedByNutritionist.user.name} · {new Date(incident.createdAt).toLocaleString()}</p></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <p className="portal-section-label mb-4">Recent audit events</p>
        <Card className="overflow-hidden">
          <div className="divide-y divide-brand-border/60">
            {!loading && events.length === 0 && <p className="p-6 text-sm text-brand-muted">No audit events recorded yet.</p>}
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><ScrollText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-brand-text">{event.action.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-brand-muted">{event.actorUser ? `${event.actorUser.name} (${event.actorUser.role})` : 'System'} · {event.entityType}</p></div>
                <time className="shrink-0 text-right font-mono text-[10px] text-brand-muted" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
