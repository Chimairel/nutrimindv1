'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  // Define nav links dynamically based on user role
  const navItemsByRole: Record<'USER' | 'NUTRITIONIST' | 'ADMIN', NavItem[]> = {
    USER: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { label: 'Meal Plan', href: '/meals', icon: '🍽️' },
      { label: 'Grocery List', href: '/grocery', icon: '🛒' },
      { label: 'Meal History', href: '/history', icon: '📜' },
      { label: 'Nutritionists', href: '/nutritionists', icon: '👥' },
      { label: 'Profile', href: '/profile', icon: '👤' },
    ],
    NUTRITIONIST: [
      { label: 'Pending Reviews', href: '/nutritionist/reviews', icon: '📋' },
      { label: 'Approved Plans', href: '/nutritionist/approved', icon: '✅' },
      { label: 'My Patients', href: '/nutritionist/patients', icon: '👥' },
      { label: 'Meal Library', href: '/nutritionist/library', icon: '📚' },
      { label: 'My Profile', href: '/nutritionist/profile', icon: '👤' },
    ],
    ADMIN: [
      { label: 'Overview', href: '/admin/overview', icon: '📊' },
      { label: 'Users', href: '/admin/users', icon: '👥' },
      { label: 'Nutritionists', href: '/admin/nutritionists', icon: '👩‍⚕️' },
      { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
    ],
  };

  const navItems = navItemsByRole[role] || [];

  return (
    <aside 
      className={`
        hidden md:flex flex-col w-64 h-screen border-r border-brand-border bg-brand-surface text-brand-text p-6 select-none sticky top-0
        ${className}
      `}
    >
      {/* Brand Logo Header */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="font-extrabold text-lg tracking-wider text-brand-green font-display">NUTRIMIND</h1>
          <span className="text-[10px] tracking-widest text-brand-muted uppercase font-bold">{role} PORTAL</span>
        </div>
      </div>

      {/* Nav Links List */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold tracking-wide text-sm transition-all duration-200 outline-none
                ${isActive 
                  ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/50 border border-transparent'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="border-t border-brand-border pt-4 mt-auto">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-bgAlt text-brand-green font-bold text-sm">
            {user.name[0]?.toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold tracking-wide truncate text-brand-text leading-tight">{user.name}</h4>
            <span className="text-xs text-brand-muted truncate block">{user.email}</span>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-status-rejected-text/20 text-status-rejected-text hover:bg-status-rejected-bg/25 active:scale-[0.98] transition-all duration-200 text-sm font-semibold outline-none"
        >
          <span>🚪</span>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
