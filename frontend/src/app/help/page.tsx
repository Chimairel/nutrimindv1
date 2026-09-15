import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Mail,
  Repeat2,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';

export const metadata: Metadata = {
  title: 'Help & Knowledge Center | KAINARA',
  description: 'Everything you need to navigate personalized nutrition, AI meal generation, FNRI food composition, and clinical RND review.',
};

const chapters = [
  ['01', 'AI & FNRI Planning', '#planning'],
  ['02', 'Starter Bridge Plans', '#starter'],
  ['03', 'Logging Outside Food', '#logging'],
  ['04', 'Swaps & Delta Alerts', '#swaps'],
  ['05', 'Clinical Oversight', '#clinical'],
  ['06', 'Support & Inquiries', '#support'],
];

const faqs = [
  {
    q: 'How does KAINARA calculate my calories and macros?',
    a: 'KAINARA calculates your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) using the scientifically validated Mifflin-St Jeor equation. Target macros are adjusted for your age, biological sex, height, weight, activity level, and goal (weight loss, maintenance, or muscle gain).',
  },
  {
    q: 'Are the food items realistic for Philippine households?',
    a: 'Yes! Unlike mainstream Western diet apps that recommend inaccessible or costly items, KAINARA matches meal plans against the Food and Nutrition Research Institute (FNRI) Philippine Food Composition Table, incorporating familiar local ingredients like malunggay, kangkong, bangus, tilapia, mongo, and brown rice.',
  },
  {
    q: 'What is a Starter / Bridge Plan?',
    a: 'If your designated shopping day (e.g. Saturday or Sunday) is several days away, KAINARA immediately generates a 1 to 3-day starter bridge plan using staples you likely have at home so you can start right away without waiting for your next grocery cycle.',
  },
  {
    q: 'Can I eat outside meals and still track my adherence?',
    a: 'Absolutely. Click "Log Outside Food" on your dashboard to log any homemade or restaurant food. Our real-time AI parses the dish name, estimates nutrients per gram or portion, and cross-checks ingredients against your declared medical contraindications and allergens.',
  },
  {
    q: 'How many meal swaps do I get each week?',
    a: 'Each user is allocated 3 meal swaps per weekly cycle. If a replacement meal from the verified library deviates from the original meal by more than ±15% calories, KAINARA alerts you so you can balance your other meals throughout the day.',
  },
  {
    q: 'Who reviews AI meal plans before they are marked verified?',
    a: 'Registered Nutritionist-Dietitians (RNDs) holding verified Professional Regulation Commission (PRC) licenses audit queued meal plans, evaluate clinical contraindications, and curate the verified recipe library.',
  },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen text-brand-text">
      <PublicHeader />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-brand-border/60">
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-50" />
          <div className="pointer-events-none absolute left-[12%] top-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[110px]" />
          <div className="pointer-events-none absolute right-[8%] top-20 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px]" />

          <div className="relative mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-xs font-bold text-brand-muted transition hover:text-brand-green"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to experience
            </Link>
            <div className="grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
              <div>
                <div className="eyebrow inline-flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-brand-accent" />
                  Knowledge & Help Center
                </div>
                <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.9] tracking-[-0.065em]">
                  The guide to navigating <span className="text-gradient">KAINARA.</span>
                </h1>
              </div>
              <div className="border-l border-brand-border/70 pl-6">
                <p className="text-sm leading-7 text-brand-muted">
                  Everything you need to know about culturally aware meal generation, FNRI food composition tables,
                  clinical RND reviews, and day-to-day nutrition logging.
                </p>
                <div className="mt-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-muted">
                  <span className="h-2 w-2 rounded-full bg-brand-green" />
                  Official product guide & clinical FAQ
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Editorial Layout */}
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-12 lg:py-24">
          {/* Sticky Left Navigation */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-muted">On this page</p>
              <nav className="mt-5 space-y-1" aria-label="Help chapters">
                {chapters.map(([num, title, href]) => (
                  <a
                    key={num}
                    href={href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-brand-muted transition hover:bg-brand-surface/70 hover:text-brand-text"
                  >
                    <span className="font-mono text-[9px] font-bold text-brand-muted/60 transition group-hover:text-brand-green">
                      {num}
                    </span>
                    <span>{title}</span>
                  </a>
                ))}
              </nav>

              {/* Contact Card */}
              <div className="mt-10 rounded-[24px] border border-brand-border/80 bg-brand-surface/60 p-5 text-xs">
                <div className="flex items-center gap-2 text-brand-text font-bold">
                  <Mail className="h-4 w-4 text-brand-green" />
                  <span>Need human help?</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-brand-muted">
                  Have questions regarding your account or medical profile? Reach our support desk directly.
                </p>
                <a
                  href="mailto:support@kainara.ph"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline"
                >
                  support@kainara.ph
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Chapters */}
          <article className="min-w-0 space-y-24">
            {/* Chapter 01: AI & FNRI Planning */}
            <section id="planning" className="scroll-mt-28">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]">
                  <BrainCircuit className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 01
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    AI Nutrition & FNRI Food Intelligence
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Mainstream nutrition software predominantly features Western diets that are economically inaccessible
                  or culturally foreign to Filipino households. KAINARA combines Google Gemini with the official
                  Food and Nutrition Research Institute (FNRI) Philippine Food Composition Table.
                </p>
                <p>
                  Your energy baseline is formulated using the Mifflin-St Jeor equation, universally regarded by clinical
                  dietitians as the gold standard for Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE)
                  calculations.
                </p>
              </div>

              <blockquote className="relative mt-10 overflow-hidden rounded-[28px] border border-brand-green/20 bg-brand-green/[0.07] p-7 sm:p-9">
                <p className="relative max-w-3xl font-display text-xl font-bold leading-8 tracking-tight text-brand-text sm:text-2xl">
                  “Personalized nutrition should honor Filipino food culture, budgeting realities, and clinical safety—not enforce generic diets.”
                </p>
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-brand-muted">
                  Core KAINARA Clinical Principle
                </p>
              </blockquote>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-brand-green" />
                    <h3 className="text-xs font-bold text-brand-text">Mifflin-St Jeor</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Calculates precision energy targets tailored to your age, sex, weight, and activity level.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-brand-cyan" />
                    <h3 className="text-xs font-bold text-brand-text">FNRI Composition</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Matches Philippine raw foods and dishes with authoritative lab-verified macro profiles.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-accent" />
                    <h3 className="text-xs font-bold text-brand-text">Culturally Tuned</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    From sinigang to pinakbet, your daily meal plans use local market staples you actually eat.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 02: Starter Bridge Plans */}
            <section id="starter" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/15 text-brand-cyan">
                  <Clock className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 02
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Cycle Anchoring & Starter Bridge Plans
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Filipino shopping rhythms typically revolve around weekend palengke trips or specific supermarket run days.
                Rather than forcing every user onto an arbitrary Monday-to-Sunday cycle, KAINARA anchors your full 7-day
                meal plan directly to your declared shopping schedule.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-green font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    Immediate Starter Plans
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-brand-text">
                    Never wait for next week to start
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    If you register on a Tuesday and your shopping day is Saturday, KAINARA generates an immediate
                    1 to 3-day Starter Bridge Plan using standard pantry essentials. Once Saturday arrives, your full
                    7-day plan seamlessly kicks in.
                  </p>
                </div>
                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-cyan font-bold text-xs uppercase tracking-wider">
                    <UtensilsCrossed className="h-4 w-4" />
                    Synchronized Groceries
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-brand-text">
                    Zero wasted food or extra trips
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Your grocery checklist compiles exact ingredients categorized by produce, proteins, and pantry staples,
                    available for instant in-app tracking or server-side printable PDF export.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 03: Logging Outside Food */}
            <section id="logging" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 03
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Logging Outside Food & Clinical Warnings
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Life happens—carinderia lunches, family salu-salo, or office dinners are part of everyday life.
                KAINARA never penalizes outside meals; instead, it provides real-time nutrient estimation and clinical
                safeguards.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-2">
                <div className="rounded-[26px] border border-brand-border bg-brand-surface/60 p-6">
                  <div className="flex items-center gap-2 text-brand-text font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-brand-green" />
                    AI Food Breakdown
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    Type any Filipino or international dish (e.g. &ldquo;Chicken Inasal with 1 cup garlic rice&rdquo;).
                    Our multimodal AI models calculate estimated calories, proteins, carbohydrates, and fats in seconds.
                  </p>
                </div>

                <div className="rounded-[26px] border border-status-error-border/40 bg-status-error-bg/10 p-6">
                  <div className="flex items-center gap-2 text-status-error-text font-bold text-sm">
                    <ShieldAlert className="h-4 w-4" />
                    Contraindication Warnings
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    If you manage Type 2 Diabetes, Hypertension, or Chronic Kidney Disease, dishes with high sodium,
                    added sugars, or declared allergens trigger immediate clinical contraindication warnings.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 04: Meal Swaps & Calorie Delta Warnings */}
            <section id="swaps" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
                  <Repeat2 className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 04
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Meal Swaps, Weekly Caps & Delta Warnings
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Meal plans should be flexible without destabilizing your target caloric trajectory.
                KAINARA allows you to replace any scheduled meal slot with a recipe from the verified library, guided by
                clinical balance rules.
              </p>

              <div className="mt-9 grid gap-6 sm:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <span className="font-mono text-xs font-bold text-brand-green">RULE 01</span>
                  <h3 className="mt-2 font-display text-lg font-bold text-brand-text">3-Swap Weekly Cap</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    To maintain disciplined dietary adherence and grocery cost predictability, members can swap up to
                    3 meal slots per weekly cycle.
                  </p>
                </div>

                <div className="surface-panel rounded-[26px] p-6">
                  <span className="font-mono text-xs font-bold text-amber-400">RULE 02</span>
                  <h3 className="mt-2 font-display text-lg font-bold text-brand-text">±15% Calorie Delta Warning</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    If a replacement recipe deviates by more than 15% calories from your original target slot, KAINARA
                    prominently highlights the variance to help you calibrate your other meals.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 05: Clinical Oversight & Verification */}
            <section id="clinical" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                  <ShieldCheck className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 05
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Clinical Nutritionist Oversight & Verification
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Purely generative AI can hallucinate ingredients or miscalculate macronutrient densities. KAINARA
                  couples artificial intelligence with human-in-the-loop review by licensed Filipino Registered
                  Nutritionist-Dietitians (RNDs).
                </p>
                <p>
                  Every nutritionist on KAINARA undergoes strict PRC license number and university credential screening.
                  RNDs claim audit tasks using our 30-minute lock review queue, inspect recipes, and approve or flag
                  meals before they enter the public library.
                </p>
              </div>

              <div className="mt-10 rounded-[28px] border border-brand-border bg-brand-surface/60 p-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-5">
                  <div>
                    <h3 className="font-display text-base font-bold text-brand-text">Understanding Verification Badges</h3>
                    <p className="text-xs text-brand-muted mt-0.5">How to interpret meal inspection status in your plan</p>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-full bg-brand-green/15 px-2.5 py-1 font-mono text-[10px] font-bold text-brand-green">
                      VERIFIED RND
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      Inspected, calculated, and signed off by a licensed Registered Nutritionist-Dietitian with valid PRC credentials.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-400">
                      PENDING REVIEW
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      AI-generated recipe formulated against FNRI tables, queued for professional clinical review.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Chapter 06: Support & Inquiries */}
            <section id="support" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]">
                  <Mail className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 06
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Frequently Asked Questions & Inquiries
                  </h2>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {faqs.map(({ q, a }, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-brand-border bg-brand-surface/60 p-5 transition-colors hover:border-brand-border/90"
                  >
                    <h3 className="font-display text-sm font-bold text-brand-text sm:text-base">{q}</h3>
                    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-brand-muted">{a}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 rounded-[28px] border border-brand-border/80 bg-brand-bgAlt/60 p-7 sm:p-9">
                <h3 className="font-display text-lg font-bold text-brand-text">Still have questions?</h3>
                <p className="mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-brand-muted">
                  Our technical support and clinical advisory teams are available to address account issues,
                  data export requests, and clinical questions.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <a
                    href="mailto:support@kainara.ph"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-brand-green px-5 text-xs font-bold text-[#07100d] transition hover:-translate-y-0.5"
                  >
                    <Mail className="h-4 w-4" />
                    Contact support@kainara.ph
                  </a>
                  <Link
                    href="/docs"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-brand-border bg-brand-surface px-5 text-xs font-bold text-brand-text transition hover:bg-brand-bgAlt"
                  >
                    <BookOpen className="h-4 w-4" />
                    View Technical Docs
                  </Link>
                </div>
              </div>
            </section>

            {/* Bottom CTA Banner */}
            <section className="overflow-hidden rounded-[30px] bg-brand-accent p-7 text-[#07100d] sm:p-10">
              <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                    Ready to eat better?
                  </p>
                  <h2 className="mt-3 max-w-xl font-display text-3xl font-black tracking-[-0.04em]">
                    Experience personalized Filipino nutrition today.
                  </h2>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#07100d] px-5 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/70">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-8 text-xs text-brand-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p className="font-display font-bold text-brand-text">KAINARA help center & documentation</p>
          <p>Validated against the FNRI Philippine Food Composition Table.</p>
        </div>
      </footer>
    </div>
  );
}
