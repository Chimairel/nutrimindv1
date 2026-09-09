import { createHash } from 'node:crypto';
import { ReferenceDataDomain, ReferenceDataReleaseStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { normalizeFoodName, selectStrongFNRIMatch } from '@/domain/fnri-match.policy';
import {
  consumptionCsvTemplate,
  parseFoodConsumptionCsv,
  type ParsedConsumptionRow,
} from '@/domain/food-consumption-import.policy';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';
import type {
  createFoodAliasSchema,
  createReferenceDataReleaseSchema,
  createReferenceDataSourceSchema,
  updateReferenceDataSourceSchema,
} from '@/validation/admin-data.schemas';
import type { z } from 'zod';

type CreateSourceInput = z.infer<typeof createReferenceDataSourceSchema>;
type UpdateSourceInput = z.infer<typeof updateReferenceDataSourceSchema>;
type CreateReleaseInput = z.infer<typeof createReferenceDataReleaseSchema>;
type CreateFoodAliasInput = z.infer<typeof createFoodAliasSchema>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mappingSummary(rows: Array<{ releaseId: string; mappingStatus: string; _count: { _all: number } }>) {
  const summaries = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const current = summaries.get(row.releaseId) || {};
    current[row.mappingStatus] = row._count._all;
    summaries.set(row.releaseId, current);
  }
  return summaries;
}

