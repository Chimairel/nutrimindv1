export interface PlanningReadiness {
  status: 'BLOCKED_CLINICAL_CONTEXT' | 'REQUEST_ALLOWED_REVIEW_EXPECTED' | 'REQUEST_ALLOWED';
  canRequestPlan: boolean;
  title: string;
  message: string;
  actionPath: string;
}
