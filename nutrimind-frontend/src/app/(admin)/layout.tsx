'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import Navbar from '@/components/shared/Navbar';
import { BarChart3, LayoutDashboard, Users, Stethoscope } from 'lucide-react';

const navItems = [
  { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/nutritionists', label: 'Nutritionists', icon: Stethoscope },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RouteGuard>
      <div className="portal-shell flex h-screen w-full p-0 md:p-4">
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col md:pl-4">
          <Navbar />
          <main className="portal-main custom-scrollbar relative flex-1 overflow-y-auto pb-24 md:pb-4">
            {children}
          </main>
        </div>

        {/* Mobile Nav */}
        <div className="fixed bottom-3 left-3 right-3 z-40 flex h-16 items-center justify-around rounded-[22px] border border-white/10 bg-[#07100d]/95 px-2 shadow-[0_18px_45px_rgba(1,8,5,0.38)] backdrop-blur-xl md:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-[52px] min-w-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-bold transition ${
                  isActive ? 'bg-brand-accent text-[#07100d] shadow-neon' : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </RouteGuard>
  );
}
