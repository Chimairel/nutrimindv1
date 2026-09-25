import { ClinicalDocumentStatus, ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';

export const CLINICAL_EVIDENCE_REQUIREMENT_POLICY_VERSION = 'CLINICAL_CONTEXT_V1';

export type DiabetesContext = {
  medicationRisk?: 'NONE' | 'INSULIN' | 'SULFONYLUREA_OR_MEGLITINIDE' | 'OTHER' | 'UNSURE';
  recurrentHypoglycemia?: boolean | 'UNSURE';
};

export type ClinicalDocumentCandidate = {
  id: string;
  area: ClinicalEvidenceArea;
  status: ClinicalDocumentStatus;
  validUntil: Date | null;
  revision: number;
  sha256: string;
  createdAt: Date;
};

export type ClinicalEvidenceRequirement = {
  area: ClinicalEvidenceArea;
  condition: HealthConditionType;
  state: 'READY' | 'CONTEXT_REQUIRED' | 'DOCUMENT_REVIEW_REQUIRED';
  required: boolean;
  reasonCode: string;
  message: string;
  readyDocumentIds: string[];
};

export function evidenceAreaForCondition(condition: HealthConditionType): ClinicalEvidenceArea | null {
  switch (condition) {
    case HealthConditionType.DIABETES:
      return ClinicalEvidenceArea.DIABETES;
    case HealthConditionType.HYPERTENSION:
      return ClinicalEvidenceArea.HYPERTENSION;
    case HealthConditionType.KIDNEY_DISEASE:
      return ClinicalEvidenceArea.KIDNEY_DISEASE;
    case HealthConditionType.HEART_CONDITION:
      return ClinicalEvidenceArea.HEART_CONDITION;
    case HealthConditionType.PREGNANT:
      return ClinicalEvidenceArea.PREGNANCY;
    case HealthConditionType.NONE:
    default:
      return null;
  }
}

function isCurrentSufficientDocument(document: ClinicalDocumentCandidate, now: Date): boolean {
  return (
    document.status === ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW &&
    (!document.validUntil || document.validUntil.getTime() >= now.getTime())
  );
}

export function evaluateClinicalEvidenceRequirements(input: {
  conditions: readonly HealthConditionType[];
  documents: readonly ClinicalDocumentCandidate[];
  diabetesContext?: DiabetesContext | null;
  now?: Date;
}): ClinicalEvidenceRequirement[] {
  const now = input.now ?? new Date();
  const conditions = [...new Set(input.conditions.filter((condition) => condition !== HealthConditionType.NONE))];

  return conditions.map((condition) => {
    const area = evidenceAreaForCondition(condition)!;
    const latestDocument = input.documents
      .filter((document) => document.area === area)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    // A newly supplied record can change the clinical picture. An older reviewed
    // record cannot silently override the latest pending or unusable one.
    const readyDocumentIds = latestDocument && isCurrentSufficientDocument(latestDocument, now)
      ? [latestDocument.id]
      : [];

    if (condition === HealthConditionType.KIDNEY_DISEASE || condition === HealthConditionType.HEART_CONDITION) {
      return readyDocumentIds.length
        ? {
            area,
            condition,
            state: 'READY',
            required: true,
            reasonCode: 'REVIEWED_CLINICAL_CONTEXT_AVAILABLE',
            message: 'A current RND-reviewed clinical document is available for this user-specific condition.',
            readyDocumentIds,
          }
        : {
            area,
            condition,
            state: 'DOCUMENT_REVIEW_REQUIRED',
            required: true,
            reasonCode: 'USER_SCOPED_CONDITION_NEEDS_DOCUMENT',
            message: `${condition.replace(/_/g, ' ')} needs a current clinical document reviewed for nutrition context before meal planning.`,
            readyDocumentIds: [],
          };
    }

    if (condition === HealthConditionType.DIABETES) {
      const context = input.diabetesContext;
      if (!context?.medicationRisk || context.recurrentHypoglycemia === undefined) {
        return {
          area,
          condition,
          state: 'CONTEXT_REQUIRED',
          required: true,
          reasonCode: 'DIABETES_MEDICATION_CONTEXT_REQUIRED',
          message: 'Confirm diabetes medication and recent low-blood-sugar context before meal planning.',
          readyDocumentIds,
        };
      }
      const documentRequired =
        context.medicationRisk === 'INSULIN' ||
        context.medicationRisk === 'SULFONYLUREA_OR_MEGLITINIDE' ||
        context.medicationRisk === 'UNSURE' ||
        context.recurrentHypoglycemia === true ||
        context.recurrentHypoglycemia === 'UNSURE';
      const newDocumentPending = latestDocument?.status === ClinicalDocumentStatus.UPLOADED ||
        latestDocument?.status === ClinicalDocumentStatus.NEEDS_CLARIFICATION;
      if ((documentRequired || newDocumentPending) && readyDocumentIds.length === 0) {
        return {
          area,
          condition,
          state: 'DOCUMENT_REVIEW_REQUIRED',
          required: true,
          reasonCode: newDocumentPending ? 'NEW_DIABETES_DOCUMENT_AWAITING_REVIEW' : 'DIABETES_MEDICATION_OR_HYPOGLYCEMIA_RISK',
          message: newDocumentPending
            ? 'The newly uploaded diabetes document must be reviewed before meal planning resumes.'
            : 'Medication or low-blood-sugar context requires a current clinical document reviewed for nutrition context.',
          readyDocumentIds: [],
        };
      }
      return {
        area,
        condition,
        state: 'READY',
        required: documentRequired,
        reasonCode: documentRequired ? 'REVIEWED_DIABETES_CONTEXT_AVAILABLE' : 'DIABETES_DOCUMENT_OPTIONAL',
        message: documentRequired
          ? 'A current RND-reviewed document covers the declared diabetes risk context.'
          : 'The declared diabetes context does not trigger a mandatory document requirement.',
        readyDocumentIds,
      };
    }

    return {
      area,
      condition,
      state: 'READY',
      required: false,
      reasonCode: 'SUPPORTING_DOCUMENT_OPTIONAL',
      message: 'Supporting clinical documents are optional for this condition.',
      readyDocumentIds,
    };
  });
}

export function clinicalEvidenceBlocksMealPlanning(requirements: readonly ClinicalEvidenceRequirement[]): boolean {
  return requirements.some((requirement) => requirement.state !== 'READY');
}
