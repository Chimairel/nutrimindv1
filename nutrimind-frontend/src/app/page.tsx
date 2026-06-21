'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useTheme } from '@/lib/context/ThemeContext';
import { Brain, Soup, Bot, UserCheck } from 'lucide-react';

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg text-brand-text select-none relative">
      {/* Navbar segment */}
      <header className="flex h-16 items-center justify-between border-b border-brand-border px-6 md:px-12 bg-brand-bg/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-brand-green" />
          <h1 className="font-extrabold text-lg tracking-wider text-brand-green font-display">NUTRIMIND</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-brand-bgAlt/50 text-brand-text hover:text-brand-green hover:border-brand-green/30 hover:scale-105 active:scale-95 transition-all duration-200 outline-none cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>

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
                <div className="flex items-center gap-2">
                  <Soup className="w-4 h-4 text-brand-green" />
                  <span className="font-bold tracking-wide font-display text-sm">Sinigang na Bangus</span>
                </div>
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
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-brand-green" />
                  <span className="font-bold tracking-wide font-display text-sm">AI Planner Rotation</span>
                </div>
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
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand-green" />
                  <span className="font-bold tracking-wide font-display text-sm">RND Specialist Queue</span>
                </div>
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

      <footer className="border-t border-brand-border py-6 text-center text-xs text-brand-muted bg-brand-bgAlt/30">
        <p>© 2026 NutriMind. All rights reserved. Built for Filipino health-conscious urban professionals.</p>
      </footer>
    </div>
  );
}
