import {
  AllergenType,
  HealthConditionType,
  HealthProfileRevisionType,
  Prisma,
  SafetyEntryDomain,
  SafetyEntryProvenance,
  SafetyEntrySupportState,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  getPublicSafetyCatalogue,
  resolveSafetyEntries,
  validateResolvedSafetyEntries,
  type ResolvedSafetyEntry,
  type SafetyEntryInput,
} from '@/domain/safety-intake.policy';

const conditionEnums = new Set<string>(Object.values(HealthConditionType));
const allergenEnums = new Set<string>(Object.values(AllergenType));

function withoutNone(entries: readonly ResolvedSafetyEntry[]) {
  return entries.filter((entry) => entry.canonicalCode !== 'NONE');
}

function stableEntryShape(entry: ResolvedSafetyEntry) {
  return {
    domain: entry.domain,
    canonicalCode: entry.canonicalCode,
    displayName: entry.displayName,
    originalText: entry.originalText,
    normalizedText: entry.normalizedText,
    provenance: entry.provenance,
    supportState: entry.supportState,
    policyReference: entry.policyReference,
  };
}

function sortedJson(value: readonly Record<string, unknown>[]): string {
  return JSON.stringify([...value].sort((a, b) =>
    `${a.domain}:${a.normalizedText}`.localeCompare(`${b.domain}:${b.normalizedText}`)
  ));
}

export function buildLegacySafetyProjection(entries: readonly ResolvedSafetyEntry[]) {
  const active = withoutNone(entries);
  const conditions = active
    .filter((entry) => entry.domain === 'CONDITION' && entry.canonicalCode && conditionEnums.has(entry.canonicalCode))
    .map((entry) => entry.canonicalCode as HealthConditionType);
  const allergies = active
    .filter((entry) =>
      (entry.domain === 'ALLERGY' || entry.domain === 'AVOIDED_INGREDIENT') &&
      entry.canonicalCode && allergenEnums.has(entry.canonicalCode)
    )
    .map((entry) => entry.canonicalCode as AllergenType);

  const otherConditions = active
    .filter((entry) => entry.domain === 'CONDITION' && (!entry.canonicalCode || !conditionEnums.has(entry.canonicalCode)))
    .map((entry) => entry.displayName)
    .join(', ');
  const otherAllergies = active
    .filter((entry) => entry.domain !== 'CONDITION' && !(
      (entry.domain === 'ALLERGY' || entry.domain === 'AVOIDED_INGREDIENT') &&
      entry.canonicalCode && allergenEnums.has(entry.canonicalCode)
    ))
    .map((entry) => entry.displayName)
    .join(', ');

  return {
    conditions: conditions.length ? [...new Set(conditions)] : [HealthConditionType.NONE],
    allergies: allergies.length ? [...new Set(allergies)] : [AllergenType.NONE],
    otherConditions,
    otherAllergies,
  };
}

export class SafetyIntakeService {
  static getCatalogue() {
    return getPublicSafetyCatalogue();
  }

  static preview(inputs: readonly SafetyEntryInput[]) {
    const entries = resolveSafetyEntries(inputs);
    const errors = validateResolvedSafetyEntries(entries);
    if (inputs.some((input) => input.value.trim().length > 0 && input.value.split(/[,;\/\n\r]+/).every((part) => !part.trim()))) {
      errors.push('Safety input must contain at least one reviewable term.');
    }
    return {
      entries,
      errors,
      canSave: errors.length === 0,
      requiresReview: entries.some((entry) =>
        entry.supportState === 'RECOGNIZED_UNSUPPORTED' || entry.supportState === 'PENDING_REVIEW'
      ),
    };
  }

