'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { NutritionReport } from '@/types';
import axios from 'axios';

export default function NutritionReportPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [report, setReport] = useState<NutritionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        // Try getting existing report first
        const getRes = await api.get('/user/nutrition-report');
        if (getRes.data && getRes.data.success && getRes.data.data) {
          setReport(getRes.data.data);
        } else {
          // If none exists, trigger a generation (which currently yields backend mock data)
          const genRes = await api.post('/user/nutrition-report/generate');
          if (genRes.data && genRes.data.success) {
            setReport(genRes.data.data);
          } else {
            setError('Failed to load your nutrition report.');
          }
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.error || 
            'Unable to load your customized report. Please verify your connection.'
          );
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchReport();
    }
  }, [user]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await api.post('/user/nutrition-report/acknowledge');
      
      // Sync state context parameters (so RouteGuard releases dashboard lock)
      await refreshSession();

      // Proceed to the dashboard
      router.push('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Failed to acknowledge the report. Please try again.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Stream PDF directly from backend PDF endpoint
      const response = await api.get('/user/nutrition-report/pdf', {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `NutriMind_Nutrition_Report_${user?.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[Nutrition Report] Failed to fetch report PDF:', err);
      alert('PDF generation is only unlocked when the backend template service is active in Phase 8.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-brand-muted animate-pulse font-display font-semibold">
            Analyzing metrics & compiling standard FNRI data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 border-brand-border/60 bg-brand-surface/30">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h3 className="text-lg font-bold font-display text-brand-text mb-2">Report Resolution Failed</h3>
          <p className="text-xs text-brand-muted leading-relaxed mb-6">{error || 'An unexpected error occurred.'}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Format array elements cleanly
  const renderList = (items: unknown) => {
    const arr = Array.isArray(items) 
      ? items 
      : typeof items === 'string' 
        ? JSON.parse(items) 
        : [];
    return (
      <ul className="flex flex-col gap-2.5">
        {arr.map((item: string, idx: number) => (
          <li key={idx} className="text-xs leading-relaxed text-brand-text flex items-start gap-2 bg-brand-bgAlt/50 p-2.5 rounded-xl border border-brand-border/40">
            <span className="text-brand-green text-sm leading-none">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 md:p-12 flex flex-col gap-8 pb-32 relative select-none">
      <div className="absolute top-[10%] left-[50%] translate-x-[-50%] h-[400px] w-[600px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-6 max-w-6xl mx-auto w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📋</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green">
              PERSONAL NUTRITION REPORT
            </h1>
          </div>
          <p className="text-xs text-brand-muted">
            Clinical guidelines compiled by NutriMind AI and cross-referenced with FNRI index standards.
          </p>
        </div>
        <Button variant="secondary" onClick={handleDownloadPDF} className="flex items-center gap-2 text-xs font-semibold py-2">
          <span>📥</span>
          <span>Download PDF</span>
        </Button>
      </div>

      {/* Main layout container */}
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
        
        {/* Core Summary card */}
        <Card className="p-6 border-brand-border/60 bg-gradient-to-br from-[#1a1a1e] to-[#141416] relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-32 bg-brand-green/5 blur-xl rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-between text-left">
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Age & Status</span>
              <p className="text-base font-bold text-brand-text font-display">Juan Dela Cruz</p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Active Goal</span>
              <Badge variant="verified">Maintain Weight</Badge>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Calorie Target</span>
              <p className="text-xl font-extrabold text-brand-green font-display">2,150 kcal <span className="text-xs font-normal text-brand-muted">/ day</span></p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Health Restrictions</span>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="rejected">Hypertension</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Narrative General Summary */}
        <Card className="p-6 border-brand-border/60 bg-brand-surface/40">
          <h3 className="text-sm font-bold tracking-wide uppercase text-brand-green mb-2 font-display">General Dietary Assessment</h3>
          <p className="text-xs md:text-sm text-brand-muted leading-relaxed">
            {report.generalSummary}
          </p>
        </Card>

        {/* Mobile Layout: Responsive Tab View */}
        <div className="md:hidden">
          <Tabs defaultValue="avoid">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="avoid" className="flex-1">Avoid</TabsTrigger>
              <TabsTrigger value="limit" className="flex-1">Limit</TabsTrigger>
              <TabsTrigger value="good" className="flex-1">Good</TabsTrigger>
              <TabsTrigger value="drinks" className="flex-1">Drinks</TabsTrigger>
            </TabsList>
            <TabsContent value="avoid">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-status-error-text tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <span>❌</span> Foods to Avoid completely
                </h4>
                {renderList(report.foodsToAvoid)}
              </Card>
            </TabsContent>
            <TabsContent value="limit">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-status-pending-text tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <span>⚠️</span> Foods to Limit/Control portions
                </h4>
                {renderList(report.foodsToLimit)}
              </Card>
            </TabsContent>
            <TabsContent value="good">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-brand-green tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <span>✓</span> Recommended Foods to increase
                </h4>
                {renderList(report.foodsRecommended)}
              </Card>
            </TabsContent>
            <TabsContent value="drinks">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-blue-400 tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <span>💧</span> Drinking and Hydration targets
                </h4>
                {renderList(report.drinksGuidance)}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Layout: Sleek Grid Columns */}
        <div className="hidden md:grid grid-cols-4 gap-6">
          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-status-error-text tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <span>❌</span> Foods to Avoid
            </h4>
            {renderList(report.foodsToAvoid)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-status-pending-text tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <span>⚠️</span> Foods to Limit
            </h4>
            {renderList(report.foodsToLimit)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-brand-green tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <span>✓</span> Recommended
            </h4>
            {renderList(report.foodsRecommended)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <span>💧</span> Hydration Goals
            </h4>
            {renderList(report.drinksGuidance)}
          </Card>
        </div>

      </div>

      {/* Sticky Acknowledge Banner at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-surface/90 border-t border-brand-border py-4 px-6 backdrop-blur-md shadow-2xl flex items-center justify-center">
        <div className="max-w-6xl w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[11px] md:text-xs text-brand-muted leading-relaxed max-w-2xl text-center md:text-left">
            By clicking acknowledge, you confirm that you have read our medical limitations disclaimers and understand that NutriMind recommendations are AI-generated estimations.
          </p>
          <Button 
            variant="primary" 
            onClick={handleAcknowledge} 
            className="px-8 py-3 text-sm font-bold tracking-wide shadow-xl min-w-[200px]"
            isLoading={isAcknowledging}
          >
            I Acknowledge Report
          </Button>
        </div>
      </div>

    </div>
  );
}
