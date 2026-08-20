'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/axios';
import axios from 'axios';
import { 
  User, 
  Lock, 
  Smile, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';

export default function ProfilePage() {
  const { logout, user, updateUserSession } = useAuth();

  // Avatar customization state
  const [avatarSeed, setAvatarSeed] = useState(user?.image || '');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const PRESETS = ['John', 'Jane', 'Felix', 'Coco', 'Cookie', 'Simba', 'Buster', 'Lucky', 'Shadow', 'Sparky'];

  // Account settings form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Password update form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Save Avatar Update
  const handleSaveAvatar = async () => {
    setIsSavingAvatar(true);
    setAvatarMsg(null);
    setAvatarError(null);
    try {
      const res = await api.put('/user/profile/avatar', { image: avatarSeed });
      if (res.data.success) {
        setAvatarMsg('Avatar updated successfully!');
        updateUserSession({ image: avatarSeed });
      }
    } catch {
      setAvatarError('Failed to save avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Save Account Credentials Update
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAccount(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const res = await api.put('/user/profile/settings', {
        name,
        email,
      });

      if (res.data && res.data.success) {
        setAccountSuccess('Account settings updated successfully!');
        updateUserSession({
          name: res.data.data.name,
          email: res.data.data.email,
        });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setAccountError(err.response?.data?.error || 'Failed to update account settings.');
      } else {
        setAccountError('Failed to update account settings.');
      }
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await api.put('/user/profile/settings', {
        currentPassword,
        newPassword,
      });

      if (res.data && res.data.success) {
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setPasswordError(err.response?.data?.error || 'Failed to update password.');
      } else {
        setPasswordError('Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return <div className="text-brand-muted text-center mt-20">Please log in to view settings.</div>;
  }

  return (
    <div className="portal-page max-w-4xl space-y-6 text-left text-brand-text">
      <PortalPageHeader icon={User} eyebrow="Personal identity" title="Account settings" description="Manage your account details, password, and custom profile avatar." />

      {/* Account Info Form Card */}
      <Card className="p-6 border-brand-border/60 bg-brand-surface/20 shadow-xl">
        <h2 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-4 font-display flex items-center gap-1.5">
          <User className="w-4 h-4 text-brand-green" />
          <span>Account Credentials</span>
        </h2>

        {accountSuccess && (
          <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
            <span>{accountSuccess}</span>
          </div>
        )}

        {accountError && (
          <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{accountError}</span>
          </div>
        )}

        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <Input
            label="Display Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              type="submit"
              disabled={isSavingAccount}
              className="text-xs font-bold py-2.5 px-6 shadow-md"
            >
              {isSavingAccount ? 'Saving Settings...' : 'Save Account Settings'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Password Change Card */}
      <Card className="p-6 border-brand-border/60 bg-brand-surface/20 shadow-xl">
        <h2 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-4 font-display flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-brand-green" />
          <span>Change Password</span>
        </h2>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              type="submit"
              disabled={isUpdatingPassword}
              className="text-xs font-bold py-2.5 px-6 shadow-md"
            >
              {isUpdatingPassword ? 'Updating Password...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Customize Pixel-Art Avatar */}
      <Card className="p-6 border-brand-border/60 bg-brand-surface/20 shadow-xl">
        <h2 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-4 font-display flex items-center gap-1.5">
          <Smile className="w-4 h-4 text-brand-green" />
          <span>Customize Pixel-Art Avatar</span>
        </h2>

        {avatarMsg && (
          <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
            <span>{avatarMsg}</span>
          </div>
        )}

        {avatarError && (
          <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{avatarError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar size="lg" src={avatarSeed} fallbackText={user.name} className="shadow-lg border-2 border-brand-green/20" />
            <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">Avatar Preview</span>
          </div>

          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Avatar Sprite Seed</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type any word..."
                  value={avatarSeed}
                  onChange={(e) => setAvatarSeed(e.target.value)}
                  className="flex-1 bg-brand-bgAlt border border-brand-border rounded-xl px-4 py-2.5 text-sm text-brand-text focus:border-brand-green focus:ring-2 focus:ring-brand-green/25 focus:outline-none outline-none transition-all duration-200"
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
            </div>

            <div>
              <span className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Or choose a preset:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAvatarSeed(p)}
                    className={`
                      px-3 py-1.5 text-xs rounded-xl border transition-all duration-150 font-bold cursor-pointer outline-none
                      ${avatarSeed === p 
                        ? 'bg-brand-green/20 text-brand-green border-brand-green' 
                        : 'bg-brand-bgAlt text-brand-muted border-brand-border/40 hover:border-brand-border hover:text-brand-text'
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
      </Card>

      {/* Logout / Sign Out button */}
      <div className="pt-4">
        <Button variant="secondary" onClick={logout} className="w-full py-3.5 text-sm font-bold shadow-md border-brand-border hover:border-red-500/20 hover:text-red-500 hover:bg-red-500/5">
          Sign Out of Account
        </Button>
      </div>
    </div>
  );
}
