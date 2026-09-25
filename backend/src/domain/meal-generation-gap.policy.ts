import { MealType } from '@prisma/client';
import { getScheduledMealDate } from './meal-plan-cycle.policy';

export interface MissingMealSlot {
  dayNumber: number;
  mealType: MealType;
  scheduledDate: Date;
}

const SLOT_ORDER = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER] as const;

/** Select one whole calendar day at a time, always starting with the earliest gap. */
export function missingMealSlots(
  startDate: Date,
  expectedSlotCount: number,
  occupied: readonly { scheduledDate: Date; mealType: MealType }[]
): MissingMealSlot[] {
  const occupiedKeys = new Set(occupied.map((meal) => `${meal.scheduledDate.getTime()}:${meal.mealType}`));
  const slots: MissingMealSlot[] = [];
  for (let day = 0; day < Math.ceil(expectedSlotCount / SLOT_ORDER.length); day += 1) {
    const scheduledDate = getScheduledMealDate(startDate, day);
    for (const [position, mealType] of SLOT_ORDER.entries()) {
      if (day * SLOT_ORDER.length + position >= expectedSlotCount) break;
      if (!occupiedKeys.has(`${scheduledDate.getTime()}:${mealType}`)) {
        slots.push({ dayNumber: day + 1, mealType, scheduledDate });
      }
    }
  }
  return slots;
}

export function earliestMissingDay(slots: readonly MissingMealSlot[]): MissingMealSlot[] {
  const first = slots[0]?.dayNumber;
  return first === undefined ? [] : slots.filter((slot) => slot.dayNumber === first);
}
