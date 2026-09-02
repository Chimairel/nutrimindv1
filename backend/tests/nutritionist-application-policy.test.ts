import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationDecisionSchema,
  applicationScheduleSchema,
  applicationStageSchema,
  nutritionistApplicationSchema,
  nutritionistInvitationAcceptanceSchema,
} from '../src/validation/nutritionist-application.schemas';

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const validApplication = {
  fullName: 'Maria Santos',
  email: 'Maria.Santos@example.com',
  phoneNumber: '+63 912 345 6789',
  prcLicenseNumber: 'RND-12345',
  prcLicenseExpiry: future(365),
  specialization: 'Clinical nutrition',
  yearsOfExperience: 6,
  university: 'Example University',
  professionalBio: 'Registered nutritionist-dietitian with experience in community and clinical nutrition programs.',
  availableCallSlots: [future(2), future(3)],
  consent: true,
};

test('[TEST-067] nutritionist application accepts a complete professional application and normalizes email', () => {
  const parsed = nutritionistApplicationSchema.parse(validApplication);
  assert.equal(parsed.email, 'maria.santos@example.com');
});

test('[TEST-068] nutritionist application rejects expired licenses, insufficient call options, and unknown fields', () => {
  assert.equal(nutritionistApplicationSchema.safeParse({ ...validApplication, prcLicenseExpiry: future(-1) }).success, false);
  assert.equal(nutritionistApplicationSchema.safeParse({ ...validApplication, availableCallSlots: [future(2)] }).success, false);
  assert.equal(nutritionistApplicationSchema.safeParse({ ...validApplication, role: 'NUTRITIONIST' }).success, false);
});

test('[TEST-069] admin application transition inputs are default-deny and meeting links require HTTP(S)', () => {
  assert.equal(applicationStageSchema.safeParse({ status: 'UNDER_REVIEW' }).success, true);
  assert.equal(applicationStageSchema.safeParse({ status: 'APPROVED' }).success, false);
  assert.equal(applicationScheduleSchema.safeParse({ scheduledCallAt: future(2), meetingUrl: 'https://meet.google.com/example' }).success, true);
  assert.equal(applicationScheduleSchema.safeParse({ scheduledCallAt: future(2), meetingUrl: 'ftp://example.com/call' }).success, false);
});

test('[TEST-070] rejections require a reason and invitation passwords use the account password policy', () => {
  assert.equal(applicationDecisionSchema.safeParse({ decision: 'reject', reason: '' }).success, false);
  assert.equal(applicationDecisionSchema.safeParse({ decision: 'approve' }).success, true);
  assert.equal(nutritionistInvitationAcceptanceSchema.safeParse({ token: 'private-token', password: 'ValidPass1' }).success, true);
  assert.equal(nutritionistInvitationAcceptanceSchema.safeParse({ token: 'private-token', password: 'weakpass' }).success, false);
});
