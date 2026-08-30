export type WeeklyAdaptationState =
  | 'INSUFFICIENT_DATA'
  | 'ON_TRACK'
  | 'LOW_ADHERENCE'
  | 'REVIEW_RECOMMENDED';

export interface WeeklyAdaptationInput {
  goal?: unknown;
  weights?: readonly { weightKg: number; loggedAt: Date }[];
  adherence?: readonly { adherencePct: number; logDate: Date }[];
}

export interface WeeklyAdaptationResult {
  state: WeeklyAdaptationState;
  weightTrendKg: number | null;
  averageAdherencePct: number | null;
  observationDays: number;
  explanation: string;
  automaticCalorieAdjustment: 0;
}

const MIN_WEIGHT_OBSERVATION_DAYS = 7;
const MIN_ADHERENCE_LOGS = 4;
const ADEQUATE_ADHERENCE_PCT = 70;

function round(value: number, precision = 1): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export function evaluateWeeklyAdaptation(input: WeeklyAdaptationInput): WeeklyAdaptationResult {
  const weights = [...(input.weights || [])]
    .filter((entry) => Number.isFinite(entry.weightKg) && entry.weightKg > 0 && entry.loggedAt instanceof Date)
    .sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  const adherence = [...(input.adherence || [])]
    .filter((entry) => Number.isFinite(entry.adherencePct) && entry.adherencePct >= 0 && entry.adherencePct <= 100);

  const firstWeight = weights[0];
  const lastWeight = weights.at(-1);
  const observationDays = firstWeight && lastWeight
    ? Math.floor((lastWeight.loggedAt.getTime() - firstWeight.loggedAt.getTime()) / 86_400_000)
    : 0;
  const weightTrendKg = firstWeight && lastWeight && firstWeight !== lastWeight
    ? round(lastWeight.weightKg - firstWeight.weightKg, 2)
    : null;
  const averageAdherencePct = adherence.length > 0
    ? round(adherence.reduce((sum, entry) => sum + entry.adherencePct, 0) / adherence.length)
    : null;

  if (
    weights.length < 2 ||
    observationDays < MIN_WEIGHT_OBSERVATION_DAYS ||
    adherence.length < MIN_ADHERENCE_LOGS ||
    averageAdherencePct === null ||
    weightTrendKg === null
  ) {
    return {
      state: 'INSUFFICIENT_DATA',
      weightTrendKg,
      averageAdherencePct,
      observationDays,
      explanation: 'More consistent weight and meal-adherence observations are needed before interpreting progress.',
      automaticCalorieAdjustment: 0,
    };
  }

  if (averageAdherencePct < ADEQUATE_ADHERENCE_PCT) {
    return {
      state: 'LOW_ADHERENCE',
      weightTrendKg,
      averageAdherencePct,
      observationDays,
      explanation: 'Recorded adherence is too limited to conclude that the nutrition target itself needs adjustment.',
      automaticCalorieAdjustment: 0,
    };
  }

  const onTrack =
    (input.goal === 'LOSE_WEIGHT' && weightTrendKg <= -0.1) ||
    ((input.goal === 'GAIN_WEIGHT' || input.goal === 'BUILD_MUSCLE') && weightTrendKg >= 0.1) ||
    (input.goal === 'MAINTAIN' && Math.abs(weightTrendKg) <= 0.5);

  return onTrack
    ? {
        state: 'ON_TRACK',
        weightTrendKg,
        averageAdherencePct,
        observationDays,
        explanation: 'The observed direction is consistent with the recorded goal; no automatic target change is indicated.',
        automaticCalorieAdjustment: 0,
      }
    : {
        state: 'REVIEW_RECOMMENDED',
        weightTrendKg,
        averageAdherencePct,
        observationDays,
        explanation: 'Progress is not moving in the expected direction despite adequate recorded adherence. A nutritionist review is recommended before changing targets.',
        automaticCalorieAdjustment: 0,
      };
}
