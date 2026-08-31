import { z } from 'zod';

const containsLetter = new RegExp('\\p{L}', 'u');
const supportedPersonName = new RegExp("^[\\p{L}\\p{M}'’ .-]+$", 'u');

const personNameSchema = (label: string) => z.string()
  .trim()
  .min(1, `${label} is required.`)
  .max(80, `${label} must be 80 characters or fewer.`)
  .regex(containsLetter, `${label} must contain at least one letter.`)
  .regex(supportedPersonName, `${label} may only contain letters, spaces, apostrophes, periods, and hyphens.`);

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password must be 128 characters or fewer.')
  .refine((value) => /\S/.test(value), 'Password cannot consist only of spaces.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/^[^\u0000-\u001F\u007F]+$/, 'Password cannot contain control characters.');

export const registrationSchema = z.object({
  firstName: personNameSchema('First name'),
  lastName: personNameSchema('Last name'),
  email: z.string()
    .trim()
    .min(1, 'Email address is required.')
    .max(254, 'Email address is too long.')
    .email('Please enter a valid email address.'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
}).superRefine(({ password, confirmPassword }, context) => {
  if (password !== confirmPassword) {
    context.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  }
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'Email address is required.')
    .max(254, 'Email address is too long.')
    .email('Please enter a valid email address.'),
  password: z.string()
    .min(1, 'Password is required.')
    .max(128, 'Password must be 128 characters or fewer.')
    .refine((value) => /\S/.test(value), 'Password cannot consist only of spaces.'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
export type LoginField = keyof LoginInput;
export type LoginFieldErrors = Partial<Record<LoginField, string>>;

export function getLoginFieldErrors(input: LoginInput): {
  data?: LoginOutput;
  errors: LoginFieldErrors;
} {
  const result = loginSchema.safeParse(input);
  if (result.success) return { data: result.data, errors: {} };

  const errors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && field in input && !errors[field as LoginField]) {
      errors[field as LoginField] = issue.message;
    }
  }

  return { errors };
}

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationOutput = z.output<typeof registrationSchema>;
export type RegistrationField = keyof RegistrationInput;
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export function getRegistrationFieldErrors(input: RegistrationInput): {
  data?: RegistrationOutput;
  errors: RegistrationFieldErrors;
} {
  const result = registrationSchema.safeParse(input);
  if (result.success) return { data: result.data, errors: {} };

  const errors: RegistrationFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && field in input && !errors[field as RegistrationField]) {
      errors[field as RegistrationField] = issue.message;
    }
  }

  return { errors };
}
