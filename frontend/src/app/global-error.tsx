'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#060b09] text-[#eff8f3]">
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#0e1814] p-8 text-center shadow-2xl sm:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8f45f]">
              NutriMind recovery
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              The application needs a fresh start.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#8ca098]">
              Reload the interface to continue. No meal or profile change was submitted by this screen.
            </p>
            <button
              className="mt-8 min-h-11 rounded-2xl bg-[#b8f45f] px-6 py-2.5 text-sm font-extrabold text-[#07100d]"
              onClick={reset}
              type="button"
            >
              Reload NutriMind
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
