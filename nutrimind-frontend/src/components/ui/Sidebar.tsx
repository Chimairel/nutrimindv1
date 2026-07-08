'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import {
  LayoutDashboard,
  Utensils,
  ShoppingCart,
  Users,
  User,
  ClipboardList,
  CheckSquare,
  BookOpen,
  Stethoscope,
  TrendingUp,
  LogOut,
  Brain,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('nutrimind-sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  if (!user) return null;

  const role = user.role;

  // Toggle Collapse State
  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('nutrimind-sidebar-collapsed', String(nextVal));
  };

  // Define nav links dynamically based on user role with Lucide Icons
  const navItemsByRole: Record<'USER' | 'NUTRITIONIST' | 'ADMIN', NavItem[]> = {
    USER: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Meal Plan', href: '/meals', icon: Utensils },
      { label: 'Grocery List', href: '/grocery', icon: ShoppingCart },
      { label: 'Progress', href: '/progress', icon: TrendingUp },
    ],
    NUTRITIONIST: [
      { label: 'Pending Reviews', href: '/nutritionist/reviews', icon: ClipboardList },
      { label: 'Approved Plans', href: '/nutritionist/approved', icon: CheckSquare },
      { label: 'Meal Library', href: '/nutritionist/library', icon: BookOpen },
      { label: 'My Profile', href: '/nutritionist/profile', icon: User },
    ],
    ADMIN: [
      { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Nutritionists', href: '/admin/nutritionists', icon: Stethoscope },
      { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
    ],
  };

  const navItems = navItemsByRole[role] || [];
  const showCollapsed = isMounted && isCollapsed;

  return (
    <aside
      className={`
        hidden md:flex flex-col h-screen border-r border-brand-border bg-brand-surface text-brand-text select-none sticky top-0 transition-all duration-300 ease-in-out
        ${showCollapsed ? 'w-20 px-3 py-6' : 'w-64 p-6'}
        ${className}
      `}
    >
      {/* Brand Logo Header */}
      {showCollapsed ? (
        <div className="flex flex-col items-center gap-4 mb-8">
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-brand-bgAlt border border-brand-border text-brand-muted hover:text-brand-text transition-colors outline-none"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
          <Brain className="h-7 w-7 text-brand-green animate-pulse" />
        </div>
      ) : (
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-brand-green" />
            <div>
              <h1 className="font-extrabold text-base tracking-wider text-brand-green font-display leading-none">NUTRIMIND</h1>
              <span className="text-[9px] tracking-widest text-brand-muted uppercase font-bold">{role} PORTAL</span>
            </div>
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-brand-bgAlt border border-transparent hover:border-brand-border text-brand-muted hover:text-brand-text transition-colors outline-none"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Nav Links List */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center rounded-xl font-semibold tracking-wide text-sm transition-all duration-200 outline-none
                ${showCollapsed ? 'justify-center p-3' : 'gap-3.5 px-4 py-3'}
                ${isActive
                  ? 'bg-brand-green text-white border-2 border-brand-border shadow-md'
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/50 border-2 border-transparent'
                }
              `}
              title={showCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!showCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="border-t border-brand-border pt-4 mt-auto">
        <Link
          href={role === 'NUTRITIONIST' ? '/nutritionist/profile' : '/profile'}
          className={`flex items-center gap-3 p-2 rounded-xl hover:bg-brand-bgAlt/50 transition-colors cursor-pointer group mb-4 ${
            showCollapsed ? 'justify-center' : ''
          }`}
        >
          <Avatar size="sm" src={user.image} fallbackText={user.name} />
          {!showCollapsed && (
            <div className="overflow-hidden flex-1">
              <h4 className="text-sm font-semibold tracking-wide truncate text-brand-text group-hover:text-brand-green transition-colors leading-tight">
                {user.name}
              </h4>
              <span className="text-xs text-brand-muted truncate block">{user.email}</span>
            </div>
          )}
        </Link>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-status-rejected-text/25 text-status-rejected-text hover:bg-status-rejected-bg/25 active:scale-[0.98] transition-all duration-200 text-sm font-semibold outline-none"
          title={showCollapsed ? 'Log Out' : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!showCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
