import {
  IngredientPriceMappingEvidenceKind,
  IngredientPriceMappingState,
  IngredientPriceUnit,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  LoadedPsaSnapshot,
  PsaOpenStatCommodity,
  buildPsaCoverageReport,
  stablePriceEvidenceId,
} from '@/domain/psa-openstat-price-ingestion';

export interface PsaImportCounters {
  created: number;
  existing: number;
}

export interface PsaImportResult {
  source: PsaImportCounters;
  geography: PsaImportCounters;
  publications: PsaImportCounters;
  commodities: PsaImportCounters;
  mappings: PsaImportCounters;
  observations: PsaImportCounters;
  missingCells: number;
  coverage: ReturnType<typeof buildPsaCoverageReport>;
}

function counters(): PsaImportCounters {
  return { created: 0, existing: 0 };
}

function sameNullableString(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

function assertSame(label: string, checks: ReadonlyArray<[boolean, string]>): void {
  const mismatch = checks.find(([matches]) => !matches);
  if (mismatch) throw new Error(`${label}: existing immutable evidence conflicts at ${mismatch[1]}`);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function resolveUniqueFoodItemId(
  tx: Prisma.TransactionClient,
  foodName: string,
): Promise<string> {
  const matches = await tx.foodItem.findMany({ where: { name: foodName }, select: { id: true }, take: 2 });
  if (matches.length !== 1) {
    throw new Error(`FNRI food name must resolve exactly once: ${foodName} (matches=${matches.length})`);
  }
  return matches[0].id;
}

async function resolveMapping(
  tx: Prisma.TransactionClient,
  commodity: PsaOpenStatCommodity,
): Promise<{
  state: IngredientPriceMappingState;
  foodItemId: string | null;
  evidenceKind: IngredientPriceMappingEvidenceKind;
  evidenceReference: string | null;
  rationale: string;
  candidateFoodItemIds: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}> {
  if (commodity.mapping.state === 'EXACT') {
    return {
      state: IngredientPriceMappingState.EXACT,
      foodItemId: await resolveUniqueFoodItemId(tx, commodity.mapping.foodName),
      evidenceKind: commodity.mapping.evidenceKind,
      evidenceReference: commodity.mapping.evidenceReference,
      rationale: commodity.mapping.rationale,
      candidateFoodItemIds: Prisma.JsonNull,
    };
  }
  if (commodity.mapping.state === 'AMBIGUOUS') {
    const ids: string[] = [];
    for (const foodName of commodity.mapping.candidateFoodNames) {
      ids.push(await resolveUniqueFoodItemId(tx, foodName));
    }
    return {
      state: IngredientPriceMappingState.AMBIGUOUS,
      foodItemId: null,
      evidenceKind: IngredientPriceMappingEvidenceKind.CANDIDATE_ONLY,
      evidenceReference: null,
      rationale: commodity.mapping.rationale,
      candidateFoodItemIds: ids,
    };
  }
  return {
    state: commodity.mapping.state,
    foodItemId: null,
    evidenceKind: commodity.mapping.evidenceKind,
    evidenceReference: null,
    rationale: commodity.mapping.rationale,
    candidateFoodItemIds: Prisma.JsonNull,
  };
}

function mappingSemanticKey(mapping: {
  state: IngredientPriceMappingState;
  foodItemId: string | null;
  evidenceKind: IngredientPriceMappingEvidenceKind;
  evidenceReference: string | null;
  rationale: string;
  candidateFoodItemIds: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}): string {
  return JSON.stringify({
    state: mapping.state,
    foodItemId: mapping.foodItemId,
    evidenceKind: mapping.evidenceKind,
    evidenceReference: mapping.evidenceReference,
    rationale: mapping.rationale,
    candidateFoodItemIds: mapping.candidateFoodItemIds === Prisma.JsonNull ? null : mapping.candidateFoodItemIds,
  });
}

export async function importPsaOpenStatSnapshot(
  prisma: PrismaClient,
  snapshot: LoadedPsaSnapshot,
): Promise<PsaImportResult> {
  const result: PsaImportResult = {
    source: counters(),
    geography: counters(),
    publications: counters(),
    commodities: counters(),
    mappings: counters(),
    observations: counters(),
    missingCells: snapshot.parsedFiles.flatMap((file) => file.cells).filter((cell) => cell.status === 'MISSING').length,
    coverage: buildPsaCoverageReport(snapshot),
  };

  await prisma.$transaction(async (tx) => {
    const sourceId = stablePriceEvidenceId('price_source', snapshot.manifest.source.code);
    const existingSource = await tx.ingredientPriceSource.findUnique({ where: { code: snapshot.manifest.source.code } });
    if (existingSource) {
      assertSame('IngredientPriceSource', [
        [existingSource.id === sourceId, 'id'],
        [existingSource.kind === 'PSA_OPENSTAT', 'kind'],
        [existingSource.agencyName === snapshot.manifest.source.agencyName, 'agencyName'],
        [existingSource.datasetName === snapshot.manifest.source.datasetName, 'datasetName'],
        [existingSource.homepageUrl === snapshot.manifest.source.homepageUrl, 'homepageUrl'],
        [existingSource.apiBaseUrl === snapshot.manifest.source.apiBaseUrl, 'apiBaseUrl'],
        [existingSource.termsUrl === snapshot.manifest.source.termsUrl, 'termsUrl'],
        [existingSource.licenseCode === snapshot.manifest.source.licenseCode, 'licenseCode'],
        [existingSource.attributionText === snapshot.manifest.source.attributionText, 'attributionText'],
        [existingSource.accessMethod === 'API', 'accessMethod'],
        [existingSource.automationStatus === 'SUPPORTED', 'automationStatus'],
        [existingSource.updateCadence === snapshot.manifest.source.updateCadence, 'updateCadence'],
      ]);
      result.source.existing += 1;
    } else {
      await tx.ingredientPriceSource.create({ data: {
        id: sourceId,
        code: snapshot.manifest.source.code,
        kind: 'PSA_OPENSTAT',
        agencyName: snapshot.manifest.source.agencyName,
        datasetName: snapshot.manifest.source.datasetName,
        homepageUrl: snapshot.manifest.source.homepageUrl,
        apiBaseUrl: snapshot.manifest.source.apiBaseUrl,
        termsUrl: snapshot.manifest.source.termsUrl,
        licenseCode: snapshot.manifest.source.licenseCode,
        attributionText: snapshot.manifest.source.attributionText,
        accessMethod: 'API',
        automationStatus: 'SUPPORTED',
        updateCadence: snapshot.manifest.source.updateCadence,
      } });
      result.source.created += 1;
    }

    const geographyId = stablePriceEvidenceId(
      'price_geo',
      snapshot.manifest.geography.scheme,
      snapshot.manifest.geography.externalCode,
    );
    const existingGeography = await tx.ingredientPriceGeography.findUnique({
      where: { scheme_externalCode: {
        scheme: snapshot.manifest.geography.scheme,
        externalCode: snapshot.manifest.geography.externalCode,
      } },
    });
    if (existingGeography) {
      assertSame('IngredientPriceGeography', [
        [existingGeography.id === geographyId, 'id'],
        [existingGeography.displayName === snapshot.manifest.geography.displayName, 'displayName'],
        [existingGeography.level === snapshot.manifest.geography.level, 'level'],
        [existingGeography.parentId === null, 'parentId'],
      ]);
      result.geography.existing += 1;
    } else {
      await tx.ingredientPriceGeography.create({ data: {
        id: geographyId,
        scheme: snapshot.manifest.geography.scheme,
        externalCode: snapshot.manifest.geography.externalCode,
        displayName: snapshot.manifest.geography.displayName,
        level: snapshot.manifest.geography.level,
      } });
      result.geography.created += 1;
    }

    const commodityIds = new Map<string, string>();
    for (const file of snapshot.manifest.files) {
      for (const commodity of file.commodities) {
        const sourceCommodityKey = `${file.matrixId}:${commodity.externalCode}`;
        const commodityId = stablePriceEvidenceId('price_commodity', sourceId, sourceCommodityKey);
        commodityIds.set(sourceCommodityKey, commodityId);
        const existingCommodity = await tx.ingredientPriceCommodity.findUnique({
          where: { sourceId_sourceCommodityKey: { sourceId, sourceCommodityKey } },
        });
        if (existingCommodity) {
          assertSame(`IngredientPriceCommodity ${sourceCommodityKey}`, [
            [existingCommodity.id === commodityId, 'id'],
            [existingCommodity.originalDescription === commodity.sourceLabel, 'originalDescription'],
            [existingCommodity.originalSpecification === null, 'originalSpecification'],
            [existingCommodity.originalUnit === commodity.originalUnit, 'originalUnit'],
            [existingCommodity.normalizedQuantity?.toString() === commodity.normalizedQuantity, 'normalizedQuantity'],
            [existingCommodity.normalizedUnit === commodity.normalizedUnit, 'normalizedUnit'],
          ]);
          result.commodities.existing += 1;
        } else {
          await tx.ingredientPriceCommodity.create({ data: {
            id: commodityId,
            sourceId,
            sourceCommodityKey,
            originalDescription: commodity.sourceLabel,
            originalSpecification: null,
            originalUnit: commodity.originalUnit,
            normalizedQuantity: new Prisma.Decimal(commodity.normalizedQuantity),
            normalizedUnit: commodity.normalizedUnit as IngredientPriceUnit,
          } });
          result.commodities.created += 1;
        }

        const mapping = await resolveMapping(tx, commodity);
        const semanticKey = mappingSemanticKey(mapping);
        const mappingId = stablePriceEvidenceId('price_mapping', commodityId, semanticKey);
        const existingMapping = await tx.ingredientPriceCommodityMapping.findUnique({ where: { id: mappingId } });
        if (existingMapping) {
          assertSame(`IngredientPriceCommodityMapping ${sourceCommodityKey}`, [
            [existingMapping.commodityId === commodityId, 'commodityId'],
            [mappingSemanticKey({
              state: existingMapping.state,
              foodItemId: existingMapping.foodItemId,
              evidenceKind: existingMapping.evidenceKind,
              evidenceReference: existingMapping.evidenceReference,
              rationale: existingMapping.rationale,
              candidateFoodItemIds: existingMapping.candidateFoodItemIds ?? Prisma.JsonNull,
            }) === semanticKey, 'mapping decision'],
          ]);
          result.mappings.existing += 1;
        } else {
          const activeMapping = await tx.ingredientPriceCommodityMapping.findFirst({
            where: { commodityId, supersededBy: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          });
          await tx.ingredientPriceCommodityMapping.create({ data: {
            id: mappingId,
            commodityId,
            state: mapping.state,
            foodItemId: mapping.foodItemId,
            evidenceKind: mapping.evidenceKind,
            evidenceReference: mapping.evidenceReference,
            rationale: mapping.rationale,
            candidateFoodItemIds: mapping.candidateFoodItemIds,
            supersedesMappingId: activeMapping?.id ?? null,
          } });
          result.mappings.created += 1;
        }
      }
    }

    const retrievedAt = new Date(snapshot.manifest.retrievedAt);
    for (const file of snapshot.manifest.files) {
      const parsedFile = snapshot.parsedFiles.find((candidate) => candidate.matrixId === file.matrixId);
      if (!parsedFile) throw new Error(`Parsed file missing for ${file.matrixId}`);
      const available = parsedFile.cells.filter((cell) => cell.status === 'AVAILABLE');
      const periods = parsedFile.cells.map((cell) => [cell.observedFrom, cell.observedTo] as const);
      const periodStart = periods.reduce((lowest, [from]) => from < lowest ? from : lowest, periods[0][0]);
      const periodEnd = periods.reduce((highest, [, to]) => to > highest ? to : highest, periods[0][1]);
      const externalPublicationId = `${snapshot.manifest.snapshotId}:${file.matrixId}`;
      const publicationId = stablePriceEvidenceId(
        'price_publication', sourceId, externalPublicationId, snapshot.manifest.retrievedAt, file.dataSha256,
      );
      const metadata: Prisma.InputJsonObject = {
        matrixId: file.matrixId,
        matrixTitle: file.matrixTitle,
        requestFile: file.requestFile,
        requestSha256: file.requestSha256,
        dataFile: file.dataFile,
        selectedGeographyCode: snapshot.manifest.geography.externalCode,
        selectedGeographyLabel: snapshot.manifest.geography.sourceLabel,
        availableCellCount: available.length,
        missingCellCount: parsedFile.cells.length - available.length,
        missingMarkersPreservedInSnapshot: true,
        licenseCode: snapshot.manifest.source.licenseCode,
        attributionText: snapshot.manifest.source.attributionText,
      };
      const existingPublication = await tx.ingredientPricePublication.findUnique({ where: { id: publicationId } });
      if (existingPublication) {
        assertSame(`IngredientPricePublication ${file.matrixId}`, [
          [existingPublication.sourceId === sourceId, 'sourceId'],
          [existingPublication.externalPublicationId === externalPublicationId, 'externalPublicationId'],
          [existingPublication.sourceUrl === `${snapshot.manifest.source.apiBaseUrl}/${file.matrixId}`, 'sourceUrl'],
          [existingPublication.retrievedAt.getTime() === retrievedAt.getTime(), 'retrievedAt'],
          [existingPublication.contentSha256 === file.dataSha256, 'contentSha256'],
          [existingPublication.periodStart?.toISOString().slice(0, 10) === periodStart, 'periodStart'],
          [existingPublication.periodEnd?.toISOString().slice(0, 10) === periodEnd, 'periodEnd'],
          [existingPublication.publishedAt === null, 'publishedAt'],
          [canonicalJson(existingPublication.metadata) === canonicalJson(metadata), 'metadata'],
        ]);
        result.publications.existing += 1;
      } else {
        await tx.ingredientPricePublication.create({ data: {
          id: publicationId,
          sourceId,
          externalPublicationId,
          sourceUrl: `${snapshot.manifest.source.apiBaseUrl}/${file.matrixId}`,
          publishedAt: null,
          periodStart: new Date(`${periodStart}T00:00:00.000Z`),
          periodEnd: new Date(`${periodEnd}T00:00:00.000Z`),
          retrievedAt,
          contentSha256: file.dataSha256,
          metadata,
        } });
        result.publications.created += 1;
      }

      for (const cell of available) {
        const commodityId = commodityIds.get(cell.sourceCommodityKey);
        if (!commodityId) throw new Error(`Commodity ID missing for ${cell.sourceCommodityKey}`);
        const commodity = file.commodities.find((candidate) =>
          `${file.matrixId}:${candidate.externalCode}` === cell.sourceCommodityKey);
        if (!commodity) throw new Error(`Manifest commodity missing for ${cell.sourceCommodityKey}`);
        const sourceObservationKey = [
          file.matrixId,
          snapshot.manifest.geography.externalCode,
          commodity.externalCode,
          cell.observedFrom.slice(0, 7),
        ].join('|');
        const observationId = stablePriceEvidenceId('price_observation', publicationId, sourceObservationKey);
        const existingObservation = await tx.ingredientPriceObservation.findUnique({ where: { id: observationId } });
        if (existingObservation) {
          assertSame(`IngredientPriceObservation ${sourceObservationKey}`, [
            [existingObservation.publicationId === publicationId, 'publicationId'],
            [existingObservation.commodityId === commodityId, 'commodityId'],
            [existingObservation.geographyId === geographyId, 'geographyId'],
            [existingObservation.sourceObservationKey === sourceObservationKey, 'sourceObservationKey'],
            [existingObservation.kind === 'AVERAGE_RETAIL', 'kind'],
            [existingObservation.currency === 'PHP', 'currency'],
            [existingObservation.amountMinCentavos === cell.amountCentavos, 'amountMinCentavos'],
            [existingObservation.amountMaxCentavos === cell.amountCentavos, 'amountMaxCentavos'],
            [existingObservation.observedFrom.toISOString().slice(0, 10) === cell.observedFrom, 'observedFrom'],
            [existingObservation.observedTo.toISOString().slice(0, 10) === cell.observedTo, 'observedTo'],
            [existingObservation.originalCommodityDescription === commodity.sourceLabel, 'originalCommodityDescription'],
            [existingObservation.originalSpecification === null, 'originalSpecification'],
            [existingObservation.originalUnit === commodity.originalUnit, 'originalUnit'],
            [existingObservation.normalizedQuantity?.toString() === commodity.normalizedQuantity, 'normalizedQuantity'],
            [existingObservation.normalizedUnit === commodity.normalizedUnit, 'normalizedUnit'],
            [existingObservation.validFrom === null, 'validFrom'],
            [existingObservation.validUntil === null, 'validUntil'],
          ]);
          result.observations.existing += 1;
          continue;
        }
        const activeObservation = await tx.ingredientPriceObservation.findFirst({
          where: { commodityId, geographyId, sourceObservationKey, supersededBy: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        await tx.ingredientPriceObservation.create({ data: {
          id: observationId,
          publicationId,
          commodityId,
          geographyId,
          sourceObservationKey,
          kind: 'AVERAGE_RETAIL',
          currency: 'PHP',
          amountMinCentavos: cell.amountCentavos,
          amountMaxCentavos: cell.amountCentavos,
          observedFrom: new Date(`${cell.observedFrom}T00:00:00.000Z`),
          observedTo: new Date(`${cell.observedTo}T00:00:00.000Z`),
          validFrom: null,
          validUntil: null,
          originalCommodityDescription: commodity.sourceLabel,
          originalSpecification: null,
          originalUnit: commodity.originalUnit,
          normalizedQuantity: new Prisma.Decimal(commodity.normalizedQuantity),
          normalizedUnit: commodity.normalizedUnit as IngredientPriceUnit,
          supersedesObservationId: activeObservation?.id ?? null,
        } });
        result.observations.created += 1;
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return result;
}
