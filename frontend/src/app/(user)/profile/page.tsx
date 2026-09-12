'use client';
import Link from 'next/link';
import { User, HeartPulse, Utensils, Crown, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
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
    icon: Utensils,
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
  const { user } = useAuth();
  return (
    <div className="portal-page max-w-4xl space-y-5">
      <PortalPageHeader
        icon={User}
        eyebrow="Your account"
        title="Profile"
        description="Your information, preferences and account settings."
      />
      <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-surface p-4">
        <Avatar src={user?.image} fallbackText={user?.name} size="md" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">{user?.name}</h2>
          <p className="break-all text-sm text-brand-muted">{user?.email}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 items-center gap-4 border-b border-brand-border p-5 last:border-0 hover:bg-brand-bgAlt focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green"
          >
            <Icon className="h-5 w-5 shrink-0 text-brand-green" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-brand-muted">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </div>
      <p className="text-sm text-brand-muted">
        A new allergy or condition? Update Health & goals whenever it changes. You do not need to wait for a weekly
        check-in.
      </p>
    </div>
  );
}
