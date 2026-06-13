'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

export const Navbar: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-brand-border bg-[#0d0d0d]/80 px-6 backdrop-blur-md">
      {/* Brand header for mobile layouts (since Sidebar hides) */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-xl">🧠</span>
        <span className="font-extrabold text-sm tracking-wider text-brand-green font-display">NUTRIMIND</span>
      </div>
      
      {/* Active profile logs on desktop views */}
      <div className="hidden md:block text-xs font-semibold text-brand-muted tracking-wide">
        Welcome back, <span className="text-brand-text">{user.name}</span>
      </div>

      {/* Interactive Toolbar */}
      <div className="flex items-center gap-4 ml-auto">
        <NotificationDropdown />

        {/* Divider */}
        <div className="h-6 w-px bg-brand-border" />

        {/* User Profile Identifier wrapper */}
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" fallbackText={user.name} />
          <span className="hidden sm:inline text-xs font-bold text-brand-text truncate max-w-[120px]">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
