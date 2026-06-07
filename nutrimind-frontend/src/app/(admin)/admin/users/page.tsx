'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  onboardingDone: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async (p: number, s: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (s) params.search = s;
      const res = await api.get('/admin/users', { params });
      if (res.data?.success) {
        setUsers(res.data.data.users);
        setTotal(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-text font-display">Users</h1>
        <span className="text-xs text-brand-muted">{total} total</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 bg-brand-card border border-brand-border rounded-lg px-4 py-2 text-sm text-brand-text focus:border-brand-green focus:outline-none"
        />
        <button type="submit" className="bg-brand-green text-brand-bg px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity">
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="text-center py-12"><span className="text-brand-muted animate-pulse">Loading...</span></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-muted text-xs uppercase border-b border-brand-border">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-center py-3 px-2">Role</th>
                  <th className="text-center py-3 px-2">Verified</th>
                  <th className="text-center py-3 px-2">Onboarded</th>
                  <th className="text-left py-3 px-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-brand-border/40 hover:bg-brand-border/20 transition-colors">
                    <td className="py-3 px-2 text-brand-text font-semibold">{u.name}</td>
                    <td className="py-3 px-2 text-brand-muted">{u.email}</td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={u.role === 'ADMIN' ? 'rejected' : u.role === 'NUTRITIONIST' ? 'verified' : 'user'} className="text-[10px]">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-center">{u.emailVerified ? '✅' : '❌'}</td>
                    <td className="py-3 px-2 text-center">{u.onboardingDone ? '✅' : '⏳'}</td>
                    <td className="py-3 px-2 text-brand-muted text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-xs text-brand-muted hover:text-brand-green disabled:opacity-30 cursor-pointer">
              ← Previous
            </button>
            <span className="text-xs text-brand-muted">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-xs text-brand-muted hover:text-brand-green disabled:opacity-30 cursor-pointer">
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
