import {
  MealPlanCycleDeadlineOutcome,
  MealPlanCycleStatus,
  ProfileCycleAdaptationState,
} from '@prisma/client';

export type GroceryActionability = {
  canCheckItems: boolean;
  canExportPdf: boolean;
  isFinal: boolean;
  isIncomplete: boolean;
  quantitiesMayIncrease: boolean;
  requiresIncompleteAcknowledgment: boolean;
  message: string;
};

type GroceryCycleFacts = {
  status: MealPlanCycleStatus;
  profileAdaptationState: ProfileCycleAdaptationState;
  deadlineOutcome: MealPlanCycleDeadlineOutcome | null;
  incompleteAcknowledgedAt: Date | null;
  shoppingStartedAt: Date | null;
  listIsStale: boolean;
};

/**
 * The server is the authority for whether a grocery projection is only a
 * preview or may be used as a shopping checklist/export. Frontends render
 * these facts; they do not reconstruct lifecycle rules independently.
 */
export function deriveGroceryActionability(facts: GroceryCycleFacts): GroceryActionability {
  const isIncomplete = facts.deadlineOutcome === MealPlanCycleDeadlineOutcome.INCOMPLETE;
  const acknowledgedIncomplete = isIncomplete && facts.incompleteAcknowledgedAt !== null;

  if (
    facts.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT ||
    facts.status === MealPlanCycleStatus.REVALIDATION_REQUIRED ||
    facts.listIsStale
  ) {
    return {
      canCheckItems: false,
      canExportPdf: false,
      isFinal: false,
      isIncomplete,
      quantitiesMayIncrease: false,
      requiresIncompleteAcknowledgment: false,
      message: 'This grocery projection is paused while changed health or recipe evidence is revalidated.',
    };
  }

  const incompleteNeedsAcknowledgment =
    isIncomplete &&
    !acknowledgedIncomplete &&
    (facts.status === MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE ||
      facts.status === MealPlanCycleStatus.ACTIVE);
  if (incompleteNeedsAcknowledgment) {
    return {
      canCheckItems: false,
      canExportPdf: false,
      isFinal: false,
      isIncomplete: true,
      quantitiesMayIncrease: false,
      requiresIncompleteAcknowledgment: true,
      message: 'Some meal slots are still unresolved. Acknowledge the gaps before using this partial list.',
    };
  }

  const finalAndActionable =
    facts.status === MealPlanCycleStatus.READY_TO_SHOP ||
    facts.status === MealPlanCycleStatus.SHOPPING_STARTED ||
    facts.status === MealPlanCycleStatus.ACTIVE ||
    acknowledgedIncomplete;
  if (finalAndActionable) {
    return {
      canCheckItems: true,
      canExportPdf: true,
      isFinal: true,
      isIncomplete,
      quantitiesMayIncrease: false,
      requiresIncompleteAcknowledgment: false,
      message: isIncomplete
        ? 'This is the frozen partial list you accepted. It clearly excludes unresolved meal slots.'
        : 'This list is ready for shopping and its quantities are frozen.',
    };
  }

  return {
    canCheckItems: false,
    canExportPdf: false,
    isFinal: false,
    isIncomplete,
    quantitiesMayIncrease: true,
    requiresIncompleteAcknowledgment: false,
    message: 'Preview only. Quantities may increase as more meal slots complete review.',
  };
}

