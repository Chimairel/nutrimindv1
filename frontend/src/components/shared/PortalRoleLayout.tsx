'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ReviewNavigation from './ReviewNavigation';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import Navbar from '@/components/shared/Navbar';

export interface PortalMobileNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export default function PortalRoleLayout({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems: PortalMobileNavItem[];
}) {
  const pathname = usePathname();

  return (
    <RouteGuard>
      <div className="portal-shell flex h-screen w-full p-0 md:p-4">
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col md:pl-4">
          <Navbar />
          {['/nutritionist/reviews', '/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname) && (
            <ReviewNavigation />
          )}
          <main className="portal-main custom-scrollbar relative flex-1 overflow-y-auto pb-24 md:pb-4">{children}</main>
        </div>
        <nav
          aria-label="Main navigation"
          className="fixed bottom-3 left-3 right-3 z-40 flex h-16 items-center gap-1 overflow-x-auto rounded-[22px] border border-white/10 bg-[#07100d]/95 px-2 shadow-[0_18px_45px_rgba(1,8,5,0.38)] backdrop-blur-xl md:hidden"
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === '/admin/users' && pathname === '/admin/nutritionists') ||
              (item.href === '/admin/data' && pathname === '/admin/images') ||
              (item.href === '/admin/more' && ['/admin/analytics', '/admin/compensation'].includes(pathname)) ||
              (item.href === '/nutritionist/reviews' &&
                ['/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-bold transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-cyan ${
                  isActive
                    ? 'bg-brand-accent text-[#07100d] shadow-neon'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </RouteGuard>
  );
}
