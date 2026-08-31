'use client';

import React, { useEffect, useState } from 'react';
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RotateCcw, Search, Users, XCircle } from 'lucide-react';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useAuth } from '@/hooks/useAuth';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  onboardingDone: boolean;
  createdAt: string;
  isSuspended: boolean;
  suspensionReason?: string | null;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const fetchUsers = async (requestedPage: number, query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: requestedPage, limit: 20 };
      if (query) params.search = query;
      const response = await api.get('/admin/users', { params });
      if (response.data?.success) {
        setUsers(response.data.data.users);
        setTotal(response.data.data.total);
        setTotalPages(response.data.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Account records could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, search]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openAccessDialog = (user: UserRow) => {
    setSelectedUser(user);
    setSuspensionReason('');
    setError(null);
  };

  const closeAccessDialog = () => {
    if (isUpdatingAccess) return;
    setSelectedUser(null);
    setSuspensionReason('');
  };

  const confirmAccessChange = async () => {
    if (!selectedUser || (!selectedUser.isSuspended && !suspensionReason.trim())) return;
    setIsUpdatingAccess(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${selectedUser.id}/suspension`, {
        suspended: !selectedUser.isSuspended,
        reason: selectedUser.isSuspended ? undefined : suspensionReason.trim(),
      });
      closeAccessDialog();
      await fetchUsers(page, search);
    } catch (requestError) {
      console.error('Failed to update account access:', requestError);
      setError('Account access could not be updated. Please try again.');
    } finally {
      setIsUpdatingAccess(false);
      setSelectedUser(null);
    }
  };

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Users}
        eyebrow="Identity directory"
        title="User management"
        description="Inspect account roles, verification state, onboarding progress, and membership across the platform."
        meta={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{total} accounts</span>}
      />

      <form onSubmit={handleSearch} className="portal-filter-panel flex gap-2 p-3">
        <div className="relative flex-1">
          <label htmlFor="admin-user-search" className="sr-only">Search accounts by name or email</label>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input id="admin-user-search" name="search" type="text" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name or email..." className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/70 pl-10 pr-4 text-sm text-brand-text outline-none transition focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10" />
        </div>
        <button type="submit" className="rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-0.5">Search</button>
      </form>

      {error && <p role="alert" className="rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">{error}</p>}

      {isLoading ? (
        <div className="py-16 text-center"><span className="animate-pulse text-brand-muted">Loading accounts...</span></div>
      ) : (
        <div className="portal-table-shell">
          <p className="border-b border-brand-border/50 px-5 py-3 text-[10px] font-semibold text-brand-muted md:hidden">Swipe horizontally to inspect verification, onboarding, and access controls.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#07100d] text-white">
                <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
                  <th className="px-5 py-4 text-left">Name</th><th className="px-5 py-4 text-left">Email</th><th className="px-5 py-4 text-center">Role</th><th className="px-5 py-4 text-center">Verified</th><th className="px-5 py-4 text-center">Onboarded</th><th className="px-5 py-4 text-left">Joined</th><th className="px-5 py-4 text-right">Access</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-brand-border/45 transition last:border-0 hover:bg-brand-green/[0.035]">
                    <td className="px-5 py-4 font-semibold text-brand-text">{user.name}</td>
                    <td className="px-5 py-4 text-brand-muted">{user.email}</td>
                    <td className="px-5 py-4 text-center"><Badge variant={user.role === 'ADMIN' ? 'rejected' : user.role === 'NUTRITIONIST' ? 'verified' : 'user'}>{user.role}</Badge></td>
                    <td className="px-5 py-4 text-center">{user.emailVerified ? <CheckCircle2 aria-label="Email verified" className="mx-auto h-4 w-4 text-brand-green" /> : <XCircle aria-label="Email not verified" className="mx-auto h-4 w-4 text-red-400" />}</td>
                    <td className="px-5 py-4 text-center">{user.onboardingDone ? <CheckCircle2 aria-label="Onboarding complete" className="mx-auto h-4 w-4 text-brand-green" /> : <Clock3 aria-label="Onboarding incomplete" className="mx-auto h-4 w-4 text-amber-500" />}</td>
                    <td className="px-5 py-4 text-xs text-brand-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openAccessDialog(user)}
                        disabled={user.id === currentUser?.userId}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold transition ${user.isSuspended ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/15' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
                        title={user.id === currentUser?.userId ? 'You cannot suspend your own administrator account.' : user.suspensionReason || undefined}
                      >
                        {user.isSuspended ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        {user.isSuspended ? 'Reinstate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-brand-border/50 px-5 py-4">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="flex items-center gap-2 text-xs font-semibold text-brand-muted transition hover:text-brand-green disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Previous</button>
            <span className="font-mono text-[9px] uppercase tracking-wider text-brand-muted">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="flex items-center gap-2 text-xs font-semibold text-brand-muted transition hover:text-brand-green disabled:opacity-30">Next<ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <Modal
        isOpen={selectedUser !== null}
        onClose={closeAccessDialog}
        title={selectedUser?.isSuspended ? 'Reinstate account' : 'Suspend account'}
        description={selectedUser ? `${selectedUser.name} · ${selectedUser.email}` : undefined}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" type="button" onClick={closeAccessDialog} disabled={isUpdatingAccess}>Cancel</Button>
            <Button
              variant={selectedUser?.isSuspended ? 'primary' : 'danger'}
              type="button"
              onClick={confirmAccessChange}
              disabled={!selectedUser?.isSuspended && !suspensionReason.trim()}
              isLoading={isUpdatingAccess}
            >
              {selectedUser?.isSuspended ? 'Reinstate account' : 'Suspend account'}
            </Button>
          </>
        )}
      >
        {selectedUser?.isSuspended ? (
          <p className="text-sm text-brand-muted">This restores the account&apos;s access immediately.</p>
        ) : (
          <div>
            <label htmlFor="suspension-reason" className="mb-2 block text-xs font-bold text-brand-text">Reason for suspension</label>
            <textarea
              id="suspension-reason"
              value={suspensionReason}
              onChange={(event) => setSuspensionReason(event.target.value)}
              maxLength={240}
              rows={4}
              placeholder="Explain why access is being suspended…"
              className="w-full resize-none rounded-2xl border border-brand-border bg-brand-bgAlt px-4 py-3 text-sm text-brand-text outline-none focus:border-red-500/60 focus:ring-4 focus:ring-red-500/10"
            />
            <p className="mt-2 text-[10px] text-brand-muted">This reason is recorded in the administrative audit log.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
