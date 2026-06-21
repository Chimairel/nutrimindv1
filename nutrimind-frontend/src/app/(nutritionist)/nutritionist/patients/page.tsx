'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import { Users, CheckCircle, Clock, User } from 'lucide-react';

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
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6 text-left">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Your Patients</h1>

      {patients.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-4">
          <Users className="w-12 h-12 text-brand-green" />
          <p className="text-brand-muted">No patients assigned yet. They&apos;ll appear here once an admin assigns them.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patients.map((p) => (
            <Card key={p.id} className="p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-brand-text">{p.user.name}</h3>
                <p className="text-xs text-brand-muted">{p.user.email}</p>
                <div className="text-xs text-brand-muted mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>Assigned: {new Date(p.assignedAt).toLocaleDateString()}</span>
                  <span>•</span>
                  {p.user.onboardingDone ? (
                    <span className="inline-flex items-center gap-1 text-brand-green">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Onboarded</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Onboarding</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-surface flex items-center justify-center">
                <User className="w-5 h-5 text-brand-muted" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

