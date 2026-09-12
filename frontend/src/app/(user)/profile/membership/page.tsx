import Link from 'next/link';
import Billing from '../../billing/page';
export default function Page() {
  return (
    <>
      <Link href="/profile" className="mx-5 mt-4 inline-block text-sm font-semibold text-brand-green">
        ← Profile
      </Link>
      <Billing />
    </>
  );
}
