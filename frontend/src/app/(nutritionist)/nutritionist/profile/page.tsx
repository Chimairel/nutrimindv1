'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import AvatarSettings from '@/features/profile/AvatarSettings';
import { useAuth } from '@/hooks/useAuth';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Check, Clock, UserRound, Sparkles, ShieldCheck } from 'lucide-react';

interface NProfile {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  officialHeadshot?: string | null;
  digitalSignature?: string | null;
  isVerified: boolean;
  totalVerified: number;
}

export default function NutritionistProfilePage() {
  const { logout, user, updateUserSession } = useAuth();
  const [profile, setProfile] = useState<NProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'credentials' | 'avatar'>('credentials');
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
      setProfile((current) => (current ? { ...current, bio, specialization } : current));
      setSuccess('Professional profile updated.');
    } catch (err) {
      console.error('Save failed:', err);
      setError('Your professional profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <PortalLoadingState message="Loading professional profile..." />;
  }

  return (
    <div className="portal-page max-w-4xl space-y-6 text-left">
      <PortalPageHeader
        icon={UserRound}
        eyebrow="Professional identity"
        title="Nutritionist profile"
        description="Manage the credentials, clinical introduction, and avatar users see alongside your reviews."
      />

      {/* Tab Navigation */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 border-b border-brand-border/60 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'credentials'
              ? 'bg-brand-accent text-[#07100d] shadow-sm'
              : 'border border-brand-border/70 bg-brand-surface/70 text-brand-muted hover:text-brand-text'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Clinical Credentials</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('avatar')}
          className={`inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'avatar'
              ? 'bg-brand-accent text-[#07100d] shadow-sm'
              : 'border border-brand-border/70 bg-brand-surface/70 text-brand-muted hover:text-brand-text'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Avatar & Appearance</span>
        </button>
      </div>

      {activeTab === 'credentials' ? (
        <div className="space-y-6">
          {/* Professional Identity Hero Card */}
          <Card className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              {profile?.officialHeadshot ? (
                <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-brand-green shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.officialHeadshot}
                    alt={user?.name || 'Nutritionist'}
                    className="h-full w-full object-cover"
                  />
                  {profile?.isVerified && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-white shadow-md ring-2 ring-brand-surface"
                      title="PRC Verified Nutritionist-Dietitian"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <Avatar name={user?.name} seed={user?.image} size="xl" />
                  {profile?.isVerified && (
                    <span
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-white shadow-md ring-2 ring-brand-surface"
                      title="PRC Verified Nutritionist-Dietitian"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="font-display text-xl font-black text-brand-text">{user?.name}</h2>
                <Badge variant={profile?.isVerified ? 'verified' : 'pending'}>
                  {profile?.isVerified ? 'PRC Verified RND' : 'Verification Pending'}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-brand-green">
                PRC License: {profile?.prcLicenseNumber || 'Not available'}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {profile?.specialization || 'General Clinical Nutrition'} ·{' '}
                {profile?.university || 'Philippine Accredited University'}
              </p>
            </div>
          </Card>

          {/* License & Metrics Grid */}
          <Card className="grid gap-4 p-6 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-brand-bgAlt/55 p-4">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted">PRC License</span>
              <span className="mt-2 block font-mono font-bold text-brand-text">{profile?.prcLicenseNumber}</span>
            </div>
            <div className="rounded-2xl bg-brand-bgAlt/55 p-4">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted">License expiry</span>
              <span className="mt-2 block font-bold text-brand-text">
                {profile?.prcLicenseExpiry ? new Date(profile.prcLicenseExpiry).toLocaleDateString() : 'Not available'}
              </span>
            </div>
            <div className="rounded-2xl bg-brand-bgAlt/55 p-4">
              <span className="text-brand-muted">Verified</span>
              <span
                className={`mt-2 flex font-bold ${profile?.isVerified ? 'text-brand-green' : 'text-status-error-text'}`}
              >
                {profile?.isVerified ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                    <span>Yes</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending</span>
                  </span>
                )}
              </span>
            </div>
            <div className="rounded-2xl bg-brand-bgAlt/55 p-4">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted">Meals verified</span>
              <span className="mt-2 block font-display text-2xl font-black text-brand-green">
                {profile?.totalVerified}
              </span>
            </div>
          </Card>

          {/* Edit Profile Form */}
          <Card className="space-y-5 p-6">
            <p className="portal-section-label">Edit profile</p>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                className="rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3 text-xs font-semibold text-status-verified-text"
              >
                {success}
              </p>
            )}
            <div>
              <label htmlFor="nutritionist-specialization" className="mb-2 block text-xs font-bold text-brand-text">
                Specialization
              </label>
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
              <label htmlFor="nutritionist-bio" className="mb-2 block text-xs font-bold text-brand-text">
                Bio
              </label>
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

          {/* Biometric & Clinical Signature Verification (Immutable) */}
          <Card className="space-y-4 p-6 border-brand-green/30 bg-brand-green/[0.03]">
            <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
              <div>
                <p className="portal-section-label !text-brand-green">Clinical Identity Verification</p>
                <h3 className="text-sm font-bold text-brand-text mt-0.5">Biometric Headshot &amp; Digital Signature</h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Locked &amp; Immutable
              </span>
            </div>

            <p className="text-xs text-brand-muted leading-relaxed">
              Your official clinical headshot and handwritten signature were captured during application onboarding and verified by administration. These credentials are permanently locked to ensure clinical accountability and prevent identity spoofing.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surface/70 p-4 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Official Headshot Photo
                </span>
                <div className="flex items-center gap-4">
                  {profile?.officialHeadshot ? (
                    <div className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-brand-green shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.officialHeadshot}
                        alt="Official headshot"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-brand-muted">
                      No photo
                    </div>
                  )}
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-brand-text">Verified Live Capture</p>
                    <p className="text-[11px] text-brand-muted">Displayed on meal certificates</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-border/60 bg-brand-surface/70 p-4 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                  Official Digital Signature
                </span>
                <div>
                  {profile?.digitalSignature ? (
                    <div className="h-16 w-full max-w-[200px] rounded-xl bg-neutral-950 border border-neutral-800 p-2 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.digitalSignature}
                        alt="Official digital signature"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-16 rounded-xl bg-neutral-900 flex items-center justify-center text-xs text-brand-muted">
                      No signature recorded
                    </div>
                  )}
                  <p className="text-[10px] text-brand-muted mt-1.5">Attached to approved meal plans</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Public Profile Preview with Live Avatar */}
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
              <p className="portal-section-label">Public Review Attribution Preview</p>
              <span className="font-mono text-[10px] uppercase tracking-wider text-brand-muted">Patient View</span>
            </div>
            <div className="flex flex-col items-center sm:flex-row sm:items-start text-center sm:text-left gap-4 pt-1">
              <div className="relative shrink-0">
                {profile?.officialHeadshot ? (
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-brand-green shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.officialHeadshot}
                      alt={user?.name || 'Nutritionist'}
                      className="h-full w-full object-cover"
                    />
                    {profile?.isVerified && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-white shadow-sm ring-2 ring-brand-surface"
                        title="PRC Licensed Nutritionist"
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <Avatar name={user?.name} seed={user?.image} size="lg" />
                    {profile?.isVerified && (
                      <span
                        className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-white shadow-sm ring-2 ring-brand-surface"
                        title="PRC Licensed Nutritionist"
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <p className="font-display font-bold text-brand-text">{user?.name}</p>
                  {profile?.isVerified && (
                    <Badge variant="verified" className="text-[9px]">
                      Verified RND
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-xs font-semibold text-brand-green">
                  PRC {profile?.prcLicenseNumber || 'Not available'}
                </p>
                <p className="text-xs text-brand-muted">
                  Valid until{' '}
                  {profile?.prcLicenseExpiry
                    ? new Date(profile.prcLicenseExpiry).toLocaleDateString()
                    : 'Not available'}
                </p>
                <p className="text-xs font-semibold text-brand-text">
                  {profile?.specialization || 'General Clinical Nutrition'}
                </p>
                <p className="text-xs leading-relaxed text-brand-muted">{profile?.bio || 'No introduction provided'}</p>
                {profile?.digitalSignature && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-brand-muted block mb-1">
                      Attestation Signature
                    </span>
                    <div className="h-10 w-28 rounded-lg bg-neutral-950 border border-neutral-800 p-1 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.digitalSignature}
                        alt="Digital signature"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}
                <p className="pt-2 text-[10px] text-brand-muted/80">
                  Users view these professional credentials whenever you approve or review their meal plans.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {user && (
            <AvatarSettings visible={activeTab === 'avatar'} user={user} updateUserSession={updateUserSession} />
          )}
        </div>
      )}

      <Button variant="secondary" onClick={logout} className="w-full py-3 text-sm">
        Sign Out
      </Button>
    </div>
  );
}
