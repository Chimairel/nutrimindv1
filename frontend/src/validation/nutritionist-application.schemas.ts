import { z } from 'zod';

const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max);
const hasUnicodeLetter = new RegExp('[\\p{L}]', 'u');
const professionalNameCharacters = new RegExp("^[\\p{L}\\p{M}'’ .-]+$", 'u');
const futureLocalDateTime = z
  .string()
  .min(1, 'Choose a date and time.')
  .refine(
    (value) => Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > Date.now(),
    'Choose a future date and time.'
  );

export const applicantIdentitySchema = z.object({
  fullName: text('Full name', 161)
    .regex(hasUnicodeLetter, 'Full name must contain a letter.')
    .regex(professionalNameCharacters, 'Full name contains unsupported characters.'),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
  phoneNumber: text('Phone number', 30).regex(/^\+?[0-9 ()-]{7,25}$/, 'Enter a valid phone number.'),
  officialHeadshot: z
    .string()
    .min(1, 'Live photo verification is required. Please capture your photo using your camera.')
    .max(1000000, 'Photo is too large. Please capture it again.')
    .regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, 'Capture a PNG or JPEG photo.'),
});

export const applicantCredentialSchema = z.object({
  prcLicenseNumber: text('PRC license number', 80)
    .min(5, 'PRC license number must be at least 5 characters.')
    .regex(/^[A-Za-z0-9-]+$/, 'PRC license number may contain only letters, numbers, and hyphens.'),
  prcLicenseExpiry: z
    .string()
    .min(1, 'License expiration date is required.')
    .refine((value) => new Date(`${value}T23:59:59`).getTime() > Date.now(), 'PRC license must not be expired.'),
  specialization: text('Specialization', 120).min(2, 'Specialization must be at least 2 characters.'),
  digitalSignature: z
    .string()
    .min(1, 'Digital handwritten signature is required. Please draw and confirm your signature in the box provided.')
    .max(500000, 'Signature is too large. Please clear and redraw it.')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, 'Draw and confirm a PNG signature.'),
});

export const applicantProfileSchema = z.object({
  yearsOfExperience: z.coerce.number().int().min(0, 'Years cannot be negative.').max(70),
  university: text('University', 180),
  professionalBio: text('Professional background', 2000).min(
    40,
    'Write at least 40 characters about your professional background.'
  ),
});

export const applicantAvailabilitySchema = z
  .object({
    callSlotOne: futureLocalDateTime,
    callSlotTwo: futureLocalDateTime,
    callSlotThree: z
      .string()
      .refine(
        (value) => !value || (Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > Date.now()),
        'Choose a future date and time.'
      ),
    consent: z.literal(true, { error: 'Confirm the declaration before continuing.' }),
  })
  .refine(
    (values) => {
      const slots = [values.callSlotOne, values.callSlotTwo, values.callSlotThree].filter(Boolean);
      return new Set(slots).size === slots.length;
    },
    { path: ['callSlotTwo'], message: 'Choose different availability options.' }
  );

export type NutritionistApplicationForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  officialHeadshot: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization: string;
  digitalSignature: string;
  yearsOfExperience: string;
  university: string;
  professionalBio: string;
  callSlotOne: string;
  callSlotTwo: string;
  callSlotThree: string;
  consent: boolean;
};

export function issuesToFields(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}
