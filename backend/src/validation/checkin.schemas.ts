import { z } from 'zod';

const updatesSchema = z.object({
  weightKg: z.number().min(30).max(350).optional(),
  activityLevel: z.enum(['SEDENTARY', 'LIGHTLY_ACTIVE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
  goal: z.enum(['LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE']).optional(),
}).strict();

export const weeklyCheckinSchema = z.discriminatedUnion('changed', [
  z.object({ changed: z.literal(false) }).strict(),
  z.object({
    changed: z.literal(true),
    updates: updatesSchema.refine((updates) => Object.keys(updates).length > 0, {
      message: 'At least one changed profile value is required.',
    }),
  }).strict(),
]);

export type WeeklyCheckinInput = z.infer<typeof weeklyCheckinSchema>;
