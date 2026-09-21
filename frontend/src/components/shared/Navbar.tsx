'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/context/ThemeContext';
import NotificationDropdown from '@/components/shared/NotificationDropdown';
import { usePathname } from 'next/navigation';
import { workspaceTools } from '@/lib/workspace-navigation';
import { WorkspaceTools } from './WorkspaceTools';

import Breadcrumb1, { type BreadcrumbSegment } from '@/components/watermelon/breadcrumb-1';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';

const getBreadcrumbSegments = (
  pathname: string,
  role: 'USER' | 'NUTRITIONIST' | 'ADMIN',
  subTab?: string | null
): readonly BreadcrumbSegment[] => {
  if (role === 'USER') {
    if (pathname === '/dashboard') {
      return [{ label: 'Dashboard', current: true }];
    }
    if (pathname.startsWith('/dashboard/')) {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Meal Details', current: true },
      ];
    }
    if (pathname === '/meals') {
      let tabLabel = 'Plan';
      if (subTab) {
        const s = subTab.toLowerCase();
        if (s === 'history') tabLabel = 'History';
        else if (s === 'library') tabLabel = 'Library';
        else if (s === 'plan') tabLabel = 'Plan';
        else tabLabel = subTab.charAt(0).toUpperCase() + subTab.slice(1);
      }
      return [
        { label: 'Meals', href: '/meals' },
        { label: tabLabel, current: true },
      ];
    }
    if (pathname.startsWith('/meals/')) {
      return [
        { label: 'Meals', href: '/meals' },
        { label: 'Details', current: true },
      ];
    }
    if (pathname === '/grocery') {
      return [{ label: 'Groceries', current: true }];
    }
    if (pathname === '/progress') {
      let tabLabel = 'Overview';
      if (subTab) {
        const s = subTab.toLowerCase();
        if (s === 'history' || s === 'adherence') tabLabel = 'Adherence';
        else if (s === 'profile') tabLabel = 'Profile';
        else if (s === 'safety') tabLabel = 'Safety';
        else if (s === 'overview') tabLabel = 'Overview';
        else tabLabel = subTab.charAt(0).toUpperCase() + subTab.slice(1);
      }
      return [
        { label: 'Progress', href: '/progress' },
        { label: tabLabel, current: true },
      ];
    }
    if (pathname === '/progress/reports') {
      return [
        { label: 'Progress', href: '/progress' },
        { label: 'Reports', current: true },
      ];
    }
    if (pathname === '/profile') {
      return [{ label: 'Profile', current: true }];
    }
    if (pathname === '/profile/personal') {
      return [
        { label: 'Profile', href: '/profile' },
        { label: 'Personal Details', current: true },
      ];
    }
    if (pathname === '/profile/health') {
      return [
        { label: 'Profile', href: '/profile' },
        { label: 'Health & Goals', current: true },
      ];
    }
    if (pathname === '/profile/planning') {
      return [
        { label: 'Profile', href: '/profile' },
        { label: 'Food & Planning', current: true },
      ];
    }
    if (pathname === '/profile/security') {
      return [
        { label: 'Profile', href: '/profile' },
        { label: 'Security & Privacy', current: true },
      ];
    }
    if (pathname === '/export') {
      return [{ label: 'Exports', current: true }];
    }
    if (pathname === '/profile/nutrition-report') {
      return [
        { label: 'Profile', href: '/profile' },
        { label: 'Nutrition Guidance', current: true },
      ];
    }
    if (pathname === '/nutrition-report') {
      return [{ label: 'Nutrition Report', current: true }];
    }
  }

  if (role === 'NUTRITIONIST') {
    if (pathname === '/nutritionist/reviews') {
      return [{ label: 'Reviews', current: true }];
    }
    if (pathname.startsWith('/nutritionist/reviews/')) {
      return [
        { label: 'Reviews', href: '/nutritionist/reviews' },
        { label: 'Plan Audit', current: true },
      ];
    }
    if (pathname === '/nutritionist/outside-meals') {
      return [{ label: 'Outside Meals', current: true }];
    }
    if (pathname === '/nutritionist/library') {
      return [{ label: 'Meal Library', current: true }];
    }
    if (pathname === '/nutritionist/approved') {
      return [{ label: 'Approved Archive', current: true }];
    }
    if (pathname === '/nutritionist/profile') {
      return [{ label: 'Profile', current: true }];
    }
  }

  if (role === 'ADMIN') {
    if (pathname === '/admin/overview') {
      return [{ label: 'Overview', current: true }];
    }
    if (pathname === '/admin/users') {
      return [{ label: 'Users', current: true }];
    }
    if (pathname.startsWith('/admin/users/')) {
      return [
        { label: 'Users', href: '/admin/users' },
        { label: 'User Details', current: true },
      ];
    }
    if (pathname === '/admin/nutritionists') {
      return [{ label: 'Nutritionists', current: true }];
    }
    if (pathname === '/admin/analytics') {
      return [{ label: 'Analytics', current: true }];
    }
    if (pathname === '/admin/images') {
      return [{ label: 'Media Library', current: true }];
    }
  }

  const matchedTool = [...workspaceTools[role]]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tool) => pathname === tool.href || pathname.startsWith(tool.href + '/'));

  if (matchedTool) {
    const isExact = pathname === matchedTool.href;
    const toolLabel = matchedTool.label === 'Home' ? 'Dashboard' : matchedTool.label;
    if (isExact) {
      return [{ label: toolLabel, current: true }];
    }
    return [
      { label: toolLabel, href: matchedTool.href },
      { label: 'Details', current: true },
    ];
  }

  return [{ label: 'Dashboard', current: true }];
};

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const { subTab } = useBreadcrumb();

  if (!user) return null;

  const segments = getBreadcrumbSegments(pathname, user.role, subTab);

  return (
    <header className="relative z-30 flex min-h-[60px] w-full shrink-0 items-center justify-between gap-3 border-b border-brand-border/50 bg-brand-surface/70 px-4 backdrop-blur-xl md:px-5">
      <div className="min-w-0 flex items-center">
        <Breadcrumb1 segments={segments} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <WorkspaceTools role={user.role} />
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-brand-border/70 bg-brand-surface/75 text-brand-muted shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green/40"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <NotificationDropdown />
      </div>
    </header>
  );
};

export default Navbar;
