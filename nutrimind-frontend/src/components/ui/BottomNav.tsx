'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface BottomNavProps {
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  // BottomNav only displays for standard authenticated users in mobile layouts
  if (!user || user.role !== 'USER') return null;

  const items = [
    { label: 'Home', href: '/dashboard', icon: '🏠' },
    { label: 'Meals', href: '/meals', icon: '🍳' },
    { label: 'Grocery', href: '/grocery', icon: '🛒' },
    { label: 'Profile', href: '/profile', icon: '👤' },
  ];

  return (
    <nav
      className={`
        md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#1a1a1e]/90 border-t border-brand-border backdrop-blur-md
        flex items-center justify-around px-4 select-none
        ${className}
      `}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200 outline-none
              ${isActive ? 'text-brand-green font-bold scale-105' : 'text-brand-muted hover:text-brand-text'}
            `}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] tracking-wide leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
