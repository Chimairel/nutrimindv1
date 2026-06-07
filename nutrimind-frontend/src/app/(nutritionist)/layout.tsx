'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/shared/RouteGuard';

const navItems = [
  { href: '/nutritionist/reviews', label: 'Review Queue', icon: '📋' },
  { href: '/nutritionist/patients', label: 'Patients', icon: '👥' },
  { href: '/nutritionist/library', label: 'Meal Library', icon: '📚' },
  { href: '/nutritionist/profile', label: 'Profile', icon: '👤' },
];

export default function NutritionistLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RouteGuard>
      <div className="flex min-h-screen bg-brand-bg">
        {/* Sidebar */}
        <aside className="w-64 bg-brand-card border-r border-brand-border p-6 hidden md:flex flex-col">
          <div className="mb-8">
            <h2 className="text-lg font-extrabold text-brand-green font-display">🧠 NutriMind</h2>
            <p className="text-xs text-brand-muted mt-1">Nutritionist Portal</p>
          </div>
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  pathname === item.href
                    ? 'bg-brand-green/10 text-brand-green'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/40'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile Nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-card border-t border-brand-border flex justify-around py-3 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                pathname === item.href ? 'text-brand-green' : 'text-brand-muted'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Main */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </RouteGuard>
  );
}