export class AdminDataService {
  static async getWorkspace() {
    const [
      sources,
      releases,
      mappingGroups,
      foodItems,
      foodAliases,
      mealLibrary,
      completeMealLibrary,
      priceSources,
      pricePublications,
      priceObservations,
      consumptionStats,
    ] = await Promise.all([
      prisma.referenceDataSource.findMany({ orderBy: [{ domain: 'asc' }, { name: 'asc' }] }),
      prisma.referenceDataRelease.findMany({
        take: 100,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          source: { select: { code: true, name: true, domain: true, isEnabled: true, updateCadence: true } },
          createdByAdmin: { select: { name: true } },
          activatedByAdmin: { select: { name: true } },
          _count: { select: { consumptionStats: true, activations: true } },
        },
      }),
      prisma.foodConsumptionStat.groupBy({
        by: ['releaseId', 'mappingStatus'],
        _count: { _all: true },
      }),
      prisma.foodItem.count(),
      prisma.foodAlias.count(),
      prisma.mealLibrary.count(),
      prisma.mealLibrary.count({ where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE' } }),
      prisma.ingredientPriceSource.count(),
      prisma.ingredientPricePublication.count(),
      prisma.ingredientPriceObservation.count(),
      prisma.foodConsumptionStat.count(),
    ]);
    const mappings = mappingSummary(mappingGroups);
    return {
      summary: {
        foodItems,
        foodAliases,
        mealLibrary,
        completeMealLibrary,
        priceSources,
        pricePublications,
        priceObservations,
        consumptionStats,
        dataSources: sources.length,
        activeReleases: releases.filter((release) => release.status === 'ACTIVE').length,
      },
      sources,
      releases: releases.map((release) => ({
        ...release,
        mappings: mappings.get(release.id) || {},
      })),
      consumptionCsvTemplate: consumptionCsvTemplate(),
    };
  }

  static async listFoods(page: number, limit: number, search?: string) {
    const pagination = normalizePagination(page, limit, 25);
    const normalizedSearch = normalizeSearch(search);
    const where = normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
            { aliases: { some: { alias: { contains: normalizedSearch, mode: 'insensitive' as const } } } },
          ],
        }
      : {};
    const [foods, total] = await Promise.all([
      prisma.foodItem.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        include: {
          aliases: {
            orderBy: { alias: 'asc' },
            select: { id: true, alias: true, verifiedAt: true, verifiedByAdmin: { select: { name: true } } },
          },
        },
      }),
      prisma.foodItem.count({ where }),
    ]);
    return {
      foods,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  static async listReleaseStats(releaseId: string, page: number, limit: number, search?: string) {
    const pagination = normalizePagination(page, limit, 50);
    const normalizedSearch = normalizeSearch(search);
    const where = {
      releaseId,
      ...(normalizedSearch
        ? {
            OR: [
              { foodNameRaw: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { regionName: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { provinceHucName: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.foodConsumptionStat.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: [{ geographyLevel: 'asc' }, { regionName: 'asc' }, { provinceHucName: 'asc' }, { rank: 'asc' }],
        include: { foodItem: { select: { id: true, name: true } } },
      }),
      prisma.foodConsumptionStat.count({ where }),
    ]);
    return {
      rows,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  static async createSource(adminUserId: string, input: CreateSourceInput) {
    return prisma.$transaction(async (tx) => {
      const source = await tx.referenceDataSource.create({
        data: { ...input, code: input.code.toUpperCase() },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'REFERENCE_DATA_SOURCE_CREATED',
          entityType: 'ReferenceDataSource',
          entityId: source.id,
          metadata: { code: source.code, domain: source.domain },
        },
      });
      return source;
    });
  }

  static async updateSource(adminUserId: string, sourceId: string, input: UpdateSourceInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.referenceDataSource.findUnique({ where: { id: sourceId } });
      if (!existing) throw new Error('Reference data source not found.');
      const source = await tx.referenceDataSource.update({ where: { id: sourceId }, data: input });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'REFERENCE_DATA_SOURCE_UPDATED',
          entityType: 'ReferenceDataSource',
          entityId: source.id,
          metadata: { changedFields: Object.keys(input) },
        },
      });
      return source;
    });
  }

  static async createRelease(adminUserId: string, input: CreateReleaseInput) {
    const source = await prisma.referenceDataSource.findUnique({ where: { id: input.sourceId } });
    if (!source) throw new Error('Reference data source not found.');
    if (!source.isEnabled) throw new Error('A disabled source cannot receive a new release.');
    return prisma.$transaction(async (tx) => {
      const release = await tx.referenceDataRelease.create({
        data: {
          sourceId: input.sourceId,
          versionLabel: input.versionLabel,
          surveyYear: input.surveyYear,
          sourceUrl: input.sourceUrl,
          sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : undefined,
          retrievedAt: new Date(input.retrievedAt),
          notes: input.notes,
          createdByAdminId: adminUserId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'REFERENCE_DATA_RELEASE_CREATED',
          entityType: 'ReferenceDataRelease',
          entityId: release.id,
          metadata: { sourceId: input.sourceId, versionLabel: input.versionLabel },
        },
      });
      return release;
    });
  }

  private static buildFoodIndex(
    foods: Array<{ id: string; name: string; aliases: Array<{ alias: string; verifiedAt: Date | null }> }>
  ) {
    const index = new Map<string, Set<string>>();
    const add = (label: string, id: string) => {
      const normalized = normalizeFoodName(label);
      if (!normalized) return;
      const ids = index.get(normalized) || new Set<string>();
      ids.add(id);
      index.set(normalized, ids);
    };
    for (const food of foods) {
      add(food.name, food.id);
      for (const alias of food.aliases) {
        if (alias.verifiedAt || selectStrongFNRIMatch(alias.alias, [food])) add(alias.alias, food.id);
      }
    }
    return index;
  }

  static async importConsumptionCsv(adminUserId: string, releaseId: string, csvText: string) {
    const parsed = parseFoodConsumptionCsv(csvText);
    const release = await prisma.referenceDataRelease.findUnique({
      where: { id: releaseId },
      include: { source: true },
    });
    if (!release) throw new Error('Reference data release not found.');
    if (release.status !== ReferenceDataReleaseStatus.DRAFT) throw new Error('Only a draft release can be imported.');
    if (release.source.domain !== ReferenceDataDomain.FOOD_CONSUMPTION) {
      throw new Error('Consumption CSV files require a FOOD_CONSUMPTION source.');
    }
    const foods = await prisma.foodItem.findMany({
      select: { id: true, name: true, aliases: { select: { alias: true, verifiedAt: true } } },
    });
    const foodIndex = this.buildFoodIndex(foods);
    const rows = parsed.map((row: ParsedConsumptionRow) => {
      const matches = [...(foodIndex.get(normalizeFoodName(row.foodNameRaw)) || [])];
      return {
        ...row,
        releaseId,
        foodItemId: matches.length === 1 ? matches[0] : null,
        mappingStatus:
          matches.length === 1
            ? ('EXACT' as const)
            : matches.length > 1
              ? ('REVIEW_REQUIRED' as const)
              : ('UNMAPPED' as const),
      };
    });
    const hash = sha256(csvText);
    await prisma.$transaction(async (tx) => {
      await tx.foodConsumptionStat.deleteMany({ where: { releaseId } });
      await tx.foodConsumptionStat.createMany({ data: rows });
      await tx.referenceDataRelease.update({ where: { id: releaseId }, data: { contentSha256: hash } });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'FOOD_CONSUMPTION_DRAFT_IMPORTED',
          entityType: 'ReferenceDataRelease',
          entityId: releaseId,
          metadata: {
            rowCount: rows.length,
            exact: rows.filter((row) => row.mappingStatus === 'EXACT').length,
            reviewRequired: rows.filter((row) => row.mappingStatus === 'REVIEW_REQUIRED').length,
            unmapped: rows.filter((row) => row.mappingStatus === 'UNMAPPED').length,
            contentSha256: hash,
          },
        },
      });
    });
    return {
      rowCount: rows.length,
      exact: rows.filter((row) => row.mappingStatus === 'EXACT').length,
      reviewRequired: rows.filter((row) => row.mappingStatus === 'REVIEW_REQUIRED').length,
      unmapped: rows.filter((row) => row.mappingStatus === 'UNMAPPED').length,
      contentSha256: hash,
    };
  }

  static async mapConsumptionStat(adminUserId: string, statId: string, foodItemId: string) {
    const [stat, food] = await Promise.all([
      prisma.foodConsumptionStat.findUnique({ where: { id: statId }, include: { release: true } }),
      prisma.foodItem.findUnique({ where: { id: foodItemId } }),
    ]);
    if (!stat) throw new Error('Consumption statistic not found.');
    if (stat.release.status !== ReferenceDataReleaseStatus.DRAFT) throw new Error('Only draft mappings can change.');
    if (!food) throw new Error('FNRI food item not found.');
    return prisma.$transaction(async (tx) => {
      const updated = await tx.foodConsumptionStat.update({
        where: { id: statId },
        data: { foodItemId, mappingStatus: 'MANUAL' },
        include: { foodItem: { select: { id: true, name: true } } },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'FOOD_CONSUMPTION_MAPPING_SET',
          entityType: 'FoodConsumptionStat',
          entityId: statId,
          metadata: { foodNameRaw: stat.foodNameRaw, foodItemId, foodItemName: food.name },
        },
      });
      return updated;
    });
  }

  static async stageRelease(adminUserId: string, releaseId: string) {
    const release = await prisma.referenceDataRelease.findUnique({
      where: { id: releaseId },
      include: { source: true },
    });
    if (!release) throw new Error('Reference data release not found.');
    if (release.status !== ReferenceDataReleaseStatus.DRAFT) throw new Error('Only a draft release can be staged.');
    if (release.source.domain === ReferenceDataDomain.FOOD_CONSUMPTION) {
      const [rowCount, reviewRequired] = await Promise.all([
        prisma.foodConsumptionStat.count({ where: { releaseId } }),
        prisma.foodConsumptionStat.count({ where: { releaseId, mappingStatus: 'REVIEW_REQUIRED' } }),
      ]);
      if (rowCount === 0 || !release.contentSha256)
        throw new Error('Import at least one aggregate consumption row first.');
      if (reviewRequired > 0) throw new Error('Resolve every ambiguous FNRI mapping before staging.');
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.referenceDataRelease.update({ where: { id: releaseId }, data: { status: 'STAGED' } });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: 'REFERENCE_DATA_RELEASE_STAGED',
          entityType: 'ReferenceDataRelease',
          entityId: releaseId,
        },
      });
      return updated;
    });
  }

  static async activateRelease(adminUserId: string, releaseId: string, action: 'PUBLISH' | 'ROLLBACK') {
    const release = await prisma.referenceDataRelease.findUnique({
      where: { id: releaseId },
      include: { source: true },
    });
    if (!release) throw new Error('Reference data release not found.');
    const expected = action === 'PUBLISH' ? ReferenceDataReleaseStatus.STAGED : ReferenceDataReleaseStatus.RETIRED;
    if (release.status !== expected) {
      throw new Error(
        action === 'PUBLISH' ? 'Only a staged release can be published.' : 'Only a retired release can be restored.'
      );
    }
    if (!release.source.isEnabled) throw new Error('A disabled source cannot activate a release.');
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const current = await tx.referenceDataRelease.findFirst({
        where: { sourceId: release.sourceId, status: 'ACTIVE' },
      });
      if (current) {
        await tx.referenceDataRelease.update({
          where: { id: current.id },
          data: { status: 'RETIRED', retiredAt: now },
        });
      }
      const activated = await tx.referenceDataRelease.update({
        where: { id: releaseId },
        data: { status: 'ACTIVE', activatedByAdminId: adminUserId, activatedAt: now, retiredAt: null },
      });
      await tx.referenceDataReleaseActivation.create({
        data: {
          releaseId,
          replacedReleaseId: current?.id,
          actorAdminId: adminUserId,
          action,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: action === 'PUBLISH' ? 'REFERENCE_DATA_RELEASE_PUBLISHED' : 'REFERENCE_DATA_RELEASE_ROLLED_BACK',
          entityType: 'ReferenceDataRelease',
          entityId: releaseId,
          metadata: { replacedReleaseId: current?.id || null, sourceId: release.sourceId },
        },
      });
      return activated;
    });
  }

  static async createVerifiedAlias(adminUserId: string, input: CreateFoodAliasInput) {
    const normalizedAlias = normalizeFoodName(input.alias);
    if (!normalizedAlias) throw new Error('Alias must contain letters or numbers.');
    const [target, foods, aliases] = await Promise.all([
      prisma.foodItem.findUnique({ where: { id: input.foodItemId } }),
      prisma.foodItem.findMany({ select: { id: true, name: true } }),
      prisma.foodAlias.findMany({
        select: { id: true, foodItemId: true, alias: true, normalizedAlias: true, verifiedAt: true },
      }),
    ]);
    if (!target) throw new Error('FNRI food item not found.');
    const foodCollision = foods.find((food) => normalizeFoodName(food.name) === normalizedAlias);
    if (foodCollision) {
      if (foodCollision.id === target.id) throw new Error('The alias is already the canonical FNRI food name.');
      throw new Error(`That label is the canonical name of another FNRI food: ${foodCollision.name}.`);
    }
    const collisions = aliases.filter((alias) => normalizeFoodName(alias.alias) === normalizedAlias);
    if (collisions.some((alias) => alias.foodItemId !== target.id)) {
      throw new Error('That normalized alias already points to another FNRI food.');
    }
    if (collisions.length > 1) {
      throw new Error(
        'Multiple legacy aliases normalize to that label. Resolve the historical duplicates before verification.'
      );
    }
    const existing = collisions[0];
    return prisma.$transaction(async (tx) => {
      const alias = existing
        ? await tx.foodAlias.update({
            where: { id: existing.id },
            data: { normalizedAlias, verifiedByAdminId: adminUserId, verifiedAt: new Date() },
          })
        : await tx.foodAlias.create({
            data: {
              foodItemId: target.id,
              alias: input.alias.trim(),
              normalizedAlias,
              verifiedByAdminId: adminUserId,
              verifiedAt: new Date(),
            },
          });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: existing ? 'FOOD_ALIAS_VERIFIED' : 'FOOD_ALIAS_CREATED',
          entityType: 'FoodAlias',
          entityId: alias.id,
          metadata: { foodItemId: target.id, foodItemName: target.name, alias: alias.alias },
        },
      });
      return alias;
    });
  }
}
