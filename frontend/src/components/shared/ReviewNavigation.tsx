'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function ReviewNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Review sections" className="flex flex-wrap gap-2 border-b border-brand-border px-4 py-3">
      {[
        ['/nutritionist/reviews', 'Meal plans'],
        ['/nutritionist/outside-meals', 'Outside meals'],
        ['/nutritionist/approved', 'Approved reviews'],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-muted hover:bg-brand-bgAlt aria-[current=page]:bg-brand-accent aria-[current=page]:text-[#07100d]"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
