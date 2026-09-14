'use client';
import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar, { FILIPINO_AVATAR_PRESETS } from '@/components/ui/Avatar';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import api from '@/lib/axios';
import type { UserSession } from '@/lib/context/AuthContext';
import { CheckCircle, AlertTriangle, Sparkles, ChevronLeft, ChevronRight, Dices, ExternalLink } from 'lucide-react';

const OPEN_PEEPS_MALE_HEADS = [
  'short1',
  'short2',
  'short3',
  'short4',
  'short5',
  'flatTop',
  'flatTopLong',
  'pomp',
  'shaved1',
  'cornrows',
  'dreads1',
  'afro',
  'twists',
  'noHair1',
];
const OPEN_PEEPS_FEMALE_HEADS = [
  'long',
  'longBangs',
  'longCurly',
  'bun',
  'bun2',
  'buns',
  'bangs',
  'bangs2',
  'medium1',
  'medium2',
  'medium3',
  'mediumBangs',
  'mediumStraight',
  'bantuKnots',
];
const OPEN_PEEPS_FACES = [
  'smile',
  'smileBig',
  'smileLOL',
  'cute',
  'calm',
  'driven',
  'serious',
  'cheeky',
  'eatingHappy',
  'awe',
];

const SKIN_TONES = [
  { name: 'Fair Mestizo', hex: 'ffdbac' },
  { name: 'Warm Sunlit', hex: 'f8d25c' },
  { name: 'Light Warm', hex: 'edb98a' },
  { name: 'Kayumanggi', hex: 'd08b5b' },
  { name: 'Tan Morena', hex: 'e0ac69' },
  { name: 'Deep Kayumanggi', hex: '694d3d' },
];

