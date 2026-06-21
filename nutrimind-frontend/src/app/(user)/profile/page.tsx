'use client';

import React, { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/axios';
import { Check, X, Flame } from 'lucide-react';


export default function ProfilePage() {
  const { profile, isLoading, refresh } = useProfile();
  const { logout, user, updateUserSession } = useAuth();
  const [weightInput, setWeightInput] = useState('');
  const [weightNote, setWeightNote] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logMsg, setLogMsg] = useState<string | null>(null);

  const [avatarSeed, setAvatarSeed] = useState(user?.image || '');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const PRESETS = ['John', 'Jane', 'Felix', 'Coco', 'Cookie', 'Simba', 'Buster', 'Lucky', 'Shadow', 'Sparky'];

  const handleLogWeight = async () => {
    if (!weightInput) return;
    setIsLogging(true);
    try {
      await api.post('/user/progress/weight', { weightKg: parseFloat(weightInput), note: weightNote });
      setLogMsg('Weight logged successfully!');
      setWeightInput('');
      setWeightNote('');
      refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setLogMsg(axiosErr.response?.data?.error || 'Failed to log weight');
    } finally {
      setIsLogging(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading profile...</span></div>;
  }

  if (!profile) {
    return <div className="text-brand-muted text-center mt-20">Profile not found.</div>;
  }

  const p = profile.userProfile;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Your Profile</h1>

      {/* Account Info */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-3">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-brand-muted">Name</span><span className="text-brand-text font-semibold">{profile.name}</span></div>
          <div className="flex justify-between"><span className="text-brand-muted">Email</span><span className="text-brand-text font-semibold">{profile.email}</span></div>
          <div className="flex justify-between">
            <span className="text-brand-muted">Email Verified</span>
            <span className={profile.emailVerified ? 'text-brand-green' : 'text-status-error-text'}>
              {profile.emailVerified ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  <span>Yes</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <X className="w-3.5 h-3.5 stroke-[3px]" />
                  <span>No</span>
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between"><span className="text-brand-muted">Joined</span><span className="text-brand-text">{new Date(profile.createdAt).toLocaleDateString()}</span></div>
        </div>
      </Card>

      {/* Body Stats */}
      {p && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-3">Body Stats</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-brand-muted">Age:</span> <strong className="text-brand-text">{p.age || '—'}</strong></div>
            <div><span className="text-brand-muted">Sex:</span> <strong className="text-brand-text">{p.biologicalSex || '—'}</strong></div>
            <div><span className="text-brand-muted">Height:</span> <strong className="text-brand-text">{p.heightCm ? `${p.heightCm} cm` : '—'}</strong></div>
            <div><span className="text-brand-muted">Weight:</span> <strong className="text-brand-text">{p.weightKg ? `${p.weightKg} kg` : '—'}</strong></div>
            <div><span className="text-brand-muted">Target:</span> <strong className="text-brand-text">{p.targetWeightKg ? `${p.targetWeightKg} kg` : '—'}</strong></div>
            <div><span className="text-brand-muted">Goal:</span> <strong className="text-brand-text">{p.goal?.replace(/_/g, ' ') || '—'}</strong></div>
            <div><span className="text-brand-muted">Activity:</span> <strong className="text-brand-text">{p.activityLevel?.replace(/_/g, ' ') || '—'}</strong></div>
            <div><span className="text-brand-muted">Calories:</span> <strong className="text-brand-green">{p.dailyCalorieTarget ? `${p.dailyCalorieTarget} kcal` : '—'}</strong></div>
          </div>
        </Card>
      )}

      {/* Diet & Clinical */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-3">Diet & Health</h2>
        <div className="space-y-2 text-sm">
          <div><span className="text-brand-muted">Diet:</span> <strong className="text-brand-text">{p?.dietaryPreference || 'OMNIVORE'}</strong></div>
          <div><span className="text-brand-muted">Carb Level:</span> <strong className="text-brand-text">{p?.carbPreference || 'MODERATE'}</strong></div>
          <div><span className="text-brand-muted">Conditions:</span> <strong className="text-brand-text">{profile.healthConditions.length > 0 ? profile.healthConditions.join(', ') : 'None'}</strong></div>
          <div><span className="text-brand-muted">Allergies:</span> <strong className="text-brand-text">{profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}</strong></div>
          <div className="flex justify-between items-center">
            <span className="text-brand-muted">Check-in Streak:</span>
            <strong className="text-brand-green flex items-center gap-1">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
              <span>{p?.checkinStreak || 0} weeks</span>
            </strong>
          </div>
        </div>
      </Card>

      {/* Customize Pixel-Art Avatar */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-3">Customize Pixel-Art Avatar</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar size="lg" src={avatarSeed} fallbackText={profile.name} className="shadow" />
            <span className="text-xs text-brand-muted">Preview</span>
          </div>

          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">Avatar Sprite Seed</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type any word..."
                  value={avatarSeed}
                  onChange={(e) => setAvatarSeed(e.target.value)}
                  className="flex-1 bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-green focus:outline-none"
                />
                <Button
                  variant="primary"
                  onClick={async () => {
                    setIsSavingAvatar(true);
                    setAvatarMsg(null);
                    try {
                      const res = await api.put('/user/profile/avatar', { image: avatarSeed });
                      if (res.data.success) {
                        setAvatarMsg('Avatar updated successfully!');
                        updateUserSession({ image: avatarSeed });
                      }
                    } catch {
                      setAvatarMsg('Failed to save avatar');
                    } finally {
                      setIsSavingAvatar(false);
                    }
                  }}
                  isLoading={isSavingAvatar}
                  className="px-4 py-2 text-xs"
                >
                  Save
                </Button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-brand-muted mb-1.5">Or choose a preset:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAvatarSeed(p)}
                    className={`
                      px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 font-medium
                      ${avatarSeed === p 
                        ? 'bg-brand-green text-white border-brand-border' 
                        : 'bg-brand-surface text-brand-text border-brand-border/30 hover:border-brand-border'
                      }
                    `}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {avatarMsg && <p className="text-xs mt-2 text-brand-green">{avatarMsg}</p>}
      </Card>


      {/* Quick Weight Log */}
      <Card className="p-5">
        <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-3">Quick Weight Log</h2>
        <div className="flex gap-2 items-end">
          <input
            type="number"
            placeholder="Weight (kg)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="flex-1 bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-green focus:outline-none"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={weightNote}
            onChange={(e) => setWeightNote(e.target.value)}
            className="flex-1 bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-green focus:outline-none"
          />
          <Button variant="primary" onClick={handleLogWeight} isLoading={isLogging} className="px-4 py-2 text-xs">
            Log
          </Button>
        </div>
        {logMsg && <p className="text-xs mt-2 text-brand-green">{logMsg}</p>}
      </Card>

      {/* Logout */}
      <div className="pt-4">
        <Button variant="secondary" onClick={logout} className="w-full py-3 text-sm">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
