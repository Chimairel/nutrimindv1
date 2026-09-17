'use client';
import Link from 'next/link';
import { User, HeartPulse, Soup, ClipboardList, Crown, ShieldCheck, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

const sections = [
  { href: '/profile/personal', title: 'Personal details', description: 'Name, email and your avatar', icon: User },
  {
    href: '/profile/health',
    title: 'Health & goals',
    description: 'Body measurements, activity, conditions and allergies',
    icon: HeartPulse,
  },
  {
    href: '/profile/planning',
    title: 'Food & planning',
    description: 'Diet, location, meal preferences and shopping day',
    icon: Soup,
  },
  {
    href: '/profile/nutrition-report',
    title: 'Nutrition guidance & report',
    description: 'Clinical summary, foods to favor/avoid, and AI nutrition report',
    icon: ClipboardList,
  },
  {
    href: '/profile/membership',
    title: 'Membership',
    description: 'Your plan, available swaps and Premium benefits',
    icon: Crown,
  },
  {
    href: '/profile/security',
    title: 'Security & privacy',
    description: 'Password, downloads and account controls',
    icon: ShieldCheck,
  },
];
export default function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div className="portal-page max-w-4xl space-y-5">
      <PortalPageHeader
        icon={User}
        eyebrow="Your account"
        title="Profile"
        description="Your information, preferences and account settings."
      />
      <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-surface p-4">
        <Avatar src={user?.image} fallbackText={user?.name} size="md" showSalakot={Boolean(user?.isPremium)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold">{user?.name}</h2>
            {user?.isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/40 bg-brand-accent/15 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
                👑 Premium
              </span>
            )}
          </div>
          <p className="break-all text-sm text-brand-muted">{user?.email}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
        {sections.map(({ href, title, description, icon: Icon }) => {
          const isNutrition = href === '/profile/nutrition-report';
          const needsAttention = isNutrition && user && !user.reportAcknowledged;
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-24 items-center gap-4 border-b border-brand-border p-5 last:border-0 hover:bg-brand-bgAlt focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green"
            >
              <div className="relative">
                <Icon className="h-5 w-5 shrink-0 text-brand-green" />
                {needsAttention && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{title}</h2>
                  {needsAttention && (
                    <Badge variant="pending" className="text-[10px] font-bold px-2 py-0.5">
                      Review required
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-brand-muted">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-sm text-brand-text">Account Session</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            Signed in as <span className="font-medium text-brand-text">{user?.email}</span>. Sign out of your account on
            this device.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void logout()}
          className="flex shrink-0 items-center justify-center gap-2 border-red-500/25 px-5 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-red-500/30"
        >
          <LogOut className="h-4 w-4 stroke-[2.25]" />
          Log out
        </Button>
      </div>

      <p className="text-sm text-brand-muted">
        A new allergy or condition? Update Health & goals whenever it changes. You do not need to wait for a weekly
        check-in.
      </p>
    </div>
  );
}
