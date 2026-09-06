import type { NutritionistApplicationForm } from '@/validation/nutritionist-application.schemas';

export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CALL_REQUIRED' | 'CALL_SCHEDULED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';

export type PublicApplication = {
  referenceCode: string;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  scheduledCallAt?: string;
  meetingUrl?: string;
  decisionReason?: string;
  invitationSentAt?: string;
};

export const initialApplicationForm: NutritionistApplicationForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  prcLicenseNumber: '',
  prcLicenseExpiry: '',
  specialization: '',
  yearsOfExperience: '',
  university: '',
  professionalBio: '',
  callSlotOne: '',
  callSlotTwo: '',
  callSlotThree: '',
  consent: false,
};

export const applicationStatusOrder: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CALL_REQUIRED',
  'CALL_SCHEDULED',
  'APPROVED',
  'ACTIVATED',
];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Application submitted',
  UNDER_REVIEW: 'Credential review',
  CALL_REQUIRED: 'Ready to schedule',
  CALL_SCHEDULED: 'Verification call scheduled',
  APPROVED: 'Approved — activation pending',
  REJECTED: 'Application not approved',
  ACTIVATED: 'Nutritionist account activated',
};
