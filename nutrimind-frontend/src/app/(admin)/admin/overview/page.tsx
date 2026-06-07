'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';

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

export default function AdminOverviewPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/admin/analytics');
        if (res.data?.success) setData(res.data.data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading analytics...</span></div>;
  }

  if (!data) {
    return <div className="text-brand-muted text-center mt-20">Failed to load analytics.</div>;
  }

  const stats = [
    { label: 'Total Users', value: data.totalUsers, icon: '👥', color: 'text-blue-400' },
    { label: 'Nutritionists', value: `${data.verifiedNutritionists}/${data.totalNutritionists}`, icon: '🩺', color: 'text-emerald-400' },
    { label: 'Pending Reviews', value: data.pendingReviews, icon: '📋', color: 'text-amber-400' },
    { label: 'Active Plans', value: data.activeMealPlans, icon: '🍽️', color: 'text-brand-green' },
    { label: 'Meal Library', value: data.libraryCount, icon: '📚', color: 'text-purple-400' },
    { label: 'Total Meal Logs', value: data.totalMealLogs, icon: '📝', color: 'text-cyan-400' },
    { label: 'FNRI Food Items', value: data.totalFoodItems, icon: '🥗', color: 'text-lime-400' },
    { label: 'Food Aliases', value: data.totalAliases, icon: '🏷️', color: 'text-pink-400' },
  ];

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-5 text-center">
            <span className="text-3xl block mb-2">{stat.icon}</span>
            <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-brand-muted mt-1">{stat.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
