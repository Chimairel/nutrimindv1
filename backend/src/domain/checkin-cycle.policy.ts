const WEEK_MS = 7 * 86_400_000;

/** Prior elapsed cycles without a submission are derived as missed, never as unchanged. */
export function deriveMissedCheckinCycles(anchor: Date, now: Date, submittedCurrentCycle: boolean): number {
  const elapsedCycles = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / WEEK_MS));
  return submittedCurrentCycle ? elapsedCycles : Math.max(0, elapsedCycles - 1);
}
