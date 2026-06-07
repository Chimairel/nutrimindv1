'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

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
    const fetch = async () => {
      try {
        const res = await api.get('/admin/nutritionists');
        if (res.data?.success) setNutritionists(res.data.data);
      } catch (err) {
        console.error('Failed to fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await api.patch(`/admin/nutritionists/${id}/verify`);
      setNutritionists((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isVerified: true, verifiedAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Verify failed:', err);
    } finally {
      setVerifying(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading...</span></div>;
  }

  const pending = nutritionists.filter((n) => !n.isVerified);
  const verified = nutritionists.filter((n) => n.isVerified);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Nutritionists</h1>

      {/* Pending Section */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">⏳ Pending Verification ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map((n) => (
              <Card key={n.id} className="p-5 border-amber-500/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-brand-text">{n.user.name}</h3>
                    <p className="text-xs text-brand-muted">{n.user.email}</p>
                    <div className="mt-2 space-y-1 text-xs text-brand-muted">
                      <div>PRC License: <strong className="text-brand-text font-mono">{n.prcLicenseNumber}</strong></div>
                      <div>Expiry: <strong className="text-brand-text">{new Date(n.prcLicenseExpiry).toLocaleDateString()}</strong></div>
                      {n.university && <div>University: <strong className="text-brand-text">{n.university}</strong></div>}
                      {n.specialization && <div>Specialization: <strong className="text-brand-text">{n.specialization}</strong></div>}
                    </div>
                  </div>
                  <Button variant="primary" onClick={() => handleVerify(n.id)} isLoading={verifying === n.id} className="text-xs px-6">
                    ✅ Verify
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Verified Section */}
      <div>
        <h2 className="text-sm font-bold text-brand-green uppercase tracking-wider mb-3">✅ Verified ({verified.length})</h2>
        {verified.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-brand-muted text-sm">No verified nutritionists yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {verified.map((n) => (
              <Card key={n.id} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand-text">{n.user.name}</h3>
                  <p className="text-xs text-brand-muted">{n.user.email} • PRC: {n.prcLicenseNumber}</p>
                </div>
                <div className="text-right text-xs text-brand-muted">
                  <div>Verified {n.totalVerified} meals</div>
                  {n.verifiedAt && <div>Since {new Date(n.verifiedAt).toLocaleDateString()}</div>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
