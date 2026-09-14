'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import AvatarSettings from '@/features/profile/AvatarSettings';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { User, Lock, CheckCircle, AlertTriangle, LogOut, Mail, Palette, ShieldCheck, Trash2 } from 'lucide-react';

type ProfilePanel = 'account' | 'security' | 'avatar' | 'privacy';

export default function AccountSettings({ initialPanel = 'account' }: { initialPanel?: ProfilePanel }) {
  const { logout, user, updateUserSession } = useAuth();
  const [activePanel, setActivePanel] = useState<ProfilePanel>(initialPanel);

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
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsDeleting(true);
    setDeletionError(null);
    try {
      await api.delete('/user/account', {
        data: {
          password: deletionPassword,
          confirmation: deletionConfirmation,
        },
      });
      await logout();
    } catch (error: unknown) {
      setDeletionError(getApiErrorMessage(error, 'Account deletion failed.'));
    } finally {
      setIsDeleting(false);
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
      setAccountError(getApiErrorMessage(err, 'Failed to update account settings.'));
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
      setPasswordError(getApiErrorMessage(err, 'Failed to update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return <div className="text-brand-muted text-center mt-20">Please log in to view settings.</div>;
  }

  return (
    <div className="portal-page max-w-5xl space-y-5 text-left text-brand-text">
      <Link href="/profile" className="inline-block text-sm font-semibold text-brand-green">
        ← Profile
      </Link>
      <PortalPageHeader
        icon={User}
        eyebrow="Personal identity"
        title={initialPanel === 'account' ? 'Personal details' : 'Security & privacy'}
        description="Manage your identity, security, and profile appearance from one focused workspace."
        className="mb-6"
      />

      <section className="relative overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface p-5 shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar size="lg" src={user.image} fallbackText={user.name} className="h-20 w-20 rounded-full shadow-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-black tracking-tight text-brand-text">{user.name}</h2>
              <span className="rounded-full bg-brand-green/10 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-brand-green">
                {user.role}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-brand-green">
              <ShieldCheck className="h-3.5 w-3.5" />
              Email and account details
            </p>
          </div>
        </div>
      </section>

      <nav
        className="grid grid-cols-2 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/80 p-1.5 shadow-sm sm:grid-cols-2"
        aria-label="Profile settings sections"
      >
        {(
          [
            ['account', 'Account', User],
            ['security', 'Security', Lock],
            ['avatar', 'Avatar', Palette],
            ['privacy', 'Privacy', Trash2],
          ] as const
        )
          .filter(([value]) =>
            initialPanel === 'account' ? ['account', 'avatar'].includes(value) : ['security', 'privacy'].includes(value)
          )
          .map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActivePanel(value)}
              aria-current={activePanel === value ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/30 ${activePanel === value ? 'bg-brand-accent text-[#07100d] shadow-neon' : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
      </nav>

      {activePanel === 'account' && (
        <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
          <div className="border-b border-brand-border/60 px-5 py-4 sm:px-6">
            <h2 className="font-display text-base font-black text-brand-text">Account information</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Update the name and email shown across your NutriMind workspace.
            </p>
          </div>
          <div className="p-5 sm:p-6">
            {accountSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {accountSuccess}
              </div>
            )}
            {accountError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {accountError}
              </div>
            )}
            <form onSubmit={handleAccountSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id="account-name"
                  name="name"
                  autoComplete="name"
                  label="Display Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  id="account-email"
                  name="email"
                  autoComplete="email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end border-t border-brand-border/60 pt-4">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-6 py-2.5 text-xs font-bold shadow-md"
                >
                  {isSavingAccount ? 'Saving Settings...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {activePanel === 'security' && (
        <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-brand-border/60 bg-brand-bgAlt/55 p-5 lg:border-b-0 lg:border-r sm:p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                <Lock className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-lg font-black text-brand-text">Change password</h2>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                Use a unique password you do not reuse elsewhere. Changing it will protect future sessions.
              </p>
            </div>
            <div className="p-5 sm:p-6">
              {passwordSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <PasswordInput
                  id="current-password"
                  name="currentPassword"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <PasswordInput
                    id="confirm-new-password"
                    name="confirmPassword"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    error={passwordsMismatch ? 'New passwords do not match.' : undefined}
                    required
                  />
                </div>
                <div className="flex justify-end border-t border-brand-border/60 pt-4">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    {isUpdatingPassword ? 'Updating Password...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>
      )}

      <AvatarSettings visible={activePanel === 'avatar'} user={user} updateUserSession={updateUserSession} />

      {activePanel === 'privacy' && (
        <Link
          href="/export"
          className="block rounded-xl border border-brand-border bg-brand-surface p-4 text-sm font-semibold text-brand-green"
        >
          Download my data and nutrition summary →
        </Link>
      )}
      {activePanel === 'privacy' && (
        <Card className="overflow-hidden border-red-500/25 bg-brand-surface p-0 shadow-card">
          <div className="border-b border-red-500/15 p-5 sm:p-6">
            <h2 className="font-display text-base font-black text-red-500">Delete account and health data</h2>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">
              This permanently removes your profile, restrictions, plans, logs, grocery lists, hydration entries, and
              sessions. Download your JSON export first if you need a copy.
            </p>
          </div>
          <form onSubmit={handleDeleteAccount} className="space-y-4 p-5 sm:p-6">
            {deletionError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-bold text-red-500">
                {deletionError}
              </div>
            )}
            <PasswordInput
              id="delete-account-password"
              name="currentPassword"
              autoComplete="current-password"
              label="Current password"
              value={deletionPassword}
              onChange={(event) => setDeletionPassword(event.target.value)}
              required
            />
            <Input
              id="delete-account-confirmation"
              name="confirmation"
              label="Type DELETE MY NUTRIMIND ACCOUNT"
              value={deletionConfirmation}
              onChange={(event) => setDeletionConfirmation(event.target.value)}
              required
            />
            <div className="flex justify-end border-t border-brand-border/60 pt-4">
              <Button
                variant="danger"
                type="submit"
                disabled={isDeleting || deletionConfirmation !== 'DELETE MY NUTRIMIND ACCOUNT'}
              >
                {isDeleting ? 'Deleting account...' : 'Permanently delete account'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <section className="flex flex-col gap-3 rounded-[22px] border border-red-500/15 bg-red-500/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-brand-text">End this session</p>
          <p className="mt-0.5 text-[11px] text-brand-muted">You can sign back in at any time.</p>
        </div>
        <Button
          variant="secondary"
          onClick={logout}
          className="flex items-center justify-center gap-2 border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}
