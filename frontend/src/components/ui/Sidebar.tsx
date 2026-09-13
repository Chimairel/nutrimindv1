'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BrainCircuit, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { primaryWorkspaceTools } from '@/lib/workspace-navigation';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';
import { Dock, DockItem, DockIcon, DockLabel, DockAvatar } from '@/components/ui/motion';

interface SidebarProps {
  className?: string;
}

interface SidebarTooltipProps {
  id: string;
  label: string;
  placement?: 'side' | 'below';
}

const SidebarTooltip: React.FC<SidebarTooltipProps> = ({ id, label, placement = 'side' }) => (
  <span
    id={id}
    role="tooltip"
    className={`
      pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-white/10 bg-[#17201d]/95
      px-3 py-2 font-display text-[11px] font-semibold tracking-tight text-white opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)]
      backdrop-blur-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100
      group-focus-within:scale-100 group-focus-within:opacity-100
      ${
        placement === 'side'
          ? 'left-[calc(100%+12px)] top-1/2 -translate-y-1/2 scale-95 origin-left'
          : 'left-0 top-[calc(100%+9px)] -translate-y-1 scale-95'
      }
    `}
  >
    {label}
    <span
      aria-hidden="true"
      className={`absolute h-2 w-2 rotate-45 border border-white/10 bg-[#17201d] ${
        placement === 'side'
          ? '-left-1 top-1/2 -translate-y-1/2 border-r-0 border-t-0'
          : 'left-4 -top-1 border-b-0 border-r-0'
      }`}
    />
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRailHovered, setIsRailHovered] = useState(false);

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

  const navItems = primaryWorkspaceTools[user.role].filter((item) => item.href !== '/profile');
  const collapsed = isMounted && isCollapsed;
  const homeHref =
    user.role === 'USER' ? '/dashboard' : user.role === 'NUTRITIONIST' ? '/nutritionist/reviews' : '/admin/overview';
  const profileHref =
    user.role === 'NUTRITIONIST' ? '/nutritionist/profile' : user.role === 'USER' ? '/profile' : '/admin/overview';
  const profileActive = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const roleLabel =
    user.role === 'NUTRITIONIST' ? 'Clinical portal' : user.role === 'ADMIN' ? 'Control center' : 'Personal workspace';

  return (
    <aside
      onMouseEnter={() => setIsRailHovered(true)}
      onMouseLeave={() => setIsRailHovered(false)}
      className={`
        relative z-30 hidden shrink-0 flex-col overflow-visible rounded-[30px] border border-white/10
        bg-[linear-gradient(180deg,#0d1713_0%,#07100d_58%,#050a08_100%)] text-white shadow-[0_28px_80px_rgba(1,8,5,0.32)]
        transition-all duration-300 ease-out md:flex
        ${
          collapsed
            ? `self-start origin-top w-[68px] px-2 py-3.5 ${
                isRailHovered
                  ? 'h-full shadow-[0_32px_90px_rgba(1,8,5,0.48)]'
                  : 'h-[95%] shadow-[0_28px_80px_rgba(1,8,5,0.32)]'
              }`
            : 'h-full w-[248px] p-4'
        }
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
        <div className="absolute -right-20 -top-16 h-52 w-52 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-brand-cyan/10 blur-3xl" />
      </div>

      {collapsed ? (
        <Dock
          direction="vertical"
          distance={85}
          baseSize={36}
          magnification={46}
          className="relative z-10 flex h-full w-full flex-col items-center justify-between py-1"
          ariaLabel={`${user.role.toLowerCase()} navigation`}
        >
          {/* 1. TOP GROUP: Logo & Expand Toggle */}
          <div className="flex shrink-0 flex-col items-center pt-0.5">
            <DockItem
              onClick={toggleCollapse}
              aria-label="Open sidebar"
              className="group/sidebar-toggle relative cursor-ew-resize rounded-2xl border border-brand-accent/25 bg-brand-accent text-[#07100d] shadow-neon"
            >
              <DockLabel>Open sidebar</DockLabel>
              <DockIcon>
                <div className="relative flex h-full w-full items-center justify-center">
                  <BrainCircuit className="h-full w-full transition-all duration-150 group-hover/sidebar-toggle:scale-75 group-hover/sidebar-toggle:opacity-0" />
                  <PanelLeftOpen className="absolute h-full w-full scale-75 opacity-0 transition-all duration-150 group-hover/sidebar-toggle:scale-100 group-hover/sidebar-toggle:opacity-100" />
                </div>
              </DockIcon>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#0d1713] bg-brand-cyan transition-opacity group-hover/sidebar-toggle:opacity-0" />
            </DockItem>
          </div>

          {/* 2. CENTER GROUP: Navigation Tabs */}
          <nav
            id="nutrimind-sidebar-navigation"
            className="my-auto flex shrink-0 flex-col items-center gap-1.5 py-2"
            aria-label={`${user.role.toLowerCase()} tabs`}
          >
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === '/nutritionist/reviews' &&
                  ['/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className="flex shrink-0 items-center justify-center outline-none"
                >
                  <DockItem
                    active={active}
                    className={`transition-colors duration-200 ${
                      active
                        ? 'bg-brand-accent text-[#07100d] font-bold shadow-neon'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    <DockLabel>{item.label}</DockLabel>
                    <DockIcon>
                      <Icon className={active ? 'stroke-[2.5]' : 'stroke-2'} />
                    </DockIcon>
                  </DockItem>
                </Link>
              );
            })}
          </nav>

          {/* 3. BOTTOM GROUP: Secondary actions (Logout) & Profile Avatar */}
          <div className="mt-auto flex shrink-0 flex-col items-center gap-2 pb-0.5">
            <div className="h-px w-6 bg-white/[0.08] mb-0.5" />

            <DockItem
              onClick={() => logout()}
              aria-label="Log out"
              className="text-red-500 hover:bg-red-500/15 hover:text-red-400 transition-colors duration-200"
            >
              <DockLabel>Log out</DockLabel>
              <DockIcon>
                <LogOut className="stroke-[2.25] text-red-500 hover:text-red-400" />
              </DockIcon>
            </DockItem>

            <Link
              href={profileHref}
              aria-label={`Profile: ${user.name}`}
              aria-current={profileActive ? 'page' : undefined}
              className="flex shrink-0 items-center justify-center outline-none"
            >
              <DockItem
                active={profileActive}
                className={`rounded-full p-0.5 transition-all duration-200 ${
                  profileActive
                    ? 'ring-2 ring-brand-accent shadow-neon'
                    : 'hover:ring-2 hover:ring-white/30'
                }`}
              >
                <DockLabel>Profile · {user.name}</DockLabel>
                <DockAvatar>
                  <Avatar
                    size="sm"
                    src={user.image}
                    fallbackText={user.name}
                    className="!h-full !w-full rounded-full"
                  />
                </DockAvatar>
              </DockItem>
            </Link>
          </div>
        </Dock>
      ) : (
        <>
          {/* Expanded Header */}
          <div className="relative flex items-center justify-between gap-3 px-1 pb-5">
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
                <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                  {roleLabel}
                </span>
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
          </div>

          <div className="mb-3 flex items-center justify-between px-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Workspace</span>
            <Activity className="h-3.5 w-3.5 text-brand-cyan/60" />
          </div>

          <nav
            id="nutrimind-sidebar-navigation"
            className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin [scrollbar-color:rgba(255,255,255,0.15)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent"
            aria-label={`${user.role.toLowerCase()} navigation`}
          >
            {navItems.map((item, index) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === '/nutritionist/reviews' &&
                  ['/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname));
              const Icon = item.icon;
              return (
                <React.Fragment key={item.href}>
                  {user.role === 'ADMIN' && (index === 0 || navItems[index - 1].group !== item.group) && (
                    <p className="px-3 pt-3 pb-1 text-xs font-semibold text-white/60">{item.group}</p>
                  )}
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-3.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d] ${
                      active ? 'text-[#07100d]' : 'text-white/55 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    {active && (
                      <MotionActiveIndicator
                        layoutId="sidebar-active-nav-indicator"
                        className="rounded-2xl bg-brand-accent shadow-neon"
                      />
                    )}
                    <span className="relative z-10 flex w-full items-center gap-3">
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'stroke-[2.5]' : ''}`} />
                      <span className="font-display text-[13px] font-semibold tracking-tight">{item.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#07100d]/60" />}
                    </span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="relative mt-auto border-t border-white/[0.08] pt-4">
            <Link
              href={profileHref}
              aria-label={`Profile: ${user.name}`}
              aria-current={profileActive ? 'page' : undefined}
              className="group relative flex items-center gap-3 rounded-2xl p-2 outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-brand-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d]"
            >
              <Avatar
                size="sm"
                src={user.image}
                fallbackText={user.name}
                className="h-9 w-9 rounded-full transition-transform duration-200 group-hover:scale-105"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white/90">{user.name}</p>
                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-white/35">{user.role}</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              aria-label="Log out"
              className="group relative mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-red-500 outline-none transition hover:bg-red-500/15 hover:text-red-400 focus:ring-2 focus:ring-red-500/30"
            >
              <LogOut className="h-4 w-4 shrink-0 stroke-[2.25] text-red-500 transition-colors group-hover:text-red-400" />
              <span className="text-xs font-semibold text-red-500 transition-colors group-hover:text-red-400">
                Log out
              </span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar;
