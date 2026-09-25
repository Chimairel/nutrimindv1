import type { ClinicalEvidenceRequirement } from './clinical-evidence-requirement.policy';

export type PlanningReadiness = {
  status: 'BLOCKED_CLINICAL_CONTEXT' | 'REQUEST_ALLOWED_REVIEW_EXPECTED' | 'REQUEST_ALLOWED';
  canRequestPlan: boolean;
  title: string;
  message: string;
  actionPath: string;
};

export function determinePlanningReadiness(input: {
  requirements: readonly ClinicalEvidenceRequirement[];
  restrictionsRequireReview: boolean;
  conditions: readonly string[];
}): PlanningReadiness {
  const blocked = input.requirements.filter((requirement) => requirement.state !== 'READY');
  if (blocked.length) {
    return {
      status: 'BLOCKED_CLINICAL_CONTEXT',
      canRequestPlan: false,
      title: 'Clinical context needed before planning',
      message: blocked.map((requirement) => requirement.message).join(' '),
      actionPath: '/profile/clinical-evidence',
    };
  }

  const conditionNeedsEvidence = input.conditions.some((condition) => condition !== 'NONE');
  if (input.restrictionsRequireReview || conditionNeedsEvidence) {
    return {
      status: 'REQUEST_ALLOWED_REVIEW_EXPECTED',
      canRequestPlan: true,
      title: 'Plan request available; meal review may be needed',
      message: 'You can request a plan. Only meals with matching safety evidence can be used now; other candidates must be reviewed by a nutritionist before use.',
      actionPath: '/meals',
    };
  }

  return {
    status: 'REQUEST_ALLOWED',
    canRequestPlan: true,
    title: 'Meal planning is available',
    message: 'You can request a plan. Meals with matching reviewed evidence are available first; any new candidates wait for nutritionist review before use.',
    actionPath: '/meals',
  };
}
