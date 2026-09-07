'use client';

import React from 'react';
import { BarChart3, LayoutDashboard, Users, Stethoscope, ShieldCheck, Receipt } from 'lucide-react';
import PortalRoleLayout from '@/components/shared/PortalRoleLayout';

const navItems = [
  { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/nutritionists', label: 'Nutritionists', icon: Stethoscope },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/operations', label: 'Operations', icon: ShieldCheck },
  { href: '/admin/compensation', label: 'Pay', icon: Receipt },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalRoleLayout navItems={navItems}>{children}</PortalRoleLayout>;
}
