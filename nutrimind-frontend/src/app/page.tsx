'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-bg text-brand-text select-none relative">
      {/* Navbar segment */}
      <header className="flex h-16 items-center justify-between border-b border-brand-border px-6 md:px-12 bg-[#0d0d0d]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <h1 className="font-extrabold text-lg tracking-wider text-brand-green font-display">NUTRIMIND</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm">Log In</Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Main hero segment */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20 text-center max-w-5xl mx-auto gap-8 z-10 relative">
        {/* Decorative backdrop glowing blob */}
        <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[280px] w-[280px] md:w-[600px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <Badge variant="ai">Powered by Gemini AI 2.5</Badge>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight font-display bg-gradient-to-r from-brand-text via-[#bcf0d5] to-brand-green bg-clip-text text-transparent leading-[1.15] py-2">
            AI-Powered Nutrition <br /> Tailored for Filipinos
          </h2>
          <p className="text-base md:text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed mt-2">
            Personalized meal plans built by advanced AI and validated against the 
            <span className="text-brand-text font-semibold"> FNRI Philippine Food Composition Table</span>. 
            Empowered by clinical reviews from licensed nutritionist specialists.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 flex-col sm:flex-row mt-4">
          <Link href="/register">
            <Button variant="primary" size="lg" className="w-52">
              Start Free Onboarding
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="w-52">
              Access Dashboard
            </Button>
          </Link>
        </div>

        {/* Visual elements demonstrating premium designs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-14 text-left">
          <Card 
            interactive 
            header={
              <div className="flex items-center justify-between">
                <span className="font-bold tracking-wide font-display text-sm">🍳 Sinigang na Bangus</span>
                <Badge variant="verified">Verified FNRI</Badge>
              </div>
            }
          >
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              Validated against Philippine Table of Food Compositions. Low calories, rich protein, and highly nutritious.
            </p>
            <div className="flex items-center justify-between text-xs font-semibold text-brand-green">
              <span>320 kcal</span>
              <div className="flex gap-3 text-brand-muted">
                <span>P: 28g</span>
                <span>C: 12g</span>
                <span>F: 8g</span>
              </div>
            </div>
          </Card>

          <Card 
            interactive 
            header={
              <div className="flex items-center justify-between">
                <span className="font-bold tracking-wide font-display text-sm">🤖 AI Planner Rotation</span>
                <Badge variant="ai">4-Model Failover</Badge>
              </div>
            }
          >
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              Rotates across Gemini 2.5 Flash, 2.0 Flash, and 1.5 Pro to ensure uptime and fast generation speeds.
            </p>
            <div className="text-xs font-bold text-brand-green flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-green animate-pulse" />
              <span>Rotations Healthy</span>
            </div>
          </Card>

          <Card 
            interactive 
            header={
              <div className="flex items-center justify-between">
                <span className="font-bold tracking-wide font-display text-sm">👩‍⚕️ RND Specialist Queue</span>
                <Badge variant="pending">Review Queue</Badge>
              </div>
            }
          >
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              Full legal compliance checklist. Safe AI suggestions reviewed and stamped by certified professionals.
            </p>
            <div className="text-xs font-semibold text-brand-text flex items-center gap-1">
              <span>Verified PRC License Required</span>
            </div>
          </Card>
        </div>
      </main>

      <footer className="border-t border-brand-border py-6 text-center text-xs text-brand-muted bg-[#141416]/30">
        <p>© 2026 NutriMind. All rights reserved. Built for Filipino health-conscious urban professionals.</p>
      </footer>
    </div>
  );
}
