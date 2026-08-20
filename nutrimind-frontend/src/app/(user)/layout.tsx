'use client';

import React from 'react';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import BottomNav from '@/components/ui/BottomNav';
import Navbar from '@/components/shared/Navbar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="portal-shell flex h-screen w-full overflow-hidden p-0 md:p-4">
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col md:pl-4">
          <Navbar />
          <main className="portal-main custom-scrollbar relative flex-1 overflow-y-auto pb-24 md:pb-4">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </RouteGuard>
  );
}
