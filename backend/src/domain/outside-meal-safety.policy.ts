import { HealthConditionType, OutsideMealCompatibilityStatus } from '@prisma/client';
import type { adaptUserSafetyRestrictions } from './structured-restriction.adapter';

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const allergenTerms: Record<string, string[]> = {
  SHELLFISH: [
    'shrimp',
    'prawn',
    'crab',
    'lobster',
    'shellfish',
    'mussel',
    'clam',
    'oyster',
    'squid',
    'hipon',
    'alamang',
    'bagoong',
  ],
  NUTS: ['peanut', 'cashew', 'almond', 'walnut', 'pistachio', 'pili', 'mani', 'kare kare'],
  DAIRY: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'gatas'],
  GLUTEN: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'pancit', 'pandesal', 'soy sauce', 'toyo'],
  EGGS: ['egg', 'itlog', 'mayonnaise', 'mayo', 'balut', 'custard'],
};

export function evaluateOutsideMealCompatibility(input: {
  name: string;
  ingredients: string[];
  baselineStatus: OutsideMealCompatibilityStatus;
  restrictions: ReturnType<typeof adaptUserSafetyRestrictions>;
}) {
  const corpus = normalize([input.name, ...input.ingredients].join(' '));
  const warnings: string[] = [];
  let status = input.baselineStatus;
  for (const allergen of input.restrictions.allergies) {
    const hit = allergenTerms[allergen]?.find((term) => corpus.includes(normalize(term)));
    if (hit) {
      warnings.push(`Possible ${allergen.toLowerCase()} conflict detected from “${hit}”.`);
      status = OutsideMealCompatibilityStatus.CONFLICT_DETECTED;
    }
  }
  const hasCondition = input.restrictions.conditions.some((condition) => condition !== HealthConditionType.NONE);
  if (input.restrictions.requiresReview || hasCondition) {
    warnings.push(
      'Your profile contains a health condition that needs governed rule or nutritionist review; compatibility is not established.'
    );
    if (status !== OutsideMealCompatibilityStatus.CONFLICT_DETECTED)
      status = OutsideMealCompatibilityStatus.REVIEW_REQUIRED;
  }
  return { status, warnings };
}
