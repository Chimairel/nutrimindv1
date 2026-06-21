'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Button from '@/components/ui/Button';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle, GlassWater } from 'lucide-react';


interface MealPlan {
  id: string;
  mealName: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: string;
  description: string | null;
  ingredients: { ingredientName: string }[];
}

interface NutritionReport {
  foodsToAvoid: string[];
  foodsToLimit: string[];
  foodsRecommended: string[];
  drinksGuidance: string[];
  generalSummary: string;
}

interface ProfileDetails {
  id: string;
  name: string;
  email: string;
  userProfile?: {
    age?: number;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: string;
    dailyCalorieTarget?: number;
    activityLevel?: string;
    dietaryPreference?: string;
  };
  healthConditions?: string[];
  allergies?: string[];
}

export default function ClinicalExportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileDetails | null>(null);
  const [reportData, setReportData] = useState<NutritionReport | null>(null);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all E2E datasets concurrently
  const loadClinicalData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileRes, reportRes, mealsRes] = await Promise.all([
        api.get('/user/profile'),
        api.get('/user/nutrition-report'),
        api.get('/user/meals/current'),
      ]);

      if (profileRes.data?.success) {
        setProfileData(profileRes.data.data);
      }
      if (reportRes.data?.success && reportRes.data.data) {
        setReportData(reportRes.data.data);
      }
      if (mealsRes.data?.success) {
        setMeals(mealsRes.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load clinical datasets.');
      } else {
        setError('Failed to reach backend server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadClinicalData();
    }
  }, [user]);

  // Trigger print dialog once load is complete
  useEffect(() => {
    if (!isLoading && profileData && meals.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 800); // Small timeout to ensure DOM finishes rendering
      return () => clearTimeout(timer);
    }
  }, [isLoading, profileData, meals]);

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-[#0d1b15] text-brand-text">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-semibold tracking-widest text-brand-green uppercase animate-pulse">
            Compiling Clinical Chart...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-status-error-bg/10 border border-status-error-text/30 text-status-error-text text-left">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-5 h-5 text-status-error-text" />
          <span>Error loading clinical sheet</span>
        </h3>
        <p className="text-sm mb-6">{error}</p>
        <Button variant="primary" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Format Date chronologically for print views
  const getGroupedDays = () => {
    const grouped: Record<string, MealPlan[]> = {};
    meals.forEach((meal) => {
      const dateKey = new Date(meal.scheduledDate).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    return Object.keys(grouped)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        const dateObj = new Date(dateKey);
        return {
          dateStr: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          weekday: dateObj.toLocaleDateString(undefined, { weekday: 'long' }),
          mealsList: dayMeals.sort((a, b) => {
            const order = { BREAKFAST: 1, LUNCH: 2, DINNER: 3, SNACK: 4 };
            return (order[a.mealType] || 5) - (order[b.mealType] || 5);
          }),
        };
      });
  };

  const groupedDays = getGroupedDays();
  const profile = profileData?.userProfile || {};
  const conditions = profileData?.healthConditions || [];
  const allergies = profileData?.allergies || [];

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8 md:p-12 max-w-4xl mx-auto print:p-0 font-sans leading-relaxed">
      
      {/* SCREEN-ONLY TOOLBAR */}
      <div className="print:hidden flex justify-between items-center border-b border-slate-200 pb-4 mb-8">
        <div>
          <button 
            onClick={() => router.back()}
            className="text-xs font-semibold text-slate-600 hover:text-brand-green transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-sm font-bold text-slate-800 mt-1">CLINICAL EXPORT PREVIEW</h1>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-brand-green hover:bg-[#40916c] text-white text-xs font-extrabold py-2.5 px-6 rounded-lg shadow-md transition-all cursor-pointer"
        >
          Print / Save PDF
        </button>
      </div>

      {/* ================================================================= */}
      {/* CLINICAL CHART HEADER (Optimized for printing) */}
      {/* ================================================================= */}
      <div className="border-b-4 border-double border-slate-800 pb-5 mb-8 text-left">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-serif">
              NUTRIMIND CLINICAL METRICS
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
              Official Patient Nutritional Assessment & Dietary Plan
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500 font-mono">
            <div>Report ID: {profileData?.id?.toUpperCase() || 'N/A'}</div>
            <div>Generated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: PATIENT METADATA */}
      {/* ================================================================= */}
      <div className="mb-8 text-left">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-300 pb-1 mb-3">
          1. Patient Demographics & Baseline Metrics
        </h2>
        
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-bold text-slate-500 w-1/4">Name</td>
              <td className="py-2 text-slate-800 w-1/4">{profileData?.name}</td>
              <td className="py-2 font-bold text-slate-500 w-1/4">Email</td>
              <td className="py-2 text-slate-800 w-1/4">{profileData?.email}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-bold text-slate-500">Age</td>
              <td className="py-2 text-slate-800">{profile?.age} yrs</td>
              <td className="py-2 font-bold text-slate-500">Height / Weight</td>
              <td className="py-2 text-slate-800">{profile?.heightCm} cm / {profile?.weightKg} kg</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-bold text-slate-500">Target Goal</td>
              <td className="py-2 text-slate-800 font-bold uppercase">{profile?.goal?.replace('_', ' ')}</td>
              <td className="py-2 font-bold text-slate-500">Calorie Target</td>
              <td className="py-2 text-slate-800 font-black">{profile?.dailyCalorieTarget} kcal/day</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-bold text-slate-500">Activity Level</td>
              <td className="py-2 text-slate-800 font-bold uppercase">{profile?.activityLevel?.replace('_', ' ')}</td>
              <td className="py-2 font-bold text-slate-500">Diet Preference</td>
              <td className="py-2 text-slate-800 font-bold uppercase">{profile?.dietaryPreference || 'OMNIVORE'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================================================================= */}
      {/* SECTION 2: CLINICAL CONDITIONS & ALLERGEN ALERTS */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-300 pb-1 mb-2">
            2A. Health Conditions
          </h2>
          {conditions.length === 0 ? (
            <span className="text-xs text-slate-500">No medical conditions reported.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {conditions.map((c: string) => (
                <span key={c} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-300 pb-1 mb-2">
            2B. Medical Allergens
          </h2>
          {allergies.length === 0 ? (
            <span className="text-xs text-slate-500">No food allergies reported.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {allergies.map((a: string) => (
                <span key={a} className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 3: DIETARY GUIDANCE & NUTRITION REPORT */}
      {/* ================================================================= */}
      {reportData && (
        <div className="mb-8 text-left page-break-inside-avoid">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-300 pb-1 mb-3">
            3. AI Dietitian Assessment & Guidelines
          </h2>
          
          <p className="text-xs text-slate-600 italic mb-4 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
            &ldquo;{reportData.generalSummary}&rdquo;
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 p-3 rounded-lg">
              <span className="font-extrabold text-red-700 uppercase mb-1 flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-red-700 shrink-0" />
                <span>Avoid Categories</span>
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                {(reportData.foodsToAvoid || []).map((food, i) => <li key={i}>{food}</li>)}
              </ul>
            </div>
            <div className="border border-slate-200 p-3 rounded-lg">
              <span className="font-extrabold text-amber-700 uppercase mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Limit Categories</span>
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                {(reportData.foodsToLimit || []).map((food, i) => <li key={i}>{food}</li>)}
              </ul>
            </div>
            <div className="border border-slate-200 p-3 rounded-lg">
              <span className="font-extrabold text-green-700 uppercase mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
                <span>Recommended Categories</span>
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                {(reportData.foodsRecommended || []).map((food, i) => <li key={i}>{food}</li>)}
              </ul>
            </div>
            <div className="border border-slate-200 p-3 rounded-lg">
              <span className="font-extrabold text-blue-700 uppercase mb-1 flex items-center gap-1.5">
                <GlassWater className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Drinks & Hydration</span>
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-700 flex flex-col gap-0.5 mt-1">
                {(reportData.drinksGuidance || []).map((food, i) => <li key={i}>{food}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SECTION 4: 7-DAY MEAL PLAN GRID */}
      {/* ================================================================= */}
      <div className="text-left page-break-before-always">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-300 pb-1 mb-4">
          4. Structured 7-Day Filipino Meal Plan (21 Meals)
        </h2>

        <div className="flex flex-col gap-6">
          {groupedDays.map((day) => (
            <div key={day.dateStr} className="border border-slate-300 rounded-lg overflow-hidden page-break-inside-avoid shadow-sm">
              
              {/* Day Title bar */}
              <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center text-xs font-black text-slate-800">
                <span className="uppercase">{day.weekday} — {day.dateStr}</span>
                <span className="text-[10px] text-slate-500 font-mono">CALORIE CAP TARGET ACTIVE</span>
              </div>

              {/* Meals Rows */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-bold uppercase">
                    <th className="py-2 px-3 text-left w-1/6">Meal</th>
                    <th className="py-2 px-3 text-left w-1/2">Menu Item & Ingredients</th>
                    <th className="py-2 px-3 text-center w-1/12">Calories</th>
                    <th className="py-2 px-3 text-center w-1/4">Macros (P / C / F)</th>
                  </tr>
                </thead>
                <tbody>
                  {day.mealsList.map((meal) => (
                    <tr key={meal.id} className="border-b border-slate-100 align-top hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-slate-700 uppercase">
                        {meal.mealType}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900">{meal.mealName}</div>
                        {meal.description && (
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{meal.description}</div>
                        )}
                        <div className="text-[9px] text-slate-400 font-medium uppercase mt-1.5">
                          Ingredients: {meal.ingredients.map((i) => i.ingredientName).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 text-center">
                        {Math.round(meal.calories)} kcal
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[10px] text-slate-600">
                        {Math.round(meal.proteinG)}g P / {Math.round(meal.carbsG)}g C / {Math.round(meal.fatG)}g F
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SIGNATURE BLOCK */}
      {/* ================================================================= */}
      <div className="mt-12 pt-8 border-t border-slate-200 text-left page-break-inside-avoid">
        <div className="grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div>
            <div className="border-b border-slate-300 w-48 h-8 mb-1"></div>
            <span className="font-bold">Patient Signature / Consent</span>
            <div className="text-[9px] mt-0.5">I agree and accept the terms of the nutrition plan outline.</div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="border-b border-slate-300 w-48 h-8 mb-1"></div>
            <span className="font-bold">Dietitian / Nutritionist Verification</span>
            <div className="text-[9px] mt-0.5">Verified electronically under clinical safety standards.</div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STRICT PRINT STYLES */}
      {/* ================================================================= */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: #0f172a !important;
            font-size: 11px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .page-break-before-always {
            page-break-before: always !important;
            break-before: always !important;
          }
          /* Ensure headers display black in printing */
          h1, h2, h3, td, th {
            color: #0f172a !important;
            text-shadow: none !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

    </div>
  );
}
