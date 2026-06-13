'use client';

import React from 'react';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import BottomNav from '@/components/ui/BottomNav';
import Navbar from '@/components/shared/Navbar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="flex h-screen w-full bg-brand-bg overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto custom-scrollbar pb-16 md:pb-0 relative">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </RouteGuard>
  );
}
