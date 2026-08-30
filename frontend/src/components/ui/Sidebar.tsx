'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckSquare2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  HeartPulse,
  TrendingUp,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarTooltipProps {
  id: string;
  label: string;
  placement?: 'side' | 'below';
  suppressed?: boolean;
}

const SidebarTooltip: React.FC<SidebarTooltipProps> = ({ id, label, placement = 'side', suppressed = false }) => (
  <span
    id={id}
    role="tooltip"
    aria-hidden={suppressed || undefined}
    className={`
      pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-white/10 bg-[#17201d]/95
      px-3 py-2 font-display text-[11px] font-semibold tracking-tight text-white opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)]
      backdrop-blur-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100
      group-focus-within:scale-100 group-focus-within:opacity-100
      ${placement === 'side'
        ? 'left-[calc(100%+12px)] top-1/2 -translate-y-1/2 scale-95 origin-left'
        : 'left-0 top-[calc(100%+9px)] -translate-y-1 scale-95'}
      ${suppressed ? '!scale-95 !opacity-0' : ''}
    `}
  >
    {label}
    <span
      aria-hidden="true"
      className={`absolute h-2 w-2 rotate-45 border border-white/10 bg-[#17201d] ${placement === 'side'
        ? '-left-1 top-1/2 -translate-y-1/2 border-r-0 border-t-0'
        : 'left-4 -top-1 border-b-0 border-r-0'}`}
    />
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [suppressedTooltip, setSuppressedTooltip] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setIsCollapsed(localStorage.getItem('nutrimind-sidebar-collapsed') === 'true');
  }, []);

  if (!user) return null;

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    localStorage.setItem('nutrimind-sidebar-collapsed', String(nextValue));
  };

  const navItemsByRole: Record<'USER' | 'NUTRITIONIST' | 'ADMIN', NavItem[]> = {
    USER: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Meal plan', href: '/meals', icon: UtensilsCrossed },
      { label: 'Grocery', href: '/grocery', icon: ShoppingBasket },
      { label: 'Progress', href: '/progress', icon: TrendingUp },
      { label: 'Health profile', href: '/health-profile', icon: HeartPulse },
    ],
    NUTRITIONIST: [
      { label: 'Review queue', href: '/nutritionist/reviews', icon: ClipboardList },
      { label: 'Approved plans', href: '/nutritionist/approved', icon: CheckSquare2 },
      { label: 'Meal library', href: '/nutritionist/library', icon: BookOpen },
      { label: 'My profile', href: '/nutritionist/profile', icon: UserRound },
    ],
    ADMIN: [
      { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Nutritionists', href: '/admin/nutritionists', icon: Stethoscope },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { label: 'Operations', href: '/admin/operations', icon: ShieldCheck },
    ],
  };

  const navItems = navItemsByRole[user.role] || [];
  const collapsed = isMounted && isCollapsed;
  const homeHref = user.role === 'USER'
    ? '/dashboard'
    : user.role === 'NUTRITIONIST'
      ? '/nutritionist/reviews'
      : '/admin/overview';
  const profileHref = user.role === 'NUTRITIONIST'
    ? '/nutritionist/profile'
    : user.role === 'USER'
      ? '/profile'
      : '/admin/overview';
  const profileActive = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const roleLabel = user.role === 'NUTRITIONIST' ? 'Clinical portal' : user.role === 'ADMIN' ? 'Control center' : 'Personal workspace';

  return (
    <aside
      className={`
        relative z-30 hidden h-full shrink-0 flex-col overflow-visible rounded-[30px] border border-white/10
        bg-[linear-gradient(180deg,#0d1713_0%,#07100d_58%,#050a08_100%)] text-white shadow-[0_28px_80px_rgba(1,8,5,0.32)]
        transition-[width,padding] duration-300 ease-out md:flex
        ${collapsed ? 'w-[84px] px-3 py-4' : 'w-[280px] p-4'}
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
        <div className="absolute -right-20 -top-16 h-52 w-52 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-brand-cyan/10 blur-3xl" />
      </div>

      <div className={`relative flex items-center px-1 pb-5 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        {collapsed ? (
          <div className="group relative shrink-0">
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Open sidebar"
              aria-describedby="sidebar-open-tooltip"
              aria-controls="nutrimind-sidebar-navigation"
              aria-expanded={false}
              className="group/sidebar-toggle relative flex h-11 w-11 cursor-ew-resize items-center justify-center rounded-2xl border border-brand-accent/25 bg-brand-accent text-[#07100d] shadow-neon outline-none transition-all hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1713]"
            >
              <BrainCircuit className="h-5 w-5 transition-all duration-150 group-hover/sidebar-toggle:scale-75 group-hover/sidebar-toggle:opacity-0 group-focus-visible/sidebar-toggle:scale-75 group-focus-visible/sidebar-toggle:opacity-0" />
              <PanelLeftOpen className="absolute h-5 w-5 scale-75 opacity-0 transition-all duration-150 group-hover/sidebar-toggle:scale-100 group-hover/sidebar-toggle:opacity-100 group-focus-visible/sidebar-toggle:scale-100 group-focus-visible/sidebar-toggle:opacity-100" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0d1713] bg-brand-cyan transition-opacity group-hover/sidebar-toggle:opacity-0 group-focus-visible/sidebar-toggle:opacity-0" />
            </button>
            <SidebarTooltip id="sidebar-open-tooltip" label="Open sidebar" />
          </div>
        ) : (
          <>
            <Link
              href={homeHref}
              className="flex min-w-0 items-center gap-3 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand-accent/40"
              aria-label="NutriMind home"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-accent/25 bg-brand-accent text-[#07100d] shadow-neon">
                <BrainCircuit className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0d1713] bg-brand-cyan" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-extrabold tracking-[0.16em]">NUTRIMIND</span>
                <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">{roleLabel}</span>
              </span>
            </Link>

            <div className="group relative ml-auto shrink-0">
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label="Close sidebar"
                aria-describedby="sidebar-close-tooltip"
                aria-controls="nutrimind-sidebar-navigation"
                aria-expanded={true}
                className="flex h-10 w-10 cursor-ew-resize items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
              >
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
              <SidebarTooltip id="sidebar-close-tooltip" label="Close sidebar" placement="below" />
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="mb-3 flex items-center justify-between px-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Workspace</span>
          <Activity className="h-3.5 w-3.5 text-brand-cyan/60" />
        </div>
      )}

      <nav id="nutrimind-sidebar-navigation" className="relative flex flex-1 flex-col gap-1.5" aria-label={`${user.role.toLowerCase()} navigation`}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSuppressedTooltip(item.href)}
              onBlur={() => setSuppressedTooltip((current) => current === item.href ? null : current)}
              onMouseLeave={(event) => {
                if (suppressedTooltip === item.href) event.currentTarget.blur();
                setSuppressedTooltip((current) => current === item.href ? null : current);
              }}
              aria-label={collapsed ? item.label : undefined}
              aria-describedby={collapsed && !active ? `sidebar-nav-${item.href.replace(/\W+/g, '-')}` : undefined}
              aria-current={active ? 'page' : undefined}
              className={`
                group relative flex min-h-12 items-center rounded-2xl outline-none transition-all duration-200
                ${collapsed ? 'justify-center px-3' : 'gap-3 px-3.5'}
                ${active
                  ? 'bg-brand-accent text-[#07100d] shadow-neon'
                  : 'text-white/55 hover:bg-white/[0.055] hover:text-white'}
              `}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'stroke-[2.5]' : ''}`} />
              {!collapsed && <span className="font-display text-[13px] font-semibold tracking-tight">{item.label}</span>}
              {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#07100d]/60" />}
              {collapsed && (
                <SidebarTooltip
                  id={`sidebar-nav-${item.href.replace(/\W+/g, '-')}`}
                  label={item.label}
                  suppressed={active || suppressedTooltip === item.href}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-4 border-t border-white/[0.08] pt-4">
        <Link
          href="/docs"
          aria-label={collapsed ? 'Product docs' : undefined}
          aria-describedby={collapsed ? 'sidebar-docs-tooltip' : undefined}
          className={`group relative mb-3 flex items-center rounded-2xl border border-transparent text-white/45 transition hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-brand-cyan ${collapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5'}`}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs font-semibold">Product docs</span>}
          {collapsed && <SidebarTooltip id="sidebar-docs-tooltip" label="Product docs" />}
        </Link>

        <Link
          href={profileHref}
          onClick={() => setSuppressedTooltip('profile')}
          onBlur={() => setSuppressedTooltip((current) => current === 'profile' ? null : current)}
          onMouseLeave={(event) => {
            if (suppressedTooltip === 'profile') event.currentTarget.blur();
            setSuppressedTooltip((current) => current === 'profile' ? null : current);
          }}
          aria-label={collapsed ? `Profile: ${user.name}` : undefined}
          aria-describedby={collapsed && !profileActive ? 'sidebar-profile-tooltip' : undefined}
          aria-current={profileActive ? 'page' : undefined}
          className={`group relative flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] transition hover:bg-white/[0.065] ${collapsed ? 'justify-center p-1.5' : 'gap-3 p-2'}`}
        >
          <Avatar size="sm" src={user.image} fallbackText={user.name} className="h-9 w-9 rounded-xl" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/90">{user.name}</p>
              <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-white/35">{user.role}</p>
            </div>
          )}
          {collapsed && (
            <SidebarTooltip
              id="sidebar-profile-tooltip"
              label={`Profile · ${user.name}`}
              suppressed={profileActive || suppressedTooltip === 'profile'}
            />
          )}
        </Link>

        <button
          type="button"
          onClick={() => logout()}
          aria-label={collapsed ? 'Log out' : undefined}
          aria-describedby={collapsed ? 'sidebar-logout-tooltip' : undefined}
          className={`group relative mt-2 flex w-full items-center rounded-xl text-red-300/70 outline-none transition hover:bg-red-500/10 hover:text-red-200 focus:ring-2 focus:ring-red-400/30 ${collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5'}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs font-semibold">Log out</span>}
          {collapsed && <SidebarTooltip id="sidebar-logout-tooltip" label="Log out" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
