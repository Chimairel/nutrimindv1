'use client';

import React, { useEffect, useState } from 'react';
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RotateCcw, Search, Users, XCircle } from 'lucide-react';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async (requestedPage: number, query: string) => {
    setIsLoading(true);
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
    fetchUsers(1, search);
  };

  const toggleSuspension = async (user: UserRow) => {
    const reason = user.isSuspended
      ? undefined
      : window.prompt('Reason for suspension (visible in the audit log):')?.trim();
    if (!user.isSuspended && !reason) return;
    await api.patch(`/admin/users/${user.id}/suspension`, {
      suspended: !user.isSuspended,
      reason,
    });
    await fetchUsers(page, search);
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
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email..." className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/70 pl-10 pr-4 text-sm text-brand-text outline-none transition focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10" />
        </div>
        <button type="submit" className="rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-0.5">Search</button>
      </form>

      {isLoading ? (
        <div className="py-16 text-center"><span className="animate-pulse text-brand-muted">Loading accounts...</span></div>
      ) : (
        <div className="portal-table-shell">
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
                    <td className="px-5 py-4 text-center">{user.emailVerified ? <CheckCircle2 className="mx-auto h-4 w-4 text-brand-green" /> : <XCircle className="mx-auto h-4 w-4 text-red-400" />}</td>
                    <td className="px-5 py-4 text-center">{user.onboardingDone ? <CheckCircle2 className="mx-auto h-4 w-4 text-brand-green" /> : <Clock3 className="mx-auto h-4 w-4 text-amber-500" />}</td>
                    <td className="px-5 py-4 text-xs text-brand-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleSuspension(user)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold transition ${user.isSuspended ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/15' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
                        title={user.suspensionReason || undefined}
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
    </div>
  );
}
