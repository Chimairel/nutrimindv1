'use client';

import React from 'react';
import { ClipboardList, BookOpen, User, BadgeCheck, Receipt, Utensils } from 'lucide-react';
import PortalRoleLayout from '@/components/shared/PortalRoleLayout';

const navItems = [
  { href: '/nutritionist/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/nutritionist/outside-meals', label: 'Outside meals', icon: Utensils },
  { href: '/nutritionist/approved', label: 'Approved', icon: BadgeCheck },
  { href: '/nutritionist/library', label: 'Library', icon: BookOpen },
  { href: '/nutritionist/compensation', label: 'Pay', icon: Receipt },
  { href: '/nutritionist/profile', label: 'Profile', icon: User },
];

export default function NutritionistLayout({ children }: { children: React.ReactNode }) {
  return <PortalRoleLayout navItems={navItems}>{children}</PortalRoleLayout>;
}
