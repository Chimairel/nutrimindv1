import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWeeklyAdaptation } from '../src/domain/weekly-adaptation.policy';

const adherence = Array.from({ length: 7 }, (_, index) => ({
  adherencePct: 85,
  logDate: new Date(`2026-08-${String(10 + index).padStart(2, '0')}T00:00:00Z`),
}));

test('[TEST-052] one weigh-in never triggers an automatic nutrition adjustment', () => {
  const result = evaluateWeeklyAdaptation({
    goal: 'GAIN_WEIGHT',
    weights: [{ weightKg: 70, loggedAt: new Date('2026-08-10T00:00:00Z') }],
    adherence,
  });

  assert.equal(result.state, 'INSUFFICIENT_DATA');
  assert.equal(result.automaticCalorieAdjustment, 0);
});

test('[TEST-052] low adherence prevents target-change conclusions', () => {
  const result = evaluateWeeklyAdaptation({
    goal: 'GAIN_WEIGHT',
    weights: [
      { weightKg: 70, loggedAt: new Date('2026-08-01T00:00:00Z') },
      { weightKg: 70, loggedAt: new Date('2026-08-15T00:00:00Z') },
    ],
    adherence: adherence.map((entry) => ({ ...entry, adherencePct: 40 })),
  });

  assert.equal(result.state, 'LOW_ADHERENCE');
  assert.equal(result.automaticCalorieAdjustment, 0);
});

test('[TEST-052] sustained stagnation with adequate adherence recommends professional review', () => {
  const result = evaluateWeeklyAdaptation({
    goal: 'GAIN_WEIGHT',
    weights: [
      { weightKg: 70, loggedAt: new Date('2026-08-01T00:00:00Z') },
      { weightKg: 70.02, loggedAt: new Date('2026-08-15T00:00:00Z') },
    ],
    adherence,
  });

  assert.equal(result.state, 'REVIEW_RECOMMENDED');
  assert.equal(result.automaticCalorieAdjustment, 0);
});

test('[TEST-052] goal-consistent movement is on track without automatic escalation', () => {
  const result = evaluateWeeklyAdaptation({
    goal: 'LOSE_WEIGHT',
    weights: [
      { weightKg: 70, loggedAt: new Date('2026-08-01T00:00:00Z') },
      { weightKg: 69.4, loggedAt: new Date('2026-08-15T00:00:00Z') },
    ],
    adherence,
  });

  assert.equal(result.state, 'ON_TRACK');
  assert.equal(result.automaticCalorieAdjustment, 0);
});
