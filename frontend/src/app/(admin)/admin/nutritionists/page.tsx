'use client';

import React, { useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, Clock3, GraduationCap, ShieldCheck, Stethoscope } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

interface NutritionistRow {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  isVerified: boolean;
  totalVerified: number;
  verifiedAt?: string;
  user: { id: string; name: string; email: string };
}

export default function AdminNutritionistsPage() {
  const [nutritionists, setNutritionists] = useState<NutritionistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    const fetchNutritionists = async () => {
      try {
        const response = await api.get('/admin/nutritionists');
        if (response.data?.success) setNutritionists(response.data.data);
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNutritionists();
  }, []);

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await api.patch(`/admin/nutritionists/${id}/verify`);
      setNutritionists((current) => current.map((nutritionist) => nutritionist.id === id ? { ...nutritionist, isVerified: true, verifiedAt: new Date().toISOString() } : nutritionist));
    } catch (error) {
      console.error('Verify failed:', error);
    } finally {
      setVerifying(null);
    }
  };

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><span className="animate-pulse text-brand-muted">Loading professional records...</span></div>;

  const pending = nutritionists.filter((nutritionist) => !nutritionist.isVerified);
  const verified = nutritionists.filter((nutritionist) => nutritionist.isVerified);

  return (
    <div className="portal-page space-y-8">
      <PortalPageHeader icon={Stethoscope} eyebrow="Professional governance" title="Nutritionist verification" description="Review professional credentials and control access to clinical meal-review capabilities." meta={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{verified.length} verified · {pending.length} pending</span>} />

      {pending.length > 0 && (
        <section>
          <p className="portal-section-label mb-4">Pending verification · {pending.length}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((nutritionist) => (
              <Card key={nutritionist.id} className="p-6">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"><Clock3 className="h-5 w-5" /></span><div><h3 className="font-display text-base font-bold text-brand-text">{nutritionist.user.name}</h3><p className="text-xs text-brand-muted">{nutritionist.user.email}</p></div></div>
                    <div className="mt-5 grid gap-2 text-xs text-brand-muted sm:grid-cols-2">
                      <div className="rounded-xl bg-brand-bgAlt/60 p-3"><span className="block text-[9px] uppercase tracking-wider">PRC license</span><strong className="mt-1 block font-mono text-brand-text">{nutritionist.prcLicenseNumber}</strong></div>
                      <div className="rounded-xl bg-brand-bgAlt/60 p-3"><span className="block text-[9px] uppercase tracking-wider">Expiry</span><strong className="mt-1 block text-brand-text">{new Date(nutritionist.prcLicenseExpiry).toLocaleDateString()}</strong></div>
                    </div>
                    {(nutritionist.university || nutritionist.specialization) && <div className="mt-3 space-y-1 text-[11px] text-brand-muted">{nutritionist.university && <p className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5" />{nutritionist.university}</p>}{nutritionist.specialization && <p className="flex items-center gap-2"><Stethoscope className="h-3.5 w-3.5" />{nutritionist.specialization}</p>}</div>}
                  </div>
                  <Button variant="primary" onClick={() => handleVerify(nutritionist.id)} isLoading={verifying === nutritionist.id} className="shrink-0"><ShieldCheck className="h-4 w-4" />Verify</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="portal-section-label mb-4">Verified professionals · {verified.length}</p>
        {verified.length === 0 ? <Card className="p-10 text-center text-sm text-brand-muted">No verified nutritionists yet.</Card> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {verified.map((nutritionist) => (
              <Card key={nutritionist.id} className="p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green"><BadgeCheck className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-brand-text">{nutritionist.user.name}</h3><p className="truncate text-xs text-brand-muted">{nutritionist.user.email}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted">PRC {nutritionist.prcLicenseNumber}</p></div>
                  <div className="text-right"><p className="font-display text-xl font-black text-brand-green">{nutritionist.totalVerified}</p><p className="text-[9px] uppercase tracking-wider text-brand-muted">meals verified</p>{nutritionist.verifiedAt && <p className="mt-2 flex items-center justify-end gap-1 text-[9px] text-brand-muted"><CalendarDays className="h-3 w-3" /><span>Verified {new Date(nutritionist.verifiedAt).toLocaleDateString()}</span></p>}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
