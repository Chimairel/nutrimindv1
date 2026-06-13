'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Analytics {
  totalUsers: number;
  totalNutritionists: number;
  verifiedNutritionists: number;
  activeMealPlans: number;
  pendingReviews: number;
  libraryCount: number;
  totalMealLogs: number;
  totalFoodItems: number;
  totalAliases: number;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/admin/analytics');
        if (res.data?.success) setData(res.data.data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-brand-muted text-center mt-20">Failed to load analytics data.</div>;
  }

  const platformStats = [
    { label: 'Total Users', value: data.totalUsers, icon: '👥', color: 'text-blue-400', bgColor: 'bg-blue-400/10', borderColor: 'border-blue-400/20' },
    { label: 'Nutritionists', value: data.totalNutritionists, icon: '🩺', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10', borderColor: 'border-emerald-400/20' },
    { label: 'Verified RNDs', value: data.verifiedNutritionists, icon: '✅', color: 'text-brand-green', bgColor: 'bg-brand-green/10', borderColor: 'border-brand-green/20' },
  ];

  const mealStats = [
    { label: 'Active Meal Plans', value: data.activeMealPlans, icon: '🍽️', color: 'text-brand-green', bgColor: 'bg-brand-green/10', borderColor: 'border-brand-green/20' },
    { label: 'Pending Reviews', value: data.pendingReviews, icon: '⏳', color: 'text-amber-400', bgColor: 'bg-amber-400/10', borderColor: 'border-amber-400/20' },
    { label: 'Meal Library', value: data.libraryCount, icon: '📚', color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-purple-400/20' },
    { label: 'Total Meal Logs', value: data.totalMealLogs, icon: '📝', color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', borderColor: 'border-cyan-400/20' },
  ];

  const dataStats = [
    { label: 'FNRI Food Items', value: data.totalFoodItems, icon: '🥗', color: 'text-lime-400', bgColor: 'bg-lime-400/10', borderColor: 'border-lime-400/20' },
    { label: 'Food Aliases', value: data.totalAliases, icon: '🏷️', color: 'text-pink-400', bgColor: 'bg-pink-400/10', borderColor: 'border-pink-400/20' },
  ];

  const verificationRate = data.totalNutritionists > 0
    ? Math.round((data.verifiedNutritionists / data.totalNutritionists) * 100)
    : 0;

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-brand-text font-display">📈 Platform Analytics</h1>
        <p className="text-xs text-brand-muted mt-1 uppercase tracking-wider font-semibold">
          Detailed breakdown of NutriMind platform metrics
        </p>
      </div>

      {/* Platform Overview */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">👥 Users & Professionals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platformStats.map((stat, i) => (
            <Card key={i} className={`p-5 border ${stat.borderColor} ${stat.bgColor}/5`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-brand-muted mt-0.5">{stat.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Verification Rate Bar */}
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">Nutritionist Verification Rate</span>
            <span className="text-sm font-extrabold text-brand-green">{verificationRate}%</span>
          </div>
          <div className="w-full h-2 bg-brand-bgAlt rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-green to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${verificationRate}%` }}
            />
          </div>
          <p className="text-[10px] text-brand-muted mt-2">
            {data.verifiedNutritionists} of {data.totalNutritionists} nutritionists are verified
          </p>
        </Card>
      </div>

      {/* Meal System */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">🍽️ Meal System</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mealStats.map((stat, i) => (
            <Card key={i} className={`p-5 text-center border ${stat.borderColor}`}>
              <span className="text-2xl block mb-2">{stat.icon}</span>
              <div className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-brand-muted mt-1 uppercase tracking-wider font-bold">{stat.label}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Data & AI */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">🧠 Data & AI Layer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dataStats.map((stat, i) => (
            <Card key={i} className={`p-5 border ${stat.borderColor} ${stat.bgColor}/5`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{stat.icon}</span>
                <div>
                  <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value.toLocaleString()}</div>
                  <div className="text-xs text-brand-muted mt-0.5">{stat.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2 text-xs text-brand-muted">
            <span>ℹ️</span>
            <span>
              FNRI food items are the base nutrition data from the Philippine Food Composition Table. 
              Food aliases are auto-generated fuzzy matches that speed up ingredient lookups.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
