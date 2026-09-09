import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '@/lib/prisma';
import { uploadMealImage, removeMealImage } from '@/lib/cloudinary';

type ManifestRow = Record<string, string> & {
  meal_name: string;
  review_status: string;
  image_kind: 'EXACT' | 'REPRESENTATIVE';
  alt_text: string;
  thumbnail_url: string;
  creator: string;
  source_page_url: string;
  license: string;
  license_url: string;
  source_title: string;
  review_notes: string;
};

const LICENSE_CODES: Record<string, string> = {
  CC0: 'CC0',
  'Public domain': 'PUBLIC_DOMAIN',
  'CC BY 4.0': 'CC_BY_4_0',
  'CC BY-SA 4.0': 'CC_BY_SA_4_0',
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

async function readManifest(filePath: string): Promise<ManifestRow[]> {
  const raw = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])) as ManifestRow;
  });
}

function validateUrl(rawUrl: string, allowedHosts: Set<string>, label: string) {
  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.protocol !== 'https:' || !allowedHosts.has(parsedUrl.hostname)) {
    throw new Error(`${label} must use HTTPS on an approved host.`);
  }
}

async function fetchImage(rawUrl: string): Promise<Buffer> {
  const deliveryHosts = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
  validateUrl(rawUrl, deliveryHosts, 'Thumbnail URL');
  const response = await fetch(rawUrl, {
    redirect: 'follow',
    headers: { 'user-agent': 'NutriMindMealImageImporter/1.0 (educational capstone project)' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}.`);
  validateUrl(response.url, deliveryHosts, 'Final thumbnail URL');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error('Downloaded resource is not an image.');
  const advertisedBytes = Number(response.headers.get('content-length') || 0);
  if (advertisedBytes > 5 * 1024 * 1024) throw new Error('Image exceeds the 5 MB import limit.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Image has an invalid size.');
  return buffer;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const replace = process.argv.includes('--replace');
  const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='));
  const manifestPath = path.resolve(
    process.cwd(),
    manifestArg?.slice('--manifest='.length) || '../docs/meal-images/generated/approved-meal-images.csv'
  );
  const rows = await readManifest(manifestPath);
  if (!rows.length) throw new Error('Approved image manifest is empty.');

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isSuspended: false },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (apply && !admin) throw new Error('An active administrator is required for the import audit trail.');

  let imported = 0;
  let unchanged = 0;
  let skippedExisting = 0;
  for (const row of rows) {
    if (row.review_status !== 'APPROVED') throw new Error(`${row.meal_name} is not approved.`);
    const licenseCode = LICENSE_CODES[row.license];
    if (!licenseCode) throw new Error(`${row.meal_name} has an unsupported license.`);
    validateUrl(row.source_page_url, new Set(['commons.wikimedia.org']), 'Source page URL');
    validateUrl(row.license_url, new Set(['creativecommons.org']), 'License URL');

    const meal = await prisma.mealLibrary.findFirst({ where: { mealName: row.meal_name } });
    if (!meal) throw new Error(`MealLibrary entry not found: ${row.meal_name}`);
    if (meal.imageSourcePageUrl === row.source_page_url && meal.imagePublicId) {
      unchanged += 1;
      continue;
    }
    if (meal.imagePublicId && !replace) {
      skippedExisting += 1;
      continue;
    }
    if (!apply) continue;

    const buffer = await fetchImage(row.thumbnail_url);
    const uploaded = await uploadMealImage(buffer, meal.id);
    if (!uploaded.width || !uploaded.height || uploaded.width < 320 || uploaded.height < 240) {
      await removeMealImage(uploaded.public_id);
      throw new Error(`Imported image is too small for ${row.meal_name}.`);
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.mealLibrary.update({
          where: { id: meal.id },
          data: {
            imagePublicId: uploaded.public_id,
            imageVersion: String(uploaded.version),
            imageFormat: uploaded.format,
            imageWidth: uploaded.width,
            imageHeight: uploaded.height,
            imageBytes: uploaded.bytes,
            imageKind: row.image_kind,
            imageAltText: row.alt_text,
            imageCreator: row.creator,
            imageSourcePageUrl: row.source_page_url,
            imageLicenseCode: licenseCode,
            imageLicenseUrl: row.license_url,
            imageAssignedAt: new Date(),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: admin!.id,
            action: 'MEAL_IMAGE_CATALOGUE_IMPORTED',
            entityType: 'MealLibrary',
            entityId: meal.id,
            metadata: {
              sourceTitle: row.source_title,
              sourcePageUrl: row.source_page_url,
              imageKind: row.image_kind,
              licenseCode,
              reviewNotes: row.review_notes,
              previousAssetRetainedForRecovery: Boolean(meal.imagePublicId),
            },
          },
        });
      });
      imported += 1;
    } catch (error) {
      await removeMealImage(uploaded.public_id).catch(() => undefined);
      throw error;
    }
  }

  console.log(
    JSON.stringify(
      { mode: apply ? 'apply' : 'dry-run', approved: rows.length, imported, unchanged, skippedExisting },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Meal image import failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
