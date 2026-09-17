import { describe, expect, it } from 'vitest';
import {
  applicantCredentialSchema,
  applicantIdentitySchema,
} from './nutritionist-application.schemas';

describe('nutritionist application schema validation', () => {
  describe('applicantIdentitySchema', () => {
    it('requires live webcam officialHeadshot capture', () => {
      const result = applicantIdentitySchema.safeParse({
        fullName: 'Maria Santos',
        email: 'maria.santos@rnd.ph',
        phoneNumber: '+63 917 123 4567',
        officialHeadshot: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Live photo verification is required/i);
      }
    });

    it('passes when valid live officialHeadshot data URL is present', () => {
      const result = applicantIdentitySchema.safeParse({
        fullName: 'Maria Santos',
        email: 'maria.santos@rnd.ph',
        phoneNumber: '+63 917 123 4567',
        officialHeadshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('applicantCredentialSchema', () => {
    it('requires handwritten digitalSignature', () => {
      const result = applicantCredentialSchema.safeParse({
        prcLicenseNumber: '0098765',
        prcLicenseExpiry: '2029-12-31',
        specialization: 'Clinical Renal Nutrition',
        digitalSignature: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Digital handwritten signature is required/i);
      }
    });

    it('passes when valid digitalSignature data URL is present', () => {
      const result = applicantCredentialSchema.safeParse({
        prcLicenseNumber: '0098765',
        prcLicenseExpiry: '2029-12-31',
        specialization: 'Clinical Renal Nutrition',
        digitalSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMg...',
      });

      expect(result.success).toBe(true);
    });
  });
});
