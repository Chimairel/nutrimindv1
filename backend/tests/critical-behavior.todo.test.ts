import test from 'node:test';
import './restriction-policy.test';
import './meal-generation-library-compatibility.test';
import './meal-generation-result.test';
import './meal-plan-cycle.test';
import './meal-generation-cuisine-policy.test';
import './nutritionist-review-policy.test';
import './meal-library-safety-evidence.test';
import './weekly-adaptation-policy.test';
import './grocery-quantity-policy.test';
import './production-config-policy.test';
import './meal-plan-production-safety.test';
import './nutritionist-application-policy.test';

/**
 * Executable specifications for known defects.
 *
 * Database concurrency and exact-preview cases TEST-018 through TEST-020 are
 * executable in scripts/production-integration-smoke.ts. The sole remaining
 * TODO requires an external qualified clinical decision, not more code.
 */

test.todo(
  '[TEST-021][REQ-006][DEF-019][RISK-014][UNC-009] Daily calorie targets enforce bounds approved by a qualified clinical reviewer rather than treating the current 500 kcal floor as permanently correct'
);
