export type ApplicationStatus =
  'SUBMITTED' | 'UNDER_REVIEW' | 'CALL_REQUIRED' | 'CALL_SCHEDULED' | 'APPROVED' | 'REJECTED' | 'ACTIVATED';

export interface NutritionistApplication {
  id: string;
  referenceCode: string;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  phoneNumber: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization: string;
  yearsOfExperience: number;
  university: string;
  professionalBio: string;
  availableCallSlots: string[];
  scheduledCallAt?: string;
  meetingUrl?: string;
  decisionReason?: string;
  invitationSentAt?: string;
  activatedAt?: string;
  createdAt: string;
}

export interface NutritionistRow {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  isVerified: boolean;
  totalVerified: number;
  verifiedAt?: string;
  user: { id: string; name: string; email: string };
}

export type ScheduleDraft = { scheduledCallAt: string; meetingUrl: string };
export type ApplicationActionResponse = { data?: { data?: { invitationEmailSent?: boolean } } };

export const statusLabel: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CALL_REQUIRED: 'Call required',
  CALL_SCHEDULED: 'Call scheduled',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVATED: 'Activated',
};

export function toLocalInput(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
