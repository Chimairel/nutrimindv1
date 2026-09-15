'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  BadgeCheck,
  CircleDot,
  Database,
  Fingerprint,
  HeartPulse,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  WandSparkles,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import KainaraLogo from '@/components/shared/KainaraLogo';
import { useAuth } from '@/hooks/useAuth';

const getRoleHome = (role: 'USER' | 'NUTRITIONIST' | 'ADMIN') => {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'NUTRITIONIST') return '/nutritionist/reviews';
  return '/dashboard';
};

const capabilities = [
  {
    icon: Fingerprint,
    number: '01',
    title: 'Built around your health context',
    text: 'Goals, allergies, preferences, conditions, and shopping routines shape every planning decision—not just a calorie number.',
    className: 'lg:col-span-2',
  },
  {
    icon: Database,
    number: '02',
    title: 'Filipino food intelligence',
    text: 'Meals are grounded in familiar ingredients and Philippine food composition references.',
    className: '',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Review-aware by design',
    text: 'AI-created meals remain clearly pending until a nutritionist reviews them. Verification is visible, never implied.',
    className: '',
  },
  {
    icon: Sparkles,
    number: '04',
    title: 'A library that gets smarter',
    text: 'Verified meals can be reused for compatible profiles, reducing unnecessary generation while growing a trusted collection.',
    className: 'lg:col-span-2',
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      const destination = !user.emailVerified
        ? '/verify-email'
        : user.role === 'ADMIN'
          ? '/admin/overview'
          : user.role === 'NUTRITIONIST'
            ? '/nutritionist/reviews'
            : !user.onboardingDone
              ? (user.onboardingNextPath || '/onboarding/stats')
              : !user.tosAccepted
                ? '/onboarding/tos'
                : !user.reportAcknowledged
                  ? '/nutrition-report'
                  : '/dashboard';
      router.replace(destination);
    }
  }, [user, isLoading, router]);

  const isPendingVerification = Boolean(user && !user.emailVerified);
  const workspaceHref = user ? (isPendingVerification ? '/verify-email' : getRoleHome(user.role)) : '/register';
  const workspaceLabel = user
    ? isPendingVerification
      ? 'Continue email verification'
      : user.role === 'USER'
        ? 'Go to Dashboard'
        : 'Open Portal'
    : 'Build my nutrition profile';

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen text-brand-text">
      <PublicHeader />

      <main className="overflow-x-clip">
        <section className="relative">
          <div className="pointer-events-none absolute left-[8%] top-24 h-72 w-72 rounded-full bg-brand-green/10 blur-[110px]" />
          <div className="pointer-events-none absolute right-[7%] top-10 h-80 w-80 rounded-full bg-brand-cyan/10 blur-[120px]" />

          <div className="mx-auto grid min-h-[calc(100vh-74px)] max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-20">
            <div className="relative z-10 max-w-2xl">
              <div className="eyebrow mb-6 inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-cyan opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-cyan" />
                </span>
                AI-assisted Filipino nutrition
              </div>

              <h1 className="font-display text-[clamp(3.4rem,7vw,7.2rem)] font-black leading-[0.88] tracking-[-0.065em] text-brand-text">
                Eat with
                <span className="text-gradient block pb-2">intention.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                KAINARA turns personal health context into culturally familiar meal plans, then keeps AI-generated
                meals inside a transparent nutritionist-review workflow.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={workspaceHref}
                  className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-1 hover:brightness-105"
                >
                  {workspaceLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/docs"
                  className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-brand-border/80 bg-brand-surface/65 px-6 text-sm font-bold text-brand-text backdrop-blur-xl transition hover:-translate-y-1 hover:border-brand-green/35"
                >
                  <BookOpenText className="h-4 w-4 text-brand-green" />
                  Explore documentation
                  <ArrowUpRight className="h-3.5 w-3.5 text-brand-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-brand-border/70 pt-6">
                {[
                  ['7 days', 'Structured plans'],
                  ['3 roles', 'Connected review'],
                  ['Visible', 'Safety status'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-display text-lg font-extrabold tracking-tight text-brand-text sm:text-xl">
                      {value}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[700px] lg:ml-auto">
              <div className="absolute -left-8 top-24 z-20 hidden w-44 animate-float-slow rounded-2xl border border-brand-green/20 bg-[#0b1511]/90 p-4 text-white shadow-card-lg backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  <HeartPulse className="h-3.5 w-3.5 text-brand-cyan" />
                  Health sync
                </div>
                <p className="mt-3 font-display text-2xl font-extrabold">2,779</p>
                <p className="text-[10px] text-white/40">daily kcal target</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-accent to-brand-cyan" />
                </div>
              </div>

              <div className="surface-panel futuristic-grid relative overflow-hidden rounded-[36px] p-2.5 shadow-card-lg sm:p-4">
                <div className="scan-line" />
                <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#07100d] text-white shadow-2xl">
                  {/* Browser Window Chrome */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#0a1410] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 shadow-sm" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 shadow-sm" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 shadow-sm" />
                      <span className="ml-2 font-mono text-[10px] text-white/40">app.kainara.ph/dashboard</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent shadow-[0_0_10px_rgba(184,244,95,0.85)]" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-white/60">Live Cockpit</span>
                    </div>
                  </div>

                  {/* Actual Dashboard Screenshot */}
                  <div className="relative overflow-hidden bg-[#07100d]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/dashboard-actual.png"
                      alt="Actual KAINARA Nutrition Cockpit Dashboard"
                      className="w-full h-auto object-cover object-top transition duration-500 hover:scale-[1.01]"
                      loading="eager"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-7 -right-3 z-20 hidden w-52 rounded-2xl border border-brand-cyan/20 bg-brand-surface/90 p-4 shadow-card backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-brand-text">Review status is visible</p>
                    <p className="mt-0.5 text-[9px] text-brand-muted">No hidden approval states</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-[1440px] scroll-mt-28 px-5 py-24 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="eyebrow inline-flex items-center gap-2">
                <ScanLine className="h-3.5 w-3.5" />
                Platform intelligence
              </div>
              <h2 className="mt-5 max-w-lg font-display text-4xl font-black leading-[1.02] tracking-[-0.045em] text-brand-text sm:text-5xl">
                Personal enough to matter. Structured enough to trust.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-brand-muted lg:ml-auto lg:text-base">
              KAINARA connects the everyday user experience with a nutritionist review loop and an administrative
              verification layer. Each role sees the same nutrition system from the perspective that matters to them.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.number}
                  className={`surface-panel group relative min-h-[260px] overflow-hidden rounded-[30px] p-7 transition duration-300 hover:-translate-y-1 hover:border-brand-green/30 ${item.className}`}
                >
                  <div className="absolute right-5 top-3 font-display text-7xl font-black tracking-tighter text-brand-text/[0.035]">
                    {item.number}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green transition group-hover:scale-105 group-hover:shadow-cyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-8 max-w-md font-display text-xl font-extrabold tracking-tight text-brand-text">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-brand-muted">{item.text}</p>
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-brand-accent to-brand-cyan transition-all duration-500 group-hover:w-full" />
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="process"
          className="relative scroll-mt-20 border-y border-brand-border/60 bg-[#07100d] py-24 text-white"
        >
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-40" />
          <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <div className="eyebrow inline-flex border-white/10 bg-white/5 text-brand-accent">
                <CircleDot className="h-3.5 w-3.5" />
                The intelligence loop
              </div>
              <h2 className="mt-5 font-display text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                Designed to learn without hiding the human checkpoint.
              </h2>
            </div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-[30px] border border-white/10 bg-white/10 md:grid-cols-4">
              {[
                {
                  icon: Fingerprint,
                  title: 'Profile',
                  text: 'Capture health goals, dietary needs, allergies, and lifestyle context.',
                },
                {
                  icon: Database,
                  title: 'Match',
                  text: 'Search compatible verified meals before generating anything new.',
                },
                {
                  icon: WandSparkles,
                  title: 'Generate',
                  text: 'Use AI only for plan gaps, with pending status kept visible.',
                },
                {
                  icon: Stethoscope,
                  title: 'Review',
                  text: 'Route generated meals to nutritionists and grow the verified library.',
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="relative bg-[#09130f] p-7 md:min-h-[300px]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">0{index + 1}</span>
                    <Icon className="mt-10 h-7 w-7 text-brand-accent" />
                    <h3 className="mt-8 font-display text-xl font-bold">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/45">{step.text}</p>
                    {index < 3 && (
                      <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 text-brand-cyan md:block" />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="nutritionists" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12">
          <div className="futuristic-grid relative overflow-hidden rounded-[36px] bg-[#07100d] p-8 text-white shadow-card-lg sm:p-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:p-16">
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[100px]" />
            <div className="relative">
              <div className="eyebrow inline-flex border-white/10 bg-white/5 text-brand-accent">
                <Stethoscope className="h-3.5 w-3.5" />
                For registered nutritionist-dietitians
              </div>
              <h2 className="mt-6 max-w-2xl font-display text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl">
                Help keep AI-assisted nutrition accountable.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/50 sm:text-base">
                Apply online from anywhere in the Philippines to join KAINARA&apos;s professional review team. Every
                application goes through credential screening and a one-on-one verification call before access is
                granted.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/nutritionist-apply"
                  className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-0.5"
                >
                  Apply as a nutritionist <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/nutritionist-apply#track"
                  className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white/70 transition hover:border-brand-cyan/30 hover:text-brand-cyan"
                >
                  Track an application
                </Link>
              </div>
            </div>
            <div className="relative mt-10 grid gap-3 lg:mt-0">
              {[
                {
                  icon: BadgeCheck,
                  title: 'Credential review',
                  text: 'PRC license details and professional background are manually assessed.',
                },
                {
                  icon: Video,
                  title: 'One-on-one verification',
                  text: 'Choose available schedules, then meet online with a KAINARA administrator.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Controlled access',
                  text: 'Only approved applicants receive a private, expiring account invitation.',
                },
              ].map(({ icon: Icon, title, text }, index) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Stage 0{index + 1}</p>
                    <h3 className="mt-1 text-sm font-bold text-white/90">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/40">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12">
          <div className="grid overflow-hidden rounded-[36px] border border-brand-border/70 bg-brand-surface/70 shadow-card-lg backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 sm:p-12 lg:p-16">
              <div className="eyebrow inline-flex items-center gap-2">
                <BookOpenText className="h-3.5 w-3.5" />
                Documentation & user guide
              </div>
              <h2 className="mt-6 max-w-xl font-display text-4xl font-black leading-[1.03] tracking-[-0.045em] sm:text-5xl">
                The complete guide to KAINARA.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-brand-muted sm:text-base">
                Discover the clinical safety standards, FNRI Philippine food database integration, Mifflin-St Jeor
                macro algorithms, and nutritionist review workflows behind KAINARA. Browse step-by-step walkthroughs
                and answers to frequently asked questions.
              </p>
              <Link
                href="/docs"
                className="group mt-8 inline-flex min-h-12 items-center gap-3 rounded-2xl bg-brand-text px-5 text-sm font-bold text-brand-bg transition hover:-translate-y-0.5"
              >
                Explore the documentation
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            <div className="relative min-h-[420px] overflow-hidden bg-[#08110e] p-7 text-white futuristic-grid sm:p-10">
              <div className="absolute right-8 top-8 h-28 w-28 rounded-full bg-brand-cyan/15 blur-3xl" />
              <div className="relative grid h-full grid-cols-2 gap-4">
                <Link
                  href="/docs#clinical-safety"
                  className="group flex flex-col justify-end overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(150deg,rgba(184,244,95,0.18),rgba(255,255,255,0.02))] p-5 transition hover:border-brand-accent/40 hover:bg-white/[0.04]"
                >
                  <ShieldCheck className="h-7 w-7 text-brand-accent transition-transform group-hover:scale-110" />
                  <p className="mt-16 font-display text-lg font-bold">Clinical safety & oversight</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">
                    Contraindication checks, allergy gates, and verified RND approval workflows.
                  </p>
                </Link>
                <div className="grid gap-4">
                  <Link
                    href="/docs#meal-planning"
                    className="group rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.22),transparent_45%),rgba(255,255,255,0.025)] p-5 transition hover:border-brand-cyan/40 hover:bg-white/[0.04]"
                  >
                    <Database className="h-6 w-6 text-brand-cyan transition-transform group-hover:scale-110" />
                    <p className="mt-8 text-sm font-bold">FNRI & macro engine</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/50">
                      Mifflin-St Jeor TDEE & Filipino food composition.
                    </p>
                  </Link>
                  <Link
                    href="/docs#faqs"
                    className="group rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_20%_90%,rgba(139,92,246,0.22),transparent_48%),rgba(255,255,255,0.025)] p-5 transition hover:border-violet-400/40 hover:bg-white/[0.04]"
                  >
                    <Sparkles className="h-6 w-6 text-violet-300 transition-transform group-hover:scale-110" />
                    <p className="mt-8 text-sm font-bold">User guides & FAQs</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/50">
                      Starter bridge plans, meal swaps, and daily tracking.
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8 lg:px-12">
          <div className="relative mx-auto max-w-[1344px] overflow-hidden rounded-[36px] bg-brand-accent px-7 py-12 text-[#07100d] sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[40px] border-[#07100d]/5" />
            <div className="relative">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] opacity-55">
                Your next meal can be intentional
              </p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                A smarter weekly plan starts with understanding you.
              </h2>
            </div>
            <Link
              href={workspaceHref}
              className="relative mt-7 inline-flex min-h-[52px] items-center gap-3 rounded-2xl bg-[#07100d] px-6 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 lg:mt-0"
            >
              {user
                ? isPendingVerification
                  ? 'Continue verification'
                  : user.role === 'USER'
                    ? 'Go to Dashboard'
                    : 'Open Portal'
                : 'Start onboarding'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-border/70">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs text-brand-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div className="flex items-center gap-2.5 font-display font-extrabold tracking-[0.14em] text-brand-text">
            <KainaraLogo size="sm" variant="gradient" />
            KAINARA
          </div>
          <p>© 2026 KAINARA. AI-assisted Filipino nutrition intelligence.</p>
          <div className="flex gap-5">
            <Link href="/docs" className="transition hover:text-brand-green">
              Documentation
            </Link>
            <Link href="/login" className="transition hover:text-brand-green">
              Portal login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
