'use client';
import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar, { FILIPINO_AVATAR_PRESETS } from '@/components/ui/Avatar';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import api from '@/lib/axios';
import type { UserSession } from '@/lib/context/AuthContext';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function AvatarSettings({
  user,
  updateUserSession,
  visible = true,
}: {
  user: UserSession;
  updateUserSession: (updates: Partial<UserSession>) => void;
  visible?: boolean;
}) {
  // Avatar customization state
  const defaultUserImage = user?.googleImage || null;
  const initialSeed =
    !user?.image || user.image.toLowerCase() === 'default' || user.image === defaultUserImage ? 'Default' : user.image;
  const [avatarSeed, setAvatarSeed] = useState(initialSeed);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const isDefaultActive =
    !avatarSeed ||
    avatarSeed.toLowerCase() === 'default' ||
    (Boolean(defaultUserImage) && avatarSeed === defaultUserImage);

  const activePresetInfo = FILIPINO_AVATAR_PRESETS.find(
    (p) => !isDefaultActive && p.name.toLowerCase() === avatarSeed.toLowerCase()
  );

  const isPresetActive = (preset: string) => {
    if (preset === 'Default') {
      return isDefaultActive;
    }
    return !isDefaultActive && avatarSeed.toLowerCase() === preset.toLowerCase();
  };

  const filteredPresets = FILIPINO_AVATAR_PRESETS.filter((p) => {
    if (genderFilter === 'all') return true;
    return p.gender === genderFilter;
  });

  // Save Avatar Update
  const handleSaveAvatar = async () => {
    setIsSavingAvatar(true);
    setAvatarMsg(null);
    setAvatarError(null);
    try {
      const payloadImage = isDefaultActive ? 'Default' : avatarSeed;
      const res = await api.put('/user/profile/avatar', { image: payloadImage });
      if (res.data.success) {
        setAvatarMsg('Avatar updated successfully!');
        const savedImage = res.data.data?.image ?? (isDefaultActive ? defaultUserImage : avatarSeed);
        const googleImage = res.data.data?.googleImage ?? user?.googleImage;
        updateUserSession({ image: savedImage, googleImage });
      }
    } catch {
      setAvatarError('Failed to save avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  if (!visible) return null;
  return (
    <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
      <div className="grid lg:grid-cols-[0.68fr_1.32fr]">
        <div className="flex flex-col items-center justify-center border-b border-brand-border/60 bg-brand-bgAlt/55 p-7 lg:border-b-0 lg:border-r">
          <Avatar
            size="lg"
            src={isDefaultActive ? defaultUserImage || undefined : avatarSeed}
            fallbackText={user.name}
            showSalakot
            className="h-28 w-28 rounded-full shadow-xl"
          />
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/40 bg-brand-accent/15 px-2.5 py-1 text-[10px] font-bold text-brand-green">
              Salakot profile accent
            </span>
          </div>
          <span className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-brand-muted">
            Live preview
          </span>
          <div className="mt-2 text-center">
            {isDefaultActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 border border-brand-green/25 px-2.5 py-0.5 text-[10px] font-bold text-brand-green">
                Default · Google Account
              </span>
            ) : activePresetInfo ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                  activePresetInfo.gender === 'male'
                    ? 'border-blue-500/25 bg-blue-500/10 text-blue-400'
                    : 'border-pink-500/25 bg-pink-500/10 text-pink-400'
                }`}
              >
                {activePresetInfo.gender === 'male' ? '♂ Lalaki (Male)' : '♀ Babae (Female)'} · {activePresetInfo.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface px-2.5 py-0.5 text-[10px] font-bold text-brand-muted">
                Custom · {avatarSeed.startsWith('http') ? 'Custom Avatar' : avatarSeed}
              </span>
            )}
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-display text-base font-black text-brand-text">Profile avatar</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Choose your Google account photo, or select an authentic Filipino hand-drawn character.
            </p>
          </div>
          {avatarMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {avatarMsg}
            </div>
          )}
          {avatarError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {avatarError}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Curated Filipino Avatars
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-brand-border/60 bg-brand-bgAlt p-0.5">
              {(
                [
                  ['all', 'All'],
                  ['male', '♂ Male'],
                  ['female', '♀ Female'],
                ] as const
              ).map(([fKey, fLabel]) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setGenderFilter(fKey)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                    genderFilter === fKey
                      ? 'bg-brand-green/20 text-brand-green'
                      : 'text-brand-muted hover:text-brand-text'
                  }`}
                >
                  {fLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {genderFilter === 'all' && (
              <button
                type="button"
                onClick={() => setAvatarSeed('Default')}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-brand-green/30 ${
                  isDefaultActive
                    ? 'border-brand-green bg-brand-green/15 text-brand-green shadow-sm'
                    : 'border-brand-border bg-brand-bgAlt text-brand-muted hover:border-brand-border/80 hover:text-brand-text'
                }`}
              >
                <Avatar
                  size="sm"
                  src={defaultUserImage || undefined}
                  fallbackText={user.name}
                  showSalakot
                  className="h-10 w-10 rounded-full"
                />
                <span className="mt-2 truncate w-full text-xs font-bold">Default</span>
              </button>
            )}
            {filteredPresets.map((preset) => {
              const active = isPresetActive(preset.name);
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setAvatarSeed(preset.name)}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-brand-green/30 ${
                    active
                      ? 'border-brand-green bg-brand-green/15 text-brand-green shadow-sm'
                      : 'border-brand-border bg-brand-bgAlt text-brand-muted hover:border-brand-border/80 hover:text-brand-text'
                  }`}
                >
                  <div className="relative">
                    <Avatar
                      size="sm"
                      src={preset.name}
                      fallbackText={preset.name}
                      showSalakot
                      className="h-10 w-10 rounded-full"
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 rounded-full px-1 text-[8px] font-bold ${
                        preset.gender === 'male' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
                      }`}
                    >
                      {preset.gender === 'male' ? '♂' : '♀'}
                    </span>
                  </div>
                  <span className="mt-2 truncate w-full text-xs font-bold">{preset.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end border-t border-brand-border/60 pt-4">
            <Button
              variant="primary"
              onClick={handleSaveAvatar}
              isLoading={isSavingAvatar}
              className="px-6 py-2.5 text-xs font-bold shadow-md"
            >
              Save Avatar
            </Button>
          </div>

          {!defaultUserImage && (
            <div className="mt-5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4">
              <div className="mb-3">
                <p className="text-xs font-bold text-brand-text">Sync Google profile picture</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-brand-muted">
                  Sign in with Google once to import and use your real Google account profile photo under the{' '}
                  <strong>Default</strong> option.
                </p>
                <p className="mt-1 text-[10px] text-brand-muted/80">
                  💡 <em>Using Brave?</em> Toggle <strong>Brave Shields to OFF</strong> in your address bar if the
                  Google profile picture does not load automatically.
                </p>
              </div>
              <div className="max-w-xs">
                <GoogleSignInButton label="continue_with" />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
