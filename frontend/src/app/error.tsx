'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('NutriMind page error', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg px-6 py-12 text-brand-text">
      <section className="surface-panel w-full max-w-xl rounded-[2rem] p-8 text-center sm:p-12">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">
          We could not load this page.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-brand-muted">
          Your data has not been changed. Try the request again, or return to the dashboard.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            className="min-h-11 rounded-2xl border border-brand-accent/70 bg-brand-accent px-6 py-2.5 text-sm font-extrabold text-brand-black shadow-neon"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand-border/80 bg-brand-surface/85 px-6 py-2.5 text-sm font-extrabold text-brand-text"
            href="/dashboard"
          >
            Return to dashboard
          </a>
        </div>
      </section>
    </main>
  );
}
