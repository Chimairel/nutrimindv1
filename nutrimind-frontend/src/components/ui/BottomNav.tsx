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
        fixed bottom-3 left-3 right-3 z-40 flex h-16 select-none items-center justify-around rounded-[22px]
        border border-white/10 bg-[#07100d]/95 px-3 shadow-[0_18px_45px_rgba(1,8,5,0.38)] backdrop-blur-xl md:hidden
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
              relative flex h-[52px] w-16 flex-col items-center justify-center gap-1 rounded-2xl outline-none transition-all duration-200
              ${isActive ? 'bg-brand-accent text-[#07100d] font-bold shadow-neon' : 'text-white/45 hover:bg-white/5 hover:text-white'}
            `}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] tracking-wide leading-none font-display">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
