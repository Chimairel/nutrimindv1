interface IntakeLog {
  status: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Logged decisions stay visible; only eaten meals contribute to intake. */
export function summarizeMealIntake(logs: readonly IntakeLog[]) {
  return logs.reduce(
    (total, log) => {
      if (log.status !== 'DONE') return total;
      return {
        totalCalories: total.totalCalories + (log.calories || 0),
        totalProtein: total.totalProtein + (log.proteinG || 0),
        totalCarbs: total.totalCarbs + (log.carbsG || 0),
        totalFat: total.totalFat + (log.fatG || 0),
      };
    },
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
  );
}
