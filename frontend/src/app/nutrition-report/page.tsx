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
import { AlertTriangle, ClipboardList, Download, XCircle, Check, Droplet } from 'lucide-react';


export default function NutritionReportPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [report, setReport] = useState<NutritionReport | null>(null);
  const [profileData, setProfileData] = useState<{
    name: string;
    goal: string;
    dailyCalorieTarget: number;
    conditions: string[];
    allergies: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const extractRestrictionKeys = (values: unknown, objectKey: 'condition' | 'allergen') => {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && objectKey in value) {
          const candidate = (value as Record<string, unknown>)[objectKey];
          return typeof candidate === 'string' ? candidate : '';
        }
        return '';
      })
      .filter((value) => value && value !== 'NONE');
  };

  const normalizeContext = (values: unknown) => Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value && value !== 'NONE')
  )).sort();

  const hasSameContext = (left: unknown, right: unknown) => {
    const normalizedLeft = normalizeContext(left);
    const normalizedRight = normalizeContext(right);
    return normalizedLeft.length === normalizedRight.length
      && normalizedLeft.every((value, index) => value === normalizedRight[index]);
  };

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        // Fetch profile data for the summary card
        const profileRes = await api.get('/user/profile');
        if (profileRes.data?.success) {
          const p = profileRes.data.data;
          setProfileData({
            name: p.name || 'User',
            goal: p.userProfile?.goal || 'MAINTAIN',
            dailyCalorieTarget: p.userProfile?.dailyCalorieTarget || 0,
            conditions: extractRestrictionKeys(p.healthConditions, 'condition'),
            allergies: extractRestrictionKeys(p.allergies, 'allergen'),
          });
        }

        // Try getting existing report first
        const getRes = await api.get('/user/nutrition-report');
        if (getRes.data && getRes.data.success && getRes.data.data) {
          setReport(getRes.data.data);
        } else {
          // If none exists, trigger a generation
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

  const handleRegenerate = async () => {
    setError(null);
    setIsRegenerating(true);
    try {
      const response = await api.post('/user/nutrition-report/generate');
      if (!response.data?.success || !response.data.data) {
        throw new Error('The updated report was not returned.');
      }
      setReport(response.data.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Unable to regenerate your report. Please try again.');
      } else {
        setError('Unable to regenerate your report. Please try again.');
      }
    } finally {
      setIsRegenerating(false);
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

  if (!report) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 border-brand-border/60 bg-brand-surface/30">
          <AlertTriangle className="w-12 h-12 text-status-error-text mx-auto mb-4" />
          <h3 className="text-lg font-bold font-display text-brand-text mb-2">Report Resolution Failed</h3>
          <p className="text-xs text-brand-muted leading-relaxed mb-6">{error || 'An unexpected error occurred.'}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const reportMatchesCurrentProfile = profileData
    ? hasSameContext(report.basedOnConditions, profileData.conditions)
      && hasSameContext(report.basedOnAllergies, profileData.allergies)
    : false;

  if (!reportMatchesCurrentProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6 text-center text-brand-text">
        <Card className="max-w-lg border-status-pending-text/30 bg-brand-surface/90 p-8 shadow-card-lg">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-status-pending-text" />
          <p className="portal-kicker !text-status-pending-text">Health context changed</p>
          <h1 className="mt-3 font-display text-2xl font-black">Your nutrition report needs an update</h1>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Your conditions or allergies changed after this report was created. The older guidance is hidden so it cannot conflict with your current health profile.
          </p>
          {error && <p role="alert" className="mt-4 text-xs font-semibold text-status-error-text">{error}</p>}
          <Button variant="primary" onClick={handleRegenerate} isLoading={isRegenerating} className="mt-6 w-full">
            Generate updated report
          </Button>
        </Card>
      </div>
    );
  }

  // Format array elements cleanly
  const renderList = (items: unknown) => {
    let arr: unknown[] = [];
    if (Array.isArray(items)) {
      arr = items;
    } else if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        arr = [];
      }
    }
    return (
      <ul className="flex flex-col gap-2.5">
        {arr.filter((item): item is string => typeof item === 'string').map((item, idx) => (
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-6 max-w-6xl mx-auto w-full text-left">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-6 h-6 text-brand-green shrink-0" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green">
              PERSONAL NUTRITION REPORT
            </h1>
          </div>
          <p className="text-xs text-brand-muted">
            Clinical guidelines compiled by NutriMind AI and cross-referenced with FNRI index standards.
          </p>
        </div>
        <Button variant="secondary" onClick={handleDownloadPDF} className="flex items-center gap-2 text-xs font-semibold py-2">
          <Download className="w-4 h-4" />
          <span>Download PDF</span>
        </Button>
      </div>


      {/* Main layout container */}
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Core Summary card */}
        <Card className="p-6 border-brand-border/60 bg-gradient-to-br from-brand-surface to-brand-bgAlt relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-32 bg-brand-green/5 blur-xl rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-between text-left">
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Name</span>
              <p className="text-base font-bold text-brand-text font-display">{profileData?.name || user?.name || 'User'}</p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Active Goal</span>
              <Badge variant="verified">
                {profileData?.goal?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Maintain'}
              </Badge>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Calorie Target</span>
              <p className="text-xl font-extrabold text-brand-green font-display">
                {profileData?.dailyCalorieTarget ? profileData.dailyCalorieTarget.toLocaleString() : '—'} kcal <span className="text-xs font-normal text-brand-muted">/ day</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Health Restrictions</span>
              <div className="flex gap-1.5 flex-wrap">
                {profileData && (profileData.conditions.length > 0 || profileData.allergies.length > 0) ? (
                  [...profileData.conditions, ...profileData.allergies].map((restriction, idx) => restriction ? (
                    <Badge key={idx} variant="rejected">
                      {String(restriction).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Badge>
                  ) : null)
                ) : (
                  <span className="text-xs text-brand-muted">None reported</span>
                )}
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
                  <XCircle className="w-4 h-4 text-status-error-text shrink-0" />
                  <span>Foods to Avoid completely</span>
                </h4>
                {renderList(report.foodsToAvoid)}
              </Card>
            </TabsContent>
            <TabsContent value="limit">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-status-pending-text tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <AlertTriangle className="w-4 h-4 text-status-pending-text shrink-0" />
                  <span>Foods to Limit/Control portions</span>
                </h4>
                {renderList(report.foodsToLimit)}
              </Card>
            </TabsContent>
            <TabsContent value="good">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-brand-green tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <Check className="w-4 h-4 text-brand-green stroke-[3px] shrink-0" />
                  <span>Recommended Foods to increase</span>
                </h4>
                {renderList(report.foodsRecommended)}
              </Card>
            </TabsContent>
            <TabsContent value="drinks">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-blue-400 tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Drinking and Hydration targets</span>
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
              <XCircle className="w-4 h-4 text-status-error-text shrink-0" />
              <span>Foods to Avoid</span>
            </h4>
            {renderList(report.foodsToAvoid)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-status-pending-text tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <AlertTriangle className="w-4 h-4 text-status-pending-text shrink-0" />
              <span>Foods to Limit</span>
            </h4>
            {renderList(report.foodsToLimit)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-brand-green tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <Check className="w-4 h-4 text-brand-green stroke-[3px] shrink-0" />
              <span>Recommended</span>
            </h4>
            {renderList(report.foodsRecommended)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Hydration Goals</span>
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
