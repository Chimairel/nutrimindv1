import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg px-6 py-12 text-brand-text">
      <section className="surface-panel w-full max-w-xl rounded-[2rem] p-8 text-center sm:p-12">
        <p className="eyebrow">404 · Page not found</p>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">
          This page is not on the menu.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-brand-muted">
          The link may be outdated, or the page may have moved.
        </p>
        <Link
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand-accent/70 bg-brand-accent px-6 py-2.5 text-sm font-extrabold text-brand-black shadow-neon"
          href="/dashboard"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
