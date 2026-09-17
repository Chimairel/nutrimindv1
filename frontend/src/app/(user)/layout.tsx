'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import BottomNav from '@/components/ui/BottomNav';
import Navbar from '@/components/shared/Navbar';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import { useAuth } from '@/hooks/useAuth';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isReportPending = Boolean(
    user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged && !pathname?.includes('nutrition-report')
  );

  return (
    <RouteGuard>
      <div className="portal-shell flex h-screen w-full p-0 md:p-4">
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col md:pl-4">
          <Navbar />
          {isReportPending && (
            <div className="w-full shrink-0 border-b border-brand-border/40 bg-brand-bg/80 px-4 py-2.5 backdrop-blur-md md:px-5">
              <AnnouncementBanner
                title="Action required:"
                message="Acknowledge your nutrition report before using this feature."
                action={{
                  label: 'View Nutrition Report',
                  href: '/profile/nutrition-report',
                }}
              />
            </div>
          )}
          <main className="portal-main custom-scrollbar relative flex-1 overflow-y-auto pb-36 md:pb-4">{children}</main>
        </div>
        <BottomNav />
      </div>
    </RouteGuard>
  );
}