  static async getCurrentInputs(userId: string): Promise<SafetyEntryInput[]> {
    const structured = await prisma.safetyProfileEntry.findMany({ where: { userId } });
    if (structured.length) {
      return structured.map((entry) => ({
        domain: entry.domain,
        value: entry.provenance === 'PREDEFINED' && entry.canonicalCode
          ? entry.canonicalCode
          : entry.originalText,
        provenance: entry.provenance === 'PREDEFINED' ? 'PREDEFINED' : 'CUSTOM',
      }));
    }

    const legacy = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        healthConditions: { select: { condition: true } },
        allergies: { select: { allergen: true } },
        userProfile: { select: { otherConditions: true, otherAllergies: true } },
      },
    });
    if (!legacy) throw new Error('User not found.');
    return [
      ...legacy.healthConditions.map((entry) => ({ domain: 'CONDITION' as const, value: entry.condition, provenance: 'PREDEFINED' as const })),
      ...((legacy.userProfile?.otherConditions || '').split(',').map((value) => value.trim()).filter(Boolean)
        .map((value) => ({ domain: 'CONDITION' as const, value, provenance: 'CUSTOM' as const }))),
      ...legacy.allergies.map((entry) => ({ domain: 'ALLERGY' as const, value: entry.allergen, provenance: 'PREDEFINED' as const })),
      ...((legacy.userProfile?.otherAllergies || '').split(',').map((value) => value.trim()).filter(Boolean)
        .map((value) => ({ domain: 'ALLERGY' as const, value, provenance: 'CUSTOM' as const }))),
    ];
  }

  static async replaceDomains(
    userId: string,
    domains: readonly SafetyEntryInput['domain'][],
    replacements: readonly SafetyEntryInput[]
  ) {
    const retained = (await this.getCurrentInputs(userId)).filter((entry) => !domains.includes(entry.domain));
    return this.save(userId, [...retained, ...replacements]);
  }

  static async save(userId: string, inputs: readonly SafetyEntryInput[]) {
    const preview = this.preview(inputs);
    if (!preview.canSave) throw new Error(preview.errors.join(' '));

    const entries = preview.entries;
    const current = await prisma.safetyProfileEntry.findMany({
      where: { userId },
      select: {
        domain: true,
        canonicalCode: true,
        displayName: true,
        originalText: true,
        normalizedText: true,
        provenance: true,
        supportState: true,
        policyReference: true,
      },
    });
    const next = entries.map(stableEntryShape);
    if (sortedJson(current) === sortedJson(next)) {
      return { ...preview, entries, changed: false };
    }

    const legacy = buildLegacySafetyProjection(entries);
    await prisma.$transaction(async (tx) => {
      await tx.safetyProfileEntry.deleteMany({ where: { userId } });
      if (entries.length) {
        await tx.safetyProfileEntry.createMany({
          data: entries.map((entry) => ({
            userId,
            domain: entry.domain as SafetyEntryDomain,
            canonicalCode: entry.canonicalCode,
            displayName: entry.displayName,
            originalText: entry.originalText,
            normalizedText: entry.normalizedText,
            provenance: entry.provenance as SafetyEntryProvenance,
            supportState: entry.supportState as SafetyEntrySupportState,
            policyReference: entry.policyReference,
          })),
        });
      }

      await tx.healthCondition.deleteMany({ where: { userId } });
      await tx.healthCondition.createMany({
        data: legacy.conditions.map((condition) => ({ userId, condition })),
      });
      await tx.allergy.deleteMany({ where: { userId } });
      await tx.allergy.createMany({
        data: legacy.allergies.map((allergen) => ({ userId, allergen })),
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { otherConditions: legacy.otherConditions, otherAllergies: legacy.otherAllergies },
        create: { userId, otherConditions: legacy.otherConditions, otherAllergies: legacy.otherAllergies },
      });
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.STRUCTURED_SAFETY_UPDATED,
          snapshot: {
            entries: next,
            legacyProjection: legacy,
          } as Prisma.InputJsonObject,
        },
      });
      await tx.nutritionReport.updateMany({ where: { userId }, data: { acknowledgedAt: null } });
    });

    return { ...preview, entries, changed: true };
  }
}

export default SafetyIntakeService;
