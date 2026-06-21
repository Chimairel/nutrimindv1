'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Home, Utensils, ShoppingCart, User } from 'lucide-react';

interface BottomNavProps {
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  // BottomNav only displays for standard authenticated users in mobile layouts
  if (!user || user.role !== 'USER') return null;

  const items = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Meals', href: '/meals', icon: Utensils },
    { label: 'Grocery', href: '/grocery', icon: ShoppingCart },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <nav
      className={`
        md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-brand-surface/90 border-t border-brand-border backdrop-blur-md
        flex items-center justify-around px-4 select-none
        ${className}
      `}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200 outline-none
              ${isActive ? 'text-brand-green font-bold scale-105' : 'text-brand-muted hover:text-brand-text'}
            `}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] tracking-wide leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
