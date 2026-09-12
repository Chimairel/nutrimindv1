'use client';

import React from 'react';
import { DatabaseZap, LayoutDashboard, Users, ShieldCheck, Grid2X2 } from 'lucide-react';
import PortalRoleLayout from '@/components/shared/PortalRoleLayout';

const navItems = [
  { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'People', icon: Users },
  { href: '/admin/data', label: 'Data', icon: DatabaseZap },
  { href: '/admin/operations', label: 'Operations', icon: ShieldCheck },
  { href: '/admin/more', label: 'More', icon: Grid2X2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalRoleLayout navItems={navItems}>{children}</PortalRoleLayout>;
}
