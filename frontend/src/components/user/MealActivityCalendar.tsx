'use client';

import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

export type ActivityTimeRange = 'Year' | 'Month' | 'Week';

export interface MonthColumnData {
  year: number;
  monthIndex: number;
  name: string;
  fullLabel: string;
  isFuture: boolean;
  isCurrent: boolean;
  activeDaysCount: number;
  weeks: (DayCell | null)[][];
}

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
  isOutOfBounds?: boolean;
}

export default function MealActivityCalendar({
  logs,
  selectedDateKey,
  onSelectDateKey,
  className = '',
}: MealActivityCalendarProps) {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>('Year');
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);
  const [monthOffset, setMonthOffset] = useState<number>(0);

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

  // Generate weeks based on timeRange (Year = full 52/53-week calendar year, Week = 1 week)
  const { weeks, monthLabels, totalLoggedDays } = useMemo(() => {
    const todayKey = getManilaDateKey();
    const todayDate = manilaDateFromKey(todayKey);
    const todayYear = todayDate.getFullYear();

    if (timeRange === 'Year') {
      // Full calendar year: start from the Sunday of the week containing Jan 1
      const jan1 = new Date(todayYear, 0, 1);
      const startDayOfWeek = jan1.getDay(); // 0 = Sunday
      const startDate = new Date(jan1);
      startDate.setDate(jan1.getDate() - startDayOfWeek);

      // End on the Saturday of the week containing Dec 31
      const dec31 = new Date(todayYear, 11, 31);
      const endDayOfWeek = dec31.getDay(); // 0 = Sunday, 6 = Saturday
      const endDate = new Date(dec31);
      endDate.setDate(dec31.getDate() + (6 - endDayOfWeek));

      const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      const generatedWeeks: DayCell[][] = [];
      const months: Array<{ label: string; weekIndex: number }> = [];
      const seenMonths = new Set<number>();
      let currentWeek: DayCell[] = [];
      let loggedDaysCount = 0;

      for (let i = 0; i < totalDays; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + i);

        const isCurrentYear = cellDate.getFullYear() === todayYear;
        const cellDateKey = getManilaDateKey(cellDate);
        const isToday = isCurrentYear && cellDateKey === todayKey;
        const isFuture = isCurrentYear && cellDateKey > todayKey;

        const activity = isCurrentYear ? logsByDate.get(cellDateKey) : undefined;
        const mealCount = activity?.count ?? 0;
        const totalCalories = activity?.calories ?? 0;

        if (isCurrentYear && mealCount > 0) {
          loggedDaysCount++;
        }

        const weekIdx = Math.floor(i / 7);

        // Track the first week column that contains the start of each month in this calendar year
        if (isCurrentYear) {
          const monthIdx = cellDate.getMonth();
          if (!seenMonths.has(monthIdx)) {
            seenMonths.add(monthIdx);
            months.push({
              label: formatManilaDate(cellDate, { month: 'short' }),
              weekIndex: weekIdx,
            });
          }
        }

        const cell: DayCell = {
          dateKey: cellDateKey,
          date: cellDate,
          dayOfWeek: cellDate.getDay(),
          monthName: formatManilaDate(cellDate, { month: 'short' }),
          isCurrentMonth: isCurrentYear && cellDate.getMonth() === todayDate.getMonth(),
          mealCount,
          totalCalories,
          isToday,
          isFuture,
          isOutOfBounds: !isCurrentYear,
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
    }

    if (timeRange === 'Week') {
      // Current week from Sunday to Saturday (7 days)
      const dayOfWeek = todayDate.getDay(); // 0 = Sun
      const startDate = new Date(todayDate);
      startDate.setDate(todayDate.getDate() - dayOfWeek);

      const currentWeek: DayCell[] = [];
      let loggedDaysCount = 0;

      for (let i = 0; i < 7; i++) {
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

        currentWeek.push({
          dateKey: cellDateKey,
          date: cellDate,
          dayOfWeek: cellDate.getDay(),
          monthName: formatManilaDate(cellDate, { month: 'short' }),
          isCurrentMonth: cellDate.getMonth() === todayDate.getMonth(),
          mealCount,
          totalCalories,
          isToday,
          isFuture,
        });
      }

      return {
        weeks: [currentWeek],
        monthLabels: [
          {
            label: formatManilaDate(todayDate, { month: 'short' }),
            weekIndex: 0,
          },
        ],
        totalLoggedDays: loggedDaysCount,
      };
    }

    // Month mode uses threeMonthsData directly
    return {
      weeks: [],
      monthLabels: [],
      totalLoggedDays: 0,
    };
  }, [logsByDate, timeRange]);

  // 3-Month Carousel computation for Month view
  const threeMonthsData = useMemo(() => {
    const todayKey = getManilaDateKey();
    const todayDate = manilaDateFromKey(todayKey);
    const todayYear = todayDate.getFullYear();
    const todayMonthIndex = todayDate.getMonth();

    const offsets = [-1, 0, 1] as const;

    const months: MonthColumnData[] = offsets.map((delta) => {
      const relOffset = monthOffset + delta;
      const totalTargetMonths = todayYear * 12 + todayMonthIndex + relOffset;
      const targetYear = Math.floor(totalTargetMonths / 12);
      const targetMonthIndex = ((totalTargetMonths % 12) + 12) % 12;

      const isFuture = totalTargetMonths > todayYear * 12 + todayMonthIndex;
      const isCurrent = totalTargetMonths === todayYear * 12 + todayMonthIndex;

      const firstDayKey = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-01`;
      const firstDayDate = manilaDateFromKey(firstDayKey);
      const startDayOfWeek = firstDayDate.getDay();

      const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();

      const rawWeeks: (DayCell | null)[][] = Array.from({ length: 6 }, () => Array(7).fill(null));
      let activeDays = 0;

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dayKey = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const cellDate = manilaDateFromKey(dayKey);
        const dow = cellDate.getDay();

        const slotIndex = startDayOfWeek + (dayNum - 1);
        const weekRow = Math.floor(slotIndex / 7);

        if (weekRow < 6) {
          const isToday = dayKey === todayKey;
          const isCellFuture = isFuture || dayKey > todayKey;

          const activity = logsByDate.get(dayKey);
          const mealCount = isFuture ? 0 : (activity?.count ?? 0);
          const totalCalories = isFuture ? 0 : (activity?.calories ?? 0);

          if (mealCount > 0) {
            activeDays++;
          }

          rawWeeks[weekRow][dow] = {
            dateKey: dayKey,
            date: cellDate,
            dayOfWeek: dow,
            monthName: formatManilaDate(cellDate, { month: 'short' }),
            isCurrentMonth: isCurrent,
            mealCount,
            totalCalories,
            isToday,
            isFuture: isCellFuture,
          };
        }
      }

      const activeWeeks = rawWeeks.filter((row) => row.some((cell) => cell !== null));
      const name = formatManilaDate(firstDayDate, { month: 'long' }).toUpperCase();
      const fullLabel = formatManilaDate(firstDayDate, { month: 'long', year: 'numeric' });

      return {
        year: targetYear,
        monthIndex: targetMonthIndex,
        name,
        fullLabel,
        isFuture,
        isCurrent,
        activeDaysCount: activeDays,
        weeks: activeWeeks,
      };
    });

    return {
      prevMonth: months[0],
      centerMonth: months[1],
      nextMonth: months[2],
    };
  }, [logsByDate, monthOffset]);

  const canGoNext = monthOffset < 0;

  const handlePrevMonth = () => {
    setMonthOffset((prev) => prev - 1);
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setMonthOffset((prev) => prev + 1);
    }
  };

  // Color mapping using NutriMind's theme palette:
  // Level 0: Muted sage-gray neutral with crisp border
  // Level 1 (1 meal): Soft mint emerald (#a7f3d0 / dark #064e3b)
  // Level 2 (2 meals): Signature forest pine (#08705b / dark #08705b)
  // Level 3 (3+ meals): Electric lime accent with glow (#b8f45f)
  const getCellColor = (cell: DayCell) => {
    if (cell.isFuture) {
      return 'border border-dashed border-brand-border/60 bg-[#f4f7f5] opacity-40 cursor-not-allowed dark:border-white/[0.04] dark:bg-white/[0.02] dark:opacity-30';
    }
    if (cell.mealCount === 0) {
      return 'border border-[#c6d6ce] bg-[#e8efec] hover:border-brand-green/40 hover:bg-[#dce8e0] dark:border-white/[0.08] dark:bg-[#14221b] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.12]';
    }

    // High activity / 3+ meals: NutriMind Electric Lime Glow
    if (cell.mealCount >= 3 || cell.totalCalories >= 1800) {
      return 'border border-[#99db3a] bg-[#b8f45f] text-black font-black shadow-[0_0_10px_rgba(184,244,95,0.7)] dark:border-[#b8f45f] dark:bg-[#b8f45f] dark:text-black dark:shadow-[0_0_12px_rgba(184,244,95,0.75)]';
    }
    // Moderate activity / 2 meals: NutriMind Forest Pine
    if (cell.mealCount === 2 || cell.totalCalories >= 1000) {
      return 'border border-[#065947] bg-[#08705b] text-white dark:border-[#10b981]/60 dark:bg-[#08705b] dark:text-white';
    }
    // Light activity / 1 meal: Soft Mint Emerald
    return 'border border-[#6ee7b7] bg-[#a7f3d0] text-emerald-950 dark:border-[#065f46] dark:bg-[#064e3b] dark:text-emerald-100';
  };

  const renderMonthCard = (monthData: MonthColumnData, isCenter: boolean = false) => {
    const todayYear = manilaDateFromKey(getManilaDateKey()).getFullYear();
    const isLocked = monthData.isFuture;

    return (
      <div
        key={`${monthData.year}-${monthData.monthIndex}`}
        className={`flex flex-col items-center select-none transition-all duration-200 ${
          isCenter
            ? 'rounded-[22px] border border-brand-green/30 bg-brand-bgAlt/40 p-3 sm:p-4 shadow-sm dark:border-brand-accent/25 dark:bg-white/[0.03] w-full max-w-[320px] md:w-auto'
            : 'hidden md:flex rounded-2xl p-2 sm:p-2.5 opacity-85 hover:opacity-100'
        } ${
          isLocked
            ? 'opacity-40 grayscale select-none pointer-events-none cursor-not-allowed'
            : ''
        }`}
        aria-label={`${monthData.name} ${monthData.year} calendar`}
      >
        {/* Month Header */}
        <div
          className={`flex items-center justify-center gap-1.5 text-center ${
            isCenter ? 'mb-3 h-8' : 'mb-2 h-6'
          }`}
        >
          <h4
            className={`font-display font-black uppercase tracking-wider ${
              isCenter
                ? 'text-sm sm:text-base md:text-lg text-brand-text dark:text-white tracking-widest'
                : isLocked
                ? 'text-xs sm:text-sm text-brand-muted/40 dark:text-white/30'
                : 'text-xs sm:text-sm text-brand-text/80 dark:text-white/70'
            }`}
          >
            {monthData.name}
          </h4>
          {monthData.year !== todayYear && (
            <span
              className={`font-mono font-bold text-brand-muted/70 dark:text-white/40 ${
                isCenter ? 'text-xs' : 'text-[10px]'
              }`}
            >
              {monthData.year}
            </span>
          )}
          {isLocked && (
            <span
              title="Future month (locked)"
              className="inline-flex items-center gap-1 rounded bg-brand-bgAlt/90 px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-extrabold uppercase text-brand-muted/70 dark:bg-white/[0.04] dark:text-white/30"
            >
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>

        {/* Horizontal Weekday Headers (Sun .. Sat) */}
        <div
          className={`grid grid-cols-7 text-center select-none ${
            isCenter ? 'gap-1.5 sm:gap-2 mb-2' : 'gap-1 mb-1.5'
          }`}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
            <div
              key={dayName}
              className={`flex items-center justify-center font-mono ${
                isCenter
                  ? 'h-6 w-7 sm:h-7 sm:w-8 md:w-9 text-[10px] sm:text-[11px] font-black text-brand-muted dark:text-white/60'
                  : 'h-5 w-5 sm:h-6 sm:w-6 text-[8px] sm:text-[9px] font-bold text-brand-muted/60 dark:text-white/40'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Rows of Weeks */}
        <div className={`flex flex-col ${isCenter ? 'gap-1.5 sm:gap-2' : 'gap-1'}`}>
          {monthData.weeks.map((weekRow, rIdx) => (
            <div
              key={rIdx}
              className={`grid grid-cols-7 ${isCenter ? 'gap-1.5 sm:gap-2' : 'gap-1'}`}
            >
              {weekRow.map((cell, cIdx) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${cIdx}`}
                      className={`${
                        isCenter
                          ? 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9'
                          : 'h-5 w-5 sm:h-6 sm:w-6'
                      } opacity-0 pointer-events-none`}
                      aria-hidden="true"
                    />
                  );
                }

                const isSelected = selectedDateKey === cell.dateKey;
                const isCellDisabled = cell.isFuture || isLocked;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={isCellDisabled}
                    onClick={() => !isCellDisabled && onSelectDateKey(cell.dateKey)}
                    onMouseEnter={() => !isCellDisabled && setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onFocus={() => !isCellDisabled && setHoveredCell(cell)}
                    onBlur={() => setHoveredCell(null)}
                    aria-label={`${cell.dateKey}: ${cell.mealCount} meals logged`}
                    aria-pressed={isSelected}
                    className={`relative flex items-center justify-center border font-mono font-black transition-all duration-150 outline-none ${
                      isCenter
                        ? 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-lg sm:rounded-xl text-[10px] sm:text-xs'
                        : 'h-5 w-5 sm:h-6 sm:w-6 rounded-md text-[8px] sm:text-[9px]'
                    } ${getCellColor(cell)} ${
                      isSelected && !isLocked
                        ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:ring-brand-accent dark:ring-offset-[#0c1511] z-10 scale-105'
                        : ''
                    } ${
                      !isCellDisabled
                        ? 'hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-green'
                        : 'cursor-not-allowed'
                    }`}
                  >
                    {cell.mealCount > 0 && !isLocked && <span>{cell.mealCount}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
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
              {timeRange === 'Month'
                ? `${threeMonthsData.centerMonth.activeDaysCount} active days (month)`
                : `${totalLoggedDays} active days (${timeRange.toLowerCase()})`}
            </span>
          </div>
          <h3 className="mt-1 font-display text-lg sm:text-xl font-black tracking-tight text-brand-text dark:text-white">
            Activity Matrix
          </h3>
        </div>

        {/* Time Range Filter Pills: Year, Month, Week */}
        <div className="flex items-center gap-1 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {(['Year', 'Month', 'Week'] as ActivityTimeRange[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimeRange(mode)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all duration-150 ${
                timeRange === mode
                  ? 'bg-brand-surface text-brand-text shadow-sm border border-brand-border/60 dark:bg-[#15231c] dark:text-white dark:border-white/10'
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
        {timeRange === 'Week' ? (
          /* Week Mode: 7-day horizontal cards */
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3 py-2">
            {weeks[0]?.map((cell) => {
              const isSelected = selectedDateKey === cell.dateKey;
              const weekdayName = formatManilaDate(cell.date, { weekday: 'short' });
              const dateNum = formatManilaDate(cell.date, { month: 'numeric', day: 'numeric' });
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
                  className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-2 sm:p-3 transition-all duration-150 text-center outline-none ${
                    isSelected
                      ? 'border-brand-green bg-brand-green/5 ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:border-brand-accent dark:bg-brand-accent/5 dark:ring-brand-accent dark:ring-offset-[#0c1511]'
                      : 'border-brand-border/60 bg-brand-bgAlt/30 hover:border-brand-border hover:bg-brand-bgAlt/60 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="text-[11px] sm:text-xs font-black uppercase text-brand-muted dark:text-white/40">
                    {weekdayName}
                  </span>
                  <span className="font-mono text-[10px] sm:text-[11px] font-bold text-brand-text dark:text-white/80">
                    {dateNum}
                  </span>
                  <div
                    className={`mt-1 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl border transition-all duration-150 ${getCellColor(
                      cell
                    )}`}
                  >
                    {cell.mealCount > 0 ? (
                      <span className="font-mono text-xs sm:text-sm font-black">
                        {cell.mealCount}
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-40">0</span>
                    )}
                  </div>
                  <span className="mt-0.5 font-mono text-[8.5px] sm:text-[10px] font-bold text-brand-muted dark:text-white/40 truncate w-full">
                    {cell.mealCount > 0 ? (
                      <>
                        <span>{Math.round(cell.totalCalories)}</span>
                        <span className="hidden sm:inline"> kcal</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : timeRange === 'Month' ? (
          /* Month Mode: 3 Months side-by-side on desktop, single centered month on mobile */
          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="flex w-full md:w-auto md:min-w-max items-center justify-center gap-2 sm:gap-4 py-2 px-1 mx-auto">
              {/* Previous Month (Left - Hidden on mobile, visible on desktop) */}
              {renderMonthCard(threeMonthsData.prevMonth, false)}

              {/* Left Chevron (<) */}
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                title="Previous month"
                className="flex h-9 w-9 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border border-brand-border/70 bg-brand-surface text-brand-text shadow-sm transition-all hover:border-brand-green/60 hover:bg-brand-bgAlt hover:scale-110 active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Center Month (Active / Focused - Full width on mobile, centered on desktop) */}
              {renderMonthCard(threeMonthsData.centerMonth, true)}

              {/* Right Chevron (>) */}
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!canGoNext}
                aria-label="Next month"
                title={canGoNext ? 'Next month' : 'Future month is locked'}
                className={`flex h-9 w-9 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                  canGoNext
                    ? 'border-brand-border/70 bg-brand-surface text-brand-text shadow-sm hover:border-brand-green/60 hover:bg-brand-bgAlt hover:scale-110 active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]'
                    : 'border-brand-border/30 bg-brand-bgAlt/20 text-brand-muted/30 cursor-not-allowed opacity-30 shadow-none dark:border-white/5 dark:bg-white/[0.01] dark:text-white/20 pointer-events-none'
                }`}
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Next Month (Right - Hidden on mobile, visible on desktop) */}
              {renderMonthCard(threeMonthsData.nextMonth, false)}
            </div>
          </div>
        ) : (
          /* Year Mode: Full calendar year matrix */
          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="inline-block min-w-full">
              {/* Grid Container */}
              <div className="flex gap-1.5">
                {/* Day of Week Axis (Sun, Mon, Tue, Wed, Thu, Fri, Sat) */}
                <div className="flex w-7 sm:w-8 flex-shrink-0 flex-col justify-between pr-2 text-[9px] font-mono text-brand-muted dark:text-white/30 select-none py-0.5">
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
                        if (cell.isOutOfBounds) {
                          return (
                            <div
                              key={cell.dateKey}
                              className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-0 pointer-events-none"
                              aria-hidden="true"
                            />
                          );
                        }

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
                            title={
                              cell.isFuture
                                ? `${formatManilaDate(cell.date, { month: 'short', day: 'numeric' })}: Upcoming (Locked)`
                                : `${cell.dateKey}: ${cell.mealCount} meals logged`
                            }
                            aria-label={
                              cell.isFuture
                                ? `${cell.dateKey}: Upcoming (Locked)`
                                : `${cell.dateKey}: ${cell.mealCount} meals logged`
                            }
                            aria-pressed={isSelected}
                            className={`relative h-3.5 w-3.5 rounded-[4px] border transition-all duration-150 outline-none sm:h-4 sm:w-4 ${getCellColor(
                              cell
                            )} ${
                              isSelected
                                ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-brand-surface dark:ring-brand-accent dark:ring-offset-[#0c1511] z-10 scale-110'
                                : ''
                            } ${!cell.isFuture ? 'focus-visible:ring-2 focus-visible:ring-brand-green hover:scale-110' : ''}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Month Labels along the bottom */}
              <div className="mt-2 flex gap-1.5 h-4 select-none">
                {/* Spacer matching Day of Week Axis */}
                <div className="w-7 sm:w-8 flex-shrink-0 pr-2" aria-hidden="true" />

                {/* Week-aligned month label slots */}
                <div className="flex gap-1 relative">
                  {weeks.map((_, weekIndex) => {
                    const month = monthLabels.find((m) => m.weekIndex === weekIndex);
                    return (
                      <div key={`m-col-${weekIndex}`} className="relative w-3.5 sm:w-4 flex-shrink-0">
                        {month && (
                          <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-mono font-bold text-brand-muted dark:text-white/60">
                            {month.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hover Tooltip Card / Status Bar */}
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-brand-border/50 bg-brand-bgAlt/40 p-3 dark:border-white/5 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />
            {hoveredCell ? (
              <span className="font-semibold text-brand-text dark:text-white">
                <span className="font-bold text-brand-green dark:text-brand-accent">
                  {formatManilaDate(hoveredCell.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {hoveredCell.isFuture ? (
                  <span className="font-mono text-brand-muted dark:text-white/50"> : Upcoming (Locked)</span>
                ) : (
                  <>
                    : {hoveredCell.mealCount} meal{hoveredCell.mealCount !== 1 ? 's' : ''} logged
                    {hoveredCell.mealCount > 0 && ` (${Math.round(hoveredCell.totalCalories)} kcal)`}
                  </>
                )}
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

          {/* Activity Scale Legend in NutriMind Theme Colors */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[10px] font-mono text-brand-muted dark:text-white/40">
            <span>Less</span>
            <span
              className="h-3 w-3 rounded-[3px] border border-[#c6d6ce] bg-[#e8efec] dark:border-white/[0.08] dark:bg-[#14221b]"
              title="0 meals"
            />
            <span
              className="h-3 w-3 rounded-[3px] border border-[#6ee7b7] bg-[#a7f3d0] dark:border-[#065f46] dark:bg-[#064e3b]"
              title="1 meal"
            />
            <span
              className="h-3 w-3 rounded-[3px] border border-[#065947] bg-[#08705b] dark:border-[#10b981]/60 dark:bg-[#08705b]"
              title="2 meals"
            />
            <span
              className="h-3 w-3 rounded-[3px] border border-[#99db3a] bg-[#b8f45f] shadow-[0_0_6px_rgba(184,244,95,0.65)] dark:border-[#b8f45f] dark:bg-[#b8f45f]"
              title="3+ meals"
            />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
