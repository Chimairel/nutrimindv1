'use client';

import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

export type ActivityViewMode = 'Daily' | 'Weekly' | 'Cumulative';

interface MealActivityCalendarProps {
  logs: MealHistoryLog[];
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string) => void;
  className?: string;
}

interface DayCell {
  dateKey: string;
  date: Date;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  monthName: string;
  isCurrentMonth: boolean;
  mealCount: number;
  totalCalories: number;
  isToday: boolean;
  isFuture: boolean;
}

export default function MealActivityCalendar({
  logs,
  selectedDateKey,
  onSelectDateKey,
  className = '',
}: MealActivityCalendarProps) {
  const [viewMode, setViewMode] = useState<ActivityViewMode>('Daily');
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);

  // Group logs by dateKey for fast O(1) lookup
  const logsByDate = useMemo(() => {
    const map = new Map<string, { count: number; calories: number }>();
    logs.forEach((log) => {
      const key = getManilaDateKey(log.loggedAt);
      if (!key) return;
      const existing = map.get(key) || { count: 0, calories: 0 };
      map.set(key, {
        count: existing.count + 1,
        calories: existing.calories + (log.calories || 0),
      });
    });
    return map;
  }, [logs]);

  // Generate 40 weeks leading up to the end of the current week in Manila
  const { weeks, monthLabels, totalLoggedDays } = useMemo(() => {
    const todayKey = getManilaDateKey();
    const todayDate = manilaDateFromKey(todayKey);

    // End on the coming Saturday (or today's week end)
    const endOfWeek = new Date(todayDate);
    const dayOfWeek = endOfWeek.getDay(); // 0 = Sunday
    endOfWeek.setDate(endOfWeek.getDate() + (6 - dayOfWeek));

    const totalWeeks = 38; // 38 weeks gives optimal density for desktop & mobile
    const totalDays = totalWeeks * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    const generatedWeeks: DayCell[][] = [];
    const months: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = '';
    let currentWeek: DayCell[] = [];

    let loggedDaysCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(cellDate.getDate() + i);

      const cellDateKey = getManilaDateKey(cellDate);
      const isToday = cellDateKey === todayKey;
      const isFuture = cellDateKey > todayKey;

      const activity = logsByDate.get(cellDateKey);
      const mealCount = activity?.count ?? 0;
      const totalCalories = activity?.calories ?? 0;

      if (mealCount > 0) {
        loggedDaysCount++;
      }

      const mName = formatManilaDate(cellDate, { month: 'short' });
      const weekIdx = Math.floor(i / 7);

      if (mName !== lastMonth && cellDate.getDate() <= 14) {
        months.push({ label: mName, weekIndex: weekIdx });
        lastMonth = mName;
      }

      const cell: DayCell = {
        dateKey: cellDateKey,
        date: cellDate,
        dayOfWeek: cellDate.getDay(),
        monthName: mName,
        isCurrentMonth: cellDate.getMonth() === todayDate.getMonth(),
        mealCount,
        totalCalories,
        isToday,
        isFuture,
      };

      currentWeek.push(cell);

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return {
      weeks: generatedWeeks,
      monthLabels: months,
      totalLoggedDays: loggedDaysCount,
    };
  }, [logsByDate]);

  // Color mapping inspired by Image 1 (warm amber/terracotta/orange glowing tokens)
  const getCellColor = (cell: DayCell) => {
    if (cell.isFuture) {
      return 'bg-brand-border/20 dark:bg-white/[0.02] border-transparent opacity-30 cursor-not-allowed';
    }
    if (cell.mealCount === 0) {
      return 'bg-brand-border/40 dark:bg-white/[0.05] border-transparent hover:border-brand-border hover:bg-brand-border/70 dark:hover:bg-white/[0.12]';
    }

    if (viewMode === 'Cumulative') {
      if (cell.totalCalories >= 2000) {
        return 'bg-[#ff7a00] text-black border-[#ff7a00]/40 shadow-[0_0_8px_rgba(255,122,0,0.5)]';
      }
      if (cell.totalCalories >= 1200) {
        return 'bg-[#e06500] text-white border-[#e06500]/40';
      }
      return 'bg-[#994700] text-white border-[#994700]/40';
    }

    // Daily / Weekly meal count levels matching Image 1
    if (cell.mealCount >= 3) {
      return 'bg-[#ff7a00] border-[#ff7a00]/50 shadow-[0_0_8px_rgba(255,122,0,0.55)]';
    }
    if (cell.mealCount === 2) {
      return 'bg-[#d05c04] border-[#d05c04]/40';
    }
    return 'bg-[#7c3806] border-[#7c3806]/40';
  };

  return (
    <div
      className={`rounded-[26px] border border-brand-border/80 bg-brand-surface p-5 sm:p-6 shadow-card text-left transition-colors dark:border-white/10 dark:bg-[#0c1511] ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-brand-border/60 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-brand-green dark:text-brand-accent">
              Intake timeline
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-bold text-brand-green dark:bg-brand-accent/15 dark:text-brand-accent">
              <Sparkles className="h-2.5 w-2.5" />
              {totalLoggedDays} active days
            </span>
          </div>
          <h3 className="mt-1 font-display text-lg sm:text-xl font-black tracking-tight text-brand-text dark:text-white">
            Activity Matrix
          </h3>
        </div>

        {/* View Mode Pills inspired by Image 1 ("Daily", "Weekly", "Cumulative") */}
        <div className="flex items-center gap-1 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {(['Daily', 'Weekly', 'Cumulative'] as ActivityViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all duration-150 ${
                viewMode === mode
                  ? 'bg-brand-surface text-brand-text shadow-sm dark:bg-[#15231c] dark:text-white'
                  : 'text-brand-muted hover:text-brand-text dark:text-white/40 dark:hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Matrix Body */}
      <div className="relative mt-5">
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="inline-block min-w-full">
            {/* Grid Container */}
            <div className="flex gap-1.5">
              {/* Day of Week Axis (Sun, Mon, Tue, Wed, Thu, Fri, Sat) */}
              <div className="flex flex-col justify-between pr-2 text-[9px] font-mono text-brand-muted dark:text-white/30 select-none py-0.5">
                <span>Sun</span>
                <span>Tue</span>
                <span>Thu</span>
                <span>Sat</span>
              </div>

              {/* Weeks Columns */}
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
                    {week.map((cell) => {
                      const isSelected = selectedDateKey === cell.dateKey;
                      return (
                        <button
                          key={cell.dateKey}
                          type="button"
                          disabled={cell.isFuture}
                          onClick={() => onSelectDateKey(cell.dateKey)}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          onFocus={() => setHoveredCell(cell)}
                          onBlur={() => setHoveredCell(null)}
                          aria-label={`${cell.dateKey}: ${cell.mealCount} meals logged`}
                          aria-pressed={isSelected}
                          className={`relative h-3.5 w-3.5 rounded-[4px] border transition-all duration-150 outline-none sm:h-4 sm:w-4 ${getCellColor(
                            cell
                          )} ${
                            isSelected
                              ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:ring-brand-accent dark:ring-offset-[#0c1511] z-10 scale-110'
                              : ''
                          } focus-visible:ring-2 focus-visible:ring-brand-green`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Month Labels along the bottom */}
            <div className="relative mt-2 h-4 pl-8 text-[10px] font-mono text-brand-muted dark:text-white/40 select-none flex justify-between">
              {monthLabels.map((m) => (
                <span key={`${m.label}-${m.weekIndex}`} className="inline-block">
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Hover Tooltip Card / Status Bar */}
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-brand-border/50 bg-brand-bgAlt/40 p-3 dark:border-white/5 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />
            {hoveredCell ? (
              <span className="font-semibold text-brand-text dark:text-white">
                <span className="font-bold text-brand-green dark:text-brand-accent">
                  {formatManilaDate(hoveredCell.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                : {hoveredCell.mealCount} meal{hoveredCell.mealCount !== 1 ? 's' : ''} logged
                {hoveredCell.mealCount > 0 && ` (${Math.round(hoveredCell.totalCalories)} kcal)`}
              </span>
            ) : selectedDateKey ? (
              <span className="font-semibold text-brand-text dark:text-white">
                Selected date:{' '}
                <span className="font-bold text-brand-green dark:text-brand-accent">
                  {formatManilaDate(manilaDateFromKey(selectedDateKey), {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </span>
            ) : (
              <span className="text-brand-muted dark:text-white/50">
                Click any day in the calendar to view its logged meals below
              </span>
            )}
          </div>

          {/* Activity Scale Legend */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[10px] font-mono text-brand-muted dark:text-white/40">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[3px] bg-brand-border/40 dark:bg-white/[0.05]" />
            <span className="h-3 w-3 rounded-[3px] bg-[#7c3806]" />
            <span className="h-3 w-3 rounded-[3px] bg-[#d05c04]" />
            <span className="h-3 w-3 rounded-[3px] bg-[#ff7a00] shadow-[0_0_6px_rgba(255,122,0,0.5)]" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
