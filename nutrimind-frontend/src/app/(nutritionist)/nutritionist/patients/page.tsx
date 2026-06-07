'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';

interface Patient {
  id: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string; email: string; onboardingDone: boolean; createdAt: string };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/nutritionist/patients');
        if (res.data?.success) setPatients(res.data.data);
      } catch (err) {
        console.error('Failed to fetch patients:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading patients...</span></div>;
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Your Patients</h1>

      {patients.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="text-5xl block mb-4">👥</span>
          <p className="text-brand-muted">No patients assigned yet. They&apos;ll appear here once an admin assigns them.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patients.map((p) => (
            <Card key={p.id} className="p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-brand-text">{p.user.name}</h3>
                <p className="text-xs text-brand-muted">{p.user.email}</p>
                <p className="text-xs text-brand-muted mt-1">
                  Assigned: {new Date(p.assignedAt).toLocaleDateString()} •{' '}
                  {p.user.onboardingDone ? '✅ Onboarded' : '⏳ Onboarding'}
                </p>
              </div>
              <div className="text-2xl">👤</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
