export function resolvePlanTargetCalories(
  cycleSnapshotTarget: number | null | undefined,
  liveProfileTarget: number | null | undefined,
  fallback = 0
): number {
  return cycleSnapshotTarget && cycleSnapshotTarget > 0
    ? cycleSnapshotTarget
    : liveProfileTarget && liveProfileTarget > 0
      ? liveProfileTarget
      : fallback;
}
