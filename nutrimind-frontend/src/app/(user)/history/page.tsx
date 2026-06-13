'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface MealLogEntry {
  id: string;
  mealName: string;
  source: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dataSource: string;
  status: string;
  warningType?: string;
  loggedAt?: string;
  createdAt?: string;
  scheduledDate?: string;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<MealLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'SYSTEM_GENERATED' | 'USER_LOGGED'>('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/user/meals/history');
        if (res.data?.success) {
          setLogs(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch meal logs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = filter === 'all' ? logs : logs.filter((l) => l.source === filter);

  // Helper to get the best available date from the record
  const getDate = (log: MealLogEntry): Date => {
    const raw = log.loggedAt || log.scheduledDate || log.createdAt;
    if (!raw) return new Date();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Group by date
  const groupedByDate: Record<string, MealLogEntry[]> = {};
  filteredLogs.forEach((log) => {
    const dateKey = getDate(log).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(log);
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading history...</span></div>;
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-text font-display">Meal History</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'SYSTEM_GENERATED', 'USER_LOGGED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === f
                ? 'bg-brand-green text-brand-bg'
                : 'bg-brand-card text-brand-muted hover:bg-brand-border'
            }`}
          >
            {f === 'all' ? 'All' : f === 'SYSTEM_GENERATED' ? 'Plan Meals' : 'Outside Meals'}
          </button>
        ))}
      </div>

      {/* Entries */}
      {Object.keys(groupedByDate).length === 0 ? (
        <Card className="p-8 text-center">
          <span className="text-4xl mb-3 block">📋</span>
          <p className="text-brand-muted text-sm">No meal logs found. Start logging your meals!</p>
        </Card>
      ) : (
        Object.entries(groupedByDate).map(([date, entries]) => (
          <div key={date}>
            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">{date}</h3>
            <div className="space-y-2">
              {entries.map((log) => (
                <Card key={log.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-brand-text">{log.mealName}</span>
                      {log.warningType && (
                        <Badge variant="rejected" className="text-[10px]">⚠️</Badge>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-brand-muted">
                      <span>{log.calories} kcal</span>
                      <span>P: {log.proteinG}g</span>
                      <span>C: {log.carbsG}g</span>
                      <span>F: {log.fatG}g</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.source === 'SYSTEM_GENERATED' ? 'ai' : 'user'} className="text-[10px]">
                      {log.source === 'SYSTEM_GENERATED' ? '🍽️ Plan' : '🍕 Outside'}
                    </Badge>
                    <div className="text-[10px] text-brand-muted mt-1">
                      {getDate(log).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
