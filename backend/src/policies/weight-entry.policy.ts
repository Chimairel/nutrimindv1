export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 300;
export const MAX_WEIGHT_NOTE_LENGTH = 500;

export function isSupportedWeightKg(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_WEIGHT_KG && value <= MAX_WEIGHT_KG;
}

export function normalizeWeightNote(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('Weight note must be text.');
  }

  const normalized = value.trim();
  if (normalized.length > MAX_WEIGHT_NOTE_LENGTH) {
    throw new Error(`Weight note must be ${MAX_WEIGHT_NOTE_LENGTH} characters or fewer.`);
  }
  return normalized || undefined;
}
