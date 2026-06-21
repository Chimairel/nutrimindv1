'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import Navbar from '@/components/shared/Navbar';
import { ClipboardList, Users, BookOpen, User } from 'lucide-react';

const navItems = [
  { href: '/nutritionist/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/nutritionist/patients', label: 'Patients', icon: Users },
  { href: '/nutritionist/library', label: 'Library', icon: BookOpen },
  { href: '/nutritionist/profile', label: 'Profile', icon: User },
];

export default function NutritionistLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RouteGuard>
      <div className="flex h-screen w-full bg-brand-bg overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-6 relative">
            {children}
          </main>
        </div>

        {/* Mobile Nav */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-surface border-t border-brand-border flex justify-around py-3 md:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                  isActive ? 'text-brand-green' : 'text-brand-muted hover:text-brand-text'
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
