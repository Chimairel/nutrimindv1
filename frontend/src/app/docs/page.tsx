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
  Compass,
  FileDown,
  FileText,
  HeartPulse,
  HelpCircle,
  Lock,
  Mail,
  Repeat2,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';

export const metadata: Metadata = {
  title: 'Documentation & User Guide | KAINARA',
  description:
    'Comprehensive product documentation, user guides, clinical safety standards, nutrition algorithms, and troubleshooting FAQs for KAINARA.',
};

const chapters = [
  ['01', 'Getting Started & Intake', '#getting-started'],
  ['02', 'Meal Planning & Cycles', '#meal-planning'],
  ['03', 'Daily Tracking & Cockpit', '#daily-tracking'],
  ['04', 'Outside Meals & AI', '#outside-meals'],
  ['05', 'Swaps & Verified Library', '#meal-swaps'],
  ['06', 'Groceries & PDF Export', '#groceries'],
  ['07', 'Clinical Oversight & Safety', '#clinical-safety'],
  ['08', 'Account, Goals & Privacy', '#account-settings'],
  ['09', 'Troubleshooting & FAQs', '#faqs'],
];

const faqs = [
  {
    q: 'How does KAINARA calculate my calories and macros?',
    a: 'KAINARA calculates your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) using the Mifflin-St Jeor formula. Targets are calibrated for your biological sex, age, height, current weight, activity level, and weight objective (loss, maintenance, or gain).',
  },
  {
    q: 'Are the recipes realistic for Philippine households?',
    a: 'Yes. KAINARA matches all plans against the Food and Nutrition Research Institute (FNRI) Philippine Food Composition Table. Plans feature accessible market ingredients like bangus, tilapia, mongo, malunggay, kangkong, and brown rice with accurate local portion weights.',
  },
  {
    q: 'What is a Starter / Bridge Plan?',
    a: 'If your designated shopping day (e.g. Saturday or Sunday) is several days away, KAINARA immediately prepares a 1 to 3-day Starter Bridge Plan using standard kitchen staples so you can begin eating right away without disrupting your weekly grocery schedule.',
  },
  {
    q: 'Can I eat outside meals and still track my adherence?',
    a: 'Yes. Click "Log Outside Food" on your dashboard. Our multimodal AI identifies ingredients, estimates calories and macros per gram or serving, and alerts you if any ingredients conflict with your declared medical conditions or allergies.',
  },
  {
    q: 'Why is there a ±15% calorie delta warning when swapping meals?',
    a: 'To safeguard your caloric balance, KAINARA warns you if a replacement dish differs by more than 15% calories from your original target meal. This gives you transparency to adjust your other meals during the day.',
  },
  {
    q: 'Who reviews the meal plans before they are marked verified?',
    a: 'PRC-licensed Filipino Registered Nutritionist-Dietitians (RNDs) review queued AI plans, audit nutritional accuracy, and curate the verified recipe library. Dishes marked "Verified RND" have undergone clinical inspection.',
  },
];

