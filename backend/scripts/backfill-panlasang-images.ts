import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { toPublicRawRecipeImage } from '../src/domain/meal-image.policy';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function sourcePage(description: string | null): string | null {
  const value = description?.match(/(?:^|\n)\s*Source:\s*(https:\/\/[^\s<>"']+)/i)?.[1];
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === 'panlasangpinoy.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

function metaImage(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!/(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["']/i.test(tag)) continue;
    const value = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (value) return value.replaceAll('&amp;', '&');
  }
  return null;
}

async function discoverImage(sourceUrl: string): Promise<string | null> {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'panlasangpinoy.com') return null;
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const candidate = metaImage(await response.text());
    const image = toPublicRawRecipeImage({
      recipeName: 'Recipe',
      sourceName: 'PANLASANG_PINOY',
      sourceUrl,
      sourceImageUrl: candidate,
      sourceVideoUrl: null,
    });
    if (!image || !candidate) return null;
    const check = await fetch(image.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    return check.ok && check.headers.get('content-type')?.startsWith('image/') ? image.url : null;
  } catch {
    return null;
  }
}

async function main() {
  const [rawMissing, librarySources, corpusSources] = await Promise.all([
    prisma.rawRecipeCandidate.findMany({
      where: { sourceName: 'PANLASANG_PINOY', sourceImageUrl: null },
      select: { id: true, sourceUrl: true },
    }),
    prisma.mealLibrary.findMany({
      where: { description: { contains: 'Source: https://panlasangpinoy.com' } },
      select: { description: true },
    }),
    prisma.rawRecipeCandidate.findMany({ select: { sourceUrl: true } }),
  ]);
  const indexedUrls = new Set(corpusSources.map((recipe) => recipe.sourceUrl));
  const legacyUrls = [
    ...new Set(librarySources.map((meal) => sourcePage(meal.description)).filter((url): url is string => Boolean(url))),
  ].filter((url) => !indexedUrls.has(url));
  const urls = [...new Set([...rawMissing.map((recipe) => recipe.sourceUrl), ...legacyUrls])];
  const found = new Map<string, string>();
  const failed: string[] = [];
  for (let offset = 0; offset < urls.length; offset += 6) {
    await Promise.all(
      urls.slice(offset, offset + 6).map(async (url) => {
        const image = await discoverImage(url);
        if (image) found.set(url, image);
        else failed.push(url);
      })
    );
  }
  console.log(
    JSON.stringify(
      {
        apply,
        rawMissing: rawMissing.length,
        rawFound: rawMissing.filter((recipe) => found.has(recipe.sourceUrl)).length,
        legacyMissing: legacyUrls.length,
        legacyFound: legacyUrls.filter((url) => found.has(url)).length,
        failed,
      },
      null,
      2
    )
  );
  if (!apply) return;

  for (const recipe of rawMissing) {
    const sourceImageUrl = found.get(recipe.sourceUrl);
    if (!sourceImageUrl) continue;
    await prisma.rawRecipeCandidate.updateMany({
      where: { id: recipe.id, sourceImageUrl: null },
      data: { sourceImageUrl },
    });
  }
  const manifestPath = path.resolve(__dirname, '../src/data/panlasang-legacy-images.json');
  const previous = await readFile(manifestPath, 'utf8')
    .then((contents) => JSON.parse(contents) as Record<string, string>)
    .catch(() => ({}));
  const legacyImages = {
    ...previous,
    ...Object.fromEntries(legacyUrls.flatMap((url) => (found.has(url) ? [[url, found.get(url)!]] : []))),
  };
  await writeFile(manifestPath, `${JSON.stringify(legacyImages, null, 2)}\n`, 'utf8');
}

main().finally(() => prisma.$disconnect());
