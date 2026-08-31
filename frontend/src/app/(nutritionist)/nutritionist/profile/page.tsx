'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Check, Clock, Star, UserRound } from 'lucide-react';

interface NProfile {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  isVerified: boolean;
  totalVerified: number;
  rating: number;
}

export default function NutritionistProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<NProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setError(null);
        const res = await api.get('/nutritionist/profile');
        if (res.data?.success && res.data.data) {
          setProfile(res.data.data);
          setBio(res.data.data.bio || '');
          setSpecialization(res.data.data.specialization || '');
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError('Your professional profile could not be loaded. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/nutritionist/profile', { bio, specialization });
      setSuccess('Professional profile updated.');
    } catch (err) {
      console.error('Save failed:', err);
      setError('Your professional profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading...</span></div>;
  }

  return (
    <div className="portal-page max-w-4xl space-y-6 text-left">
      <PortalPageHeader icon={UserRound} eyebrow="Professional identity" title="Nutritionist profile" description="Maintain the professional details shown alongside your clinical review activity." />

      <Card className="grid gap-4 p-6 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-brand-bgAlt/55 p-4"><span className="text-[10px] uppercase tracking-wider text-brand-muted">PRC License</span><span className="mt-2 block font-mono font-bold text-brand-text">{profile?.prcLicenseNumber}</span></div>
        <div className="rounded-2xl bg-brand-bgAlt/55 p-4"><span className="text-[10px] uppercase tracking-wider text-brand-muted">License expiry</span><span className="mt-2 block font-bold text-brand-text">{profile?.prcLicenseExpiry ? new Date(profile.prcLicenseExpiry).toLocaleDateString() : 'Not available'}</span></div>
        <div className="rounded-2xl bg-brand-bgAlt/55 p-4">
          <span className="text-brand-muted">Verified</span>
          <span className={`mt-2 flex font-bold ${profile?.isVerified ? 'text-brand-green' : 'text-status-error-text'}`}>
            {profile?.isVerified ? (
              <span className="inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                <span>Yes</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending</span>
              </span>
            )}
          </span>
        </div>
        <div className="rounded-2xl bg-brand-bgAlt/55 p-4"><span className="text-[10px] uppercase tracking-wider text-brand-muted">Meals verified</span><span className="mt-2 block font-display text-2xl font-black text-brand-green">{profile?.totalVerified}</span></div>
        <div className="rounded-2xl bg-brand-bgAlt/55 p-4 sm:col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-brand-muted">Rating</span>
          <span className="mt-2 inline-flex items-center gap-1 font-bold text-brand-text">
            <Star className="w-3.5 h-3.5 fill-brand-green stroke-brand-green" />
            <span>{profile?.rating?.toFixed(1)}</span>
          </span>
        </div>
      </Card>

      <Card className="space-y-5 p-6">
        <p className="portal-section-label">Edit profile</p>
        {error && <p role="alert" className="rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3 text-xs font-semibold text-status-verified-text">{success}</p>}
        <div>
          <label htmlFor="nutritionist-specialization" className="mb-2 block text-xs font-bold text-brand-text">Specialization</label>
          <input
            id="nutritionist-specialization"
            name="specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            className="w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10"
            placeholder="e.g. Sports Nutrition, Clinical Nutrition"
          />
        </div>
        <div>
          <label htmlFor="nutritionist-bio" className="mb-2 block text-xs font-bold text-brand-text">Bio</label>
          <textarea
            id="nutritionist-bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full resize-none rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10"
            rows={4}
            placeholder="Summarize your clinical expertise and review focus..."
          />
        </div>
        <Button variant="primary" onClick={handleSave} isLoading={saving} className="text-xs">
          Save Changes
        </Button>
      </Card>

      <Button variant="secondary" onClick={logout} className="w-full py-3 text-sm">
        Sign Out
      </Button>
    </div>
  );
}