const CLOTHING_COLORS = [
  { name: 'Emerald', hex: '00b159' },
  { name: 'Navy Blue', hex: '03396c' },
  { name: 'Sky Blue', hex: '428bca' },
  { name: 'Crimson', hex: 'ae0001' },
  { name: 'Gold / Yellow', hex: 'ffd969' },
  { name: 'Dark Slate', hex: '323232' },
  { name: 'Cream Barong', hex: 'ffeead' },
];

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

  // Avatar Studio / Outfit Browser state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioGender, setStudioGender] = useState<'male' | 'female'>('male');
  const [studioHeadIndex, setStudioHeadIndex] = useState(0);
  const [studioFaceIndex, setStudioFaceIndex] = useState(0);
  const [studioSkin, setStudioSkin] = useState('d08b5b');
  const [studioClothingColor, setStudioClothingColor] = useState('00b159');

  const applyStudioAvatar = (
    gender: 'male' | 'female' = studioGender,
    headIdx: number = studioHeadIndex,
    faceIdx: number = studioFaceIndex,
    color: string = studioClothingColor,
    skin: string = studioSkin
  ) => {
    const list = gender === 'male' ? OPEN_PEEPS_MALE_HEADS : OPEN_PEEPS_FEMALE_HEADS;
    const head = list[headIdx % list.length];
    const face = OPEN_PEEPS_FACES[faceIdx % OPEN_PEEPS_FACES.length];
    const url = `https://api.dicebear.com/10.x/open-peeps/svg?headVariant=${head}&expressionVariant=${face}&skinColor=${skin}&clothingColor=${color}&scale=1.2&facialHairProbability=0&maskProbability=0&accessoriesProbability=0`;
    setAvatarSeed(url);
  };

  const randomizeStudio = () => {
    const list = studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS : OPEN_PEEPS_FEMALE_HEADS;
    const randomHead = Math.floor(Math.random() * list.length);
    const randomFace = Math.floor(Math.random() * OPEN_PEEPS_FACES.length);
    const randomColor = CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)].hex;
    const randomSkin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].hex;
    setStudioHeadIndex(randomHead);
    setStudioFaceIndex(randomFace);
    setStudioClothingColor(randomColor);
    setStudioSkin(randomSkin);
    applyStudioAvatar(studioGender, randomHead, randomFace, randomColor, randomSkin);
  };

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
            className="h-28 w-28 rounded-full shadow-xl"
          />
          <span className="mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-brand-muted">
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
          <label
            htmlFor="avatar-seed"
            className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted"
          >
            Avatar seed
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="avatar-seed"
              name="avatarSeed"
              type="text"
              placeholder="Default or enter any name..."
              value={avatarSeed}
              onChange={(e) => setAvatarSeed(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-bgAlt px-4 py-2.5 text-sm text-brand-text outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/25"
            />
            <Button
              variant="primary"
              onClick={handleSaveAvatar}
              isLoading={isSavingAvatar}
              className="px-5 py-2.5 text-xs font-bold shadow-md"
            >
              Save
            </Button>
          </div>

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
                  showSalakot={false}
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
                      showSalakot={false}
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

          <div className="mt-5 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-4 transition">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
                  <Sparkles className="h-3.5 w-3.5 text-brand-green" />
                  Interactive Avatar Studio & Outfit Browser
                </h3>
                <p className="mt-0.5 text-[11px] text-brand-muted">
                  Browse and hand-pick your exact hairstyle, clothing, outfit color, and skin tone with live preview.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={isStudioOpen ? 'secondary' : 'primary'}
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!isStudioOpen) {
                      applyStudioAvatar(
                        studioGender,
                        studioHeadIndex,
                        studioFaceIndex,
                        studioClothingColor,
                        studioSkin
                      );
                    }
                    setIsStudioOpen(!isStudioOpen);
                  }}
                  className="h-auto px-3.5 py-1.5 text-xs font-bold shadow-sm"
                >
                  {isStudioOpen ? 'Close Studio' : '🎨 Browse & Customize'}
                </Button>
              </div>
            </div>

            {isStudioOpen && (
              <div className="mt-4 space-y-4 border-t border-brand-border/60 pt-4 animate-fade-in">
                {/* Gender Selection & Randomize */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-brand-border bg-brand-surface p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStudioGender('male');
                        setStudioHeadIndex(0);
                        applyStudioAvatar('male', 0, studioFaceIndex, studioClothingColor, studioSkin);
                      }}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        studioGender === 'male'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-brand-muted hover:text-brand-text'
                      }`}
                    >
                      ♂ Male (Lalaki)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStudioGender('female');
                        setStudioHeadIndex(0);
                        applyStudioAvatar('female', 0, studioFaceIndex, studioClothingColor, studioSkin);
                      }}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        studioGender === 'female'
                          ? 'bg-pink-500/20 text-pink-400'
                          : 'text-brand-muted hover:text-brand-text'
                      }`}
                    >
                      ♀ Female (Babae)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={randomizeStudio}
                    className="flex items-center gap-1.5 rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green transition hover:bg-brand-green/20"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    <span>🎲 Surprise Me (Random Mix)</span>
                  </button>
                </div>

                {/* Head / Hairstyle Browser */}
                <div className="rounded-xl border border-brand-border bg-brand-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-brand-text">
                      Hairstyle ({studioGender === 'male' ? 'Masculine Cuts' : 'Feminine Cuts'})
                    </span>
                    <span className="font-mono text-[10px] font-bold text-brand-muted">
                      {OPEN_PEEPS_MALE_HEADS[
                        studioHeadIndex %
                          (studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS.length : OPEN_PEEPS_FEMALE_HEADS.length)
                      ] || 'Style'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const list = studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS : OPEN_PEEPS_FEMALE_HEADS;
                        const prev = studioHeadIndex <= 0 ? list.length - 1 : studioHeadIndex - 1;
                        setStudioHeadIndex(prev);
                        applyStudioAvatar(studioGender, prev, studioFaceIndex, studioClothingColor, studioSkin);
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg border border-brand-border bg-brand-bgAlt px-2.5 text-xs font-bold text-brand-muted hover:text-brand-text"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </button>
                    <div className="flex-1 text-center font-mono text-xs font-bold text-brand-green">
                      head:{' '}
                      {
                        (studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS : OPEN_PEEPS_FEMALE_HEADS)[
                          studioHeadIndex %
                            (studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS.length : OPEN_PEEPS_FEMALE_HEADS.length)
                        ]
                      }
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = studioGender === 'male' ? OPEN_PEEPS_MALE_HEADS : OPEN_PEEPS_FEMALE_HEADS;
                        const next = (studioHeadIndex + 1) % list.length;
                        setStudioHeadIndex(next);
                        applyStudioAvatar(studioGender, next, studioFaceIndex, studioClothingColor, studioSkin);
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg border border-brand-border bg-brand-bgAlt px-2.5 text-xs font-bold text-brand-muted hover:text-brand-text"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Facial Expression Browser */}
                <div className="rounded-xl border border-brand-border bg-brand-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-brand-text">Facial Expression</span>
                    <span className="font-mono text-[10px] font-bold text-brand-muted">
                      {OPEN_PEEPS_FACES[studioFaceIndex % OPEN_PEEPS_FACES.length]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = studioFaceIndex <= 0 ? OPEN_PEEPS_FACES.length - 1 : studioFaceIndex - 1;
                        setStudioFaceIndex(prev);
                        applyStudioAvatar(studioGender, studioHeadIndex, prev, studioClothingColor, studioSkin);
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg border border-brand-border bg-brand-bgAlt px-2.5 text-xs font-bold text-brand-muted hover:text-brand-text"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </button>
                    <div className="flex-1 text-center font-mono text-xs font-bold text-brand-green">
                      face: {OPEN_PEEPS_FACES[studioFaceIndex % OPEN_PEEPS_FACES.length]}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (studioFaceIndex + 1) % OPEN_PEEPS_FACES.length;
                        setStudioFaceIndex(next);
                        applyStudioAvatar(studioGender, studioHeadIndex, next, studioClothingColor, studioSkin);
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg border border-brand-border bg-brand-bgAlt px-2.5 text-xs font-bold text-brand-muted hover:text-brand-text"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Color Swatches (Outfit & Skin) */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-brand-border bg-brand-surface p-3">
                    <span className="block text-[11px] font-bold text-brand-text">Clothing Color</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CLOTHING_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          title={c.name}
                          onClick={() => {
                            setStudioClothingColor(c.hex);
                            applyStudioAvatar(studioGender, studioHeadIndex, studioFaceIndex, c.hex, studioSkin);
                          }}
                          className={`h-6 w-6 rounded-full border transition ${
                            studioClothingColor === c.hex
                              ? 'scale-110 ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: `#${c.hex}` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-border bg-brand-surface p-3">
                    <span className="block text-[11px] font-bold text-brand-text">Skin Tone (Open Peeps Palette)</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SKIN_TONES.map((s) => (
                        <button
                          key={s.hex}
                          type="button"
                          title={s.name}
                          onClick={() => {
                            setStudioSkin(s.hex);
                            applyStudioAvatar(
                              studioGender,
                              studioHeadIndex,
                              studioFaceIndex,
                              studioClothingColor,
                              s.hex
                            );
                          }}
                          className={`h-6 w-6 rounded-full border transition ${
                            studioSkin === s.hex
                              ? 'scale-110 ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: `#${s.hex}` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Full Web Playground Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/40 pt-2 text-[10px] text-brand-muted">
                  <span>
                    Live preview updates above. Click <strong>Save</strong> when satisfied!
                  </span>
                  <a
                    href="https://www.dicebear.com/styles/open-peeps/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-green hover:underline"
                  >
                    <span>Full Open Peeps Studio</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
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
                  💡 <em>Using Brave?</em> Toggle <strong>Brave Shields to OFF</strong> in your address bar, or simply
                  copy your Google profile photo address and paste it directly into the <strong>Avatar seed</strong>{' '}
                  input above.
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
