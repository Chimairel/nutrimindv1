'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Home, Soup, ShoppingCart, User } from 'lucide-react';
import { Dock, DockItem, DockIcon, DockLabel } from '@/components/ui/motion';

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
    { label: 'Meals', href: '/meals', icon: Soup },
    { label: 'Groceries', href: '/grocery', icon: ShoppingCart },
    { label: 'Progress', href: '/progress', icon: Activity },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-24px)] md:hidden ${className}`}>
      <Dock
        direction="horizontal"
        distance={110}
        baseSize={44}
        magnification={58}
        className="rounded-[26px] border border-brand-border/70 bg-brand-surface/90 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07100d]/90 dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        ariaLabel="Mobile navigation dock"
      >
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="outline-none"
            >
              <DockItem
                active={isActive}
                className={`transition-colors duration-200 ${
                  isActive
                    ? 'bg-brand-accent text-[#07100d] font-bold shadow-neon'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/80 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10'
                }`}
              >
                <DockLabel>{item.label}</DockLabel>
                <DockIcon>
                  <Icon className={isActive ? 'stroke-[2.5]' : 'stroke-2'} />
                </DockIcon>
              </DockItem>
            </Link>
          );
        })}
      </Dock>
    </div>
  );
};

export default BottomNav;