export default function DocsPage() {
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
                  <BookOpen className="h-3.5 w-3.5 text-brand-accent" />
                  Official Product Documentation & User Guide
                </div>
                <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.9] tracking-[-0.065em]">
                  The complete guide to <span className="text-gradient">KAINARA.</span>
                </h1>
              </div>
              <div className="border-l border-brand-border/70 pl-6">
                <p className="text-sm leading-7 text-brand-muted">
                  Official user manuals, step-by-step feature guides, clinical safety standards, nutrition algorithms,
                  and troubleshooting FAQs for the KAINARA nutrition platform.
                </p>
                <div className="mt-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-muted">
                  <span className="h-2 w-2 rounded-full bg-brand-green" />
                  Version 1.0 · Updated September 2026
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Layout */}
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-12 lg:py-24">
          {/* Sticky Left Navigation */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-muted">On this page</p>
              <nav className="mt-5 space-y-1" aria-label="Documentation chapters">
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

              {/* Direct Support Card */}
              <div className="mt-10 rounded-[24px] border border-brand-border/80 bg-brand-surface/60 p-5 text-xs">
                <div className="flex items-center gap-2 text-brand-text font-bold">
                  <Mail className="h-4 w-4 text-brand-green" />
                  <span>Need help?</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-brand-muted">
                  Questions regarding clinical profiles, meal plans, or billing? Reach our team directly.
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
            {/* Chapter 01: Getting Started & Intake */}
            <section id="getting-started" className="scroll-mt-28">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]">
                  <Compass className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 01
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Getting Started & Clinical Intake
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Getting started with KAINARA begins with our 5-step biometric and clinical onboarding wizard. Instead
                  of generic calorie calculators, KAINARA gathers your medical history, dietary preferences, and local
                  shopping schedule to formulate an individualized nutrition plan.
                </p>
                <p>
                  Your daily energy baseline is computed using the <strong>Mifflin-St Jeor</strong> formula, the
                  clinical standard recognized by dietitians for calculating Basal Metabolic Rate (BMR) and Total Daily
                  Energy Expenditure (TDEE).
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="surface-panel rounded-[24px] p-5">
                  <span className="font-mono text-xs font-bold text-brand-green">STEP 01–02</span>
                  <h3 className="mt-2 text-xs font-bold text-brand-text">Biometrics & Goals</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Age, sex, height, current weight, target weight, and activity multipliers.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <span className="font-mono text-xs font-bold text-brand-cyan">STEP 03–04</span>
                  <h3 className="mt-2 text-xs font-bold text-brand-text">Medical & Allergens</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Screening for Type 2 Diabetes, Hypertension, Kidney Disease, and specific allergens.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <span className="font-mono text-xs font-bold text-brand-accent">STEP 05</span>
                  <h3 className="mt-2 text-xs font-bold text-brand-text">Shopping Day Anchoring</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Selecting your weekly palengke or supermarket schedule (Weekend vs. Weekday).
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 02: Meal Planning & Cycles */}
            <section id="meal-planning" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/15 text-brand-cyan">
                  <Clock className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 02
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Meal Planning & Shopping Cycles
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Filipino shopping rhythms revolve around weekend market trips or designated grocery days. Rather than
                imposing an arbitrary Monday-to-Sunday cycle, KAINARA synchronizes your 7-day plan with your routine and
                provides starter bridge plans so you never have to wait.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-green font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    Starter Bridge Plans
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-brand-text">Immediate first steps</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    If you sign up on a Tuesday and shop on Saturday, KAINARA generates a 1 to 3-day Starter Bridge Plan
                    using everyday pantry items. Your full 7-day cycle begins seamlessly on your shopping day.
                  </p>
                </div>

                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-cyan font-bold text-xs uppercase tracking-wider">
                    <UtensilsCrossed className="h-4 w-4" />
                    FNRI Food Composition
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-brand-text">100% Culturally Familiar</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Dishes are matched against the FNRI Philippine Food Composition Table, guaranteeing realistic
                    Filipino dishes (e.g. tinola, sinigang, ginisang monggo) with exact laboratory-verified macros.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 03: Daily Tracking & Cockpit */}
            <section id="daily-tracking" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                  <Sparkles className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 03
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Daily Tracking & Cockpit Dashboard
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Your home dashboard serves as your daily nutrition cockpit. The interactive Calorie Ring gives you an
                  immediate visual indicator of consumed vs. remaining energy for the day, complemented by protein,
                  carb, and fat macro progression bars.
                </p>
                <p>
                  Each scheduled meal card lets you record your intake with a single click: mark as{' '}
                  <strong>DONE</strong> to tally macros, or <strong>SKIPPED</strong> if you omitted the meal. Log water
                  consumption in 250ml increments and monitor your 7-day adherence streak.
                </p>
              </div>

              <div className="mt-10 rounded-[28px] border border-brand-border bg-brand-surface/60 p-7">
                <h3 className="font-display text-base font-bold text-brand-text">Adherence Criteria</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-4">
                    <p className="font-bold text-brand-green">90% – 110% Optimal</p>
                    <p className="mt-1 text-brand-muted text-[11px]">Caloric intake within target tolerance window.</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="font-bold text-amber-500">70% – 89% Buffer</p>
                    <p className="mt-1 text-brand-muted text-[11px]">
                      Acceptable variance; slightly below target energy.
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <p className="font-bold text-red-500">&lt; 70% or &gt; 110%</p>
                    <p className="mt-1 text-brand-muted text-[11px]">
                      Substantial deviation from metabolic prescription.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Chapter 04: Outside Meals & AI Breakdown */}
            <section id="outside-meals" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 04
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Logging Outside Meals & AI Breakdown
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Eating outside the planned menu is a normal part of life. Whether dining at a carinderia, restaurant, or
                family gathering, you can log custom food directly into KAINARA without losing your progress.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-green font-bold text-sm">
                    <BrainCircuit className="h-4 w-4" />
                    Multimodal AI Estimation
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    Enter dish names like &ldquo;Pork Sinigang with 1 cup rice&rdquo;. Gemini AI breaks down the
                    ingredients, estimates portion weights, and calculates exact calories, proteins, carbohydrates, and
                    fats.
                  </p>
                </div>

                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                    <ShieldAlert className="h-4 w-4" />
                    Automated Contraindication Alerts
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    If you manage Hypertension or Type 2 Diabetes, dishes containing excess sodium, refined sugars, or
                    your recorded allergens trigger an instant clinical contraindication alert before logging.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 05: Meal Swaps & Verified Library */}
            <section id="meal-swaps" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
                  <Repeat2 className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 05
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Meal Swaps & Verified Library
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Not in the mood for a scheduled meal? KAINARA allows you to swap individual meal slots with
                  dietitian-curated recipes from our verified Meal Library that align with your dietary preference
                  (Omnivore, Vegetarian, Pescatarian, Low Carb).
                </p>
                <p>
                  To encourage dietary consistency and shopping preparation, swaps are subject to two clinical
                  safeguards: a weekly swap limit and an energy divergence alert.
                </p>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <span className="font-mono text-xs font-bold text-brand-green">CAPACITY</span>
                  <h3 className="mt-2 font-display text-lg font-bold text-brand-text">3 Swaps Per Week</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Each weekly plan allows up to 3 recipe replacements. Your remaining swap count updates
                    automatically.
                  </p>
                </div>

                <div className="surface-panel rounded-[26px] p-6">
                  <span className="font-mono text-xs font-bold text-amber-400">SAFETY ALERT</span>
                  <h3 className="mt-2 font-display text-lg font-bold text-brand-text">±15% Calorie Delta Warning</h3>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    If a replacement dish differs by more than 15% from the slot&apos;s allocated energy, KAINARA alerts
                    you to help you balance your total intake.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 06: Groceries & PDF Export */}
            <section id="groceries" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                  <ShoppingCart className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 06
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Groceries & PDF Export
                  </h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Every approved 7-day meal plan automatically aggregates ingredients into a categorized grocery
                checklist. Items are grouped by department: Fresh Produce, Meats & Seafood, Dairy, and Pantry Staples.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-2">
                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-text font-bold text-sm">
                    <CheckCircle2 className="h-4 w-4 text-brand-green" />
                    Interactive In-App Checklists
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    Check off ingredients on your phone while shopping at the supermarket or palengke. Checked items are
                    saved in your session.
                  </p>
                </div>

                <div className="surface-panel rounded-[26px] p-6">
                  <div className="flex items-center gap-2 text-brand-text font-bold text-sm">
                    <FileDown className="h-4 w-4 text-brand-cyan" />
                    Printable PDF Generation
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                    Export high-resolution PDF grocery lists formatted for easy printing or sharing on messaging apps
                    with family members.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 07: Clinical Oversight & Safety */}
            <section id="clinical-safety" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/15 text-brand-cyan">
                  <Stethoscope className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 07
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Clinical Oversight & Safety Protocols
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  KAINARA is designed with clinical oversight at its foundation. PRC-licensed Filipino Registered
                  Nutritionist-Dietitians (RNDs) review and audit meal plans to ensure nutritional integrity and safety.
                </p>
                <p>
                  Nutritionists utilize a global review queue with 30-minute task claim locks. RNDs verify ingredient
                  amounts, inspect potential medical contraindications, and sign off with their official PRC
                  credentials.
                </p>
              </div>

              <div className="mt-10 rounded-[28px] border border-brand-border bg-brand-surface/60 p-7">
                <h3 className="font-display text-base font-bold text-brand-text">Status Badges Legend</h3>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-full bg-brand-green/15 px-2.5 py-1 font-mono text-[10px] font-bold text-brand-green">
                      VERIFIED RND
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      Audited, checked, and approved by a licensed Filipino Registered Nutritionist-Dietitian.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-400">
                      PENDING REVIEW
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      AI-generated recipe formulated against FNRI tables, queued in the professional review queue.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Chapter 08: Account, Goals & Privacy */}
            <section id="account-settings" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]">
                  <User className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 08
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Account, Health Goals & Data Privacy
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Health conditions and allergies change over time. In KAINARA, you do not need to wait for a weekly
                  check-in to update your health profile. Visit <strong>Profile &gt; Health &amp; Goals</strong> to add
                  newly diagnosed conditions or food allergies anytime.
                </p>
                <p>
                  Your personal health data is processed in compliance with the Philippine Data Privacy Act of 2012 (RA
                  10173). We never sell or distribute your biometric records. You can update your credentials or
                  permanently delete your account from the Security settings page.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-brand-green" />
                    <h3 className="text-xs font-bold text-brand-text">Dynamic Updates</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Modify allergies or medical restrictions mid-plan to trigger real-time plan safety rechecks.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-cyan" />
                    <h3 className="text-xs font-bold text-brand-text">DiceBear Avatars</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Personalize your display identity with custom pixel-art avatars across all portal views.
                  </p>
                </div>
                <div className="surface-panel rounded-[24px] p-5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-brand-accent" />
                    <h3 className="text-xs font-bold text-brand-text">Account Control</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                    Sign out securely from the Profile page, change passwords, or request complete account erasure.
                  </p>
                </div>
              </div>
            </section>

            {/* Chapter 09: Troubleshooting & FAQs */}
            <section id="faqs" className="scroll-mt-28 border-t border-brand-border/70 pt-16">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/15 text-brand-cyan">
                  <HelpCircle className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                    Chapter 09
                  </p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                    Troubleshooting & Frequently Asked Questions
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

              {/* Support Contact Box */}
              <div className="mt-12 rounded-[28px] border border-brand-border/80 bg-brand-bgAlt/60 p-7 sm:p-9">
                <h3 className="font-display text-lg font-bold text-brand-text">Need direct assistance?</h3>
                <p className="mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-brand-muted">
                  Our technical support and clinical advisory teams are available to assist with account questions,
                  dietary adjustments, or system troubleshooting.
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
                    href="/dashboard"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-brand-border bg-brand-surface px-5 text-xs font-bold text-brand-text transition hover:bg-brand-bgAlt"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Bottom CTA Banner */}
            <section className="overflow-hidden rounded-[30px] bg-brand-accent p-7 text-[#07100d] sm:p-10">
              <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                    Start eating with confidence
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
          <p className="font-display font-bold text-brand-text">KAINARA documentation & help center</p>
          <p>Validated against the FNRI Philippine Food Composition Table.</p>
        </div>
      </footer>
    </div>
  );
}
