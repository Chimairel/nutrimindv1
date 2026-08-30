import test from 'node:test';
import './restriction-policy.test';
import './meal-generation-library-compatibility.test';
import './meal-generation-result.test';
import './meal-plan-cycle.test';
import './meal-generation-cuisine-policy.test';

/**
 * Executable specifications for known defects.
 *
 * These cases are deliberately TODO, not passing assertions. Activating one
 * requires the corresponding separately approved behavior-change batch.
 */

test.todo(
  '[TEST-018][REQ-005,REQ-006][DEF-018][RISK-004,RISK-006] Outside-meal confirmation persists the exact estimate and warning that the user previewed'
);

test.todo(
  '[TEST-019][REQ-005][DEF-014][RISK-004,RISK-007] Retries and concurrency cannot create duplicate planned-meal logs or user/date daily aggregates'
);

test.todo(
  '[TEST-020][REQ-005][DEF-013][RISK-004] Nutritionist claims are atomic, limited to the claim owner, and reject absent or expired ownership'
);

test.todo(
  '[TEST-021][REQ-006][DEF-019][RISK-014][UNC-009] Daily calorie targets enforce bounds approved by a qualified clinical reviewer rather than treating the current 500 kcal floor as permanently correct'
);
