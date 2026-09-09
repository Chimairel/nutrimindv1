import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicMealImage } from '../src/domain/meal-image.policy';
import { mealImageMetadataSchema } from '../src/validation/meal-image.schemas';

const base = {
  imagePublicId: 'nutrimind/meals/tinola sample',
  imageVersion: '1720000000',
  imageFormat: 'jpg',
  imageKind: 'EXACT' as const,
  imageAltText: 'A bowl of chicken tinola with green papaya',
  imageCreator: 'NutriMind',
  imageSourcePageUrl: null,
  imageLicenseCode: 'OWNED',
  imageLicenseUrl: null,
};

test('[TEST-204] public meal image uses a fixed optimized Cloudinary delivery transform', () => {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  try {
    assert.deepEqual(toPublicMealImage(base), {
      url: 'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,c_fill,g_auto,w_960,h_640/v1720000000/nutrimind/meals/tinola%20sample.jpg',
      altText: base.imageAltText,
      kind: 'EXACT',
      attribution: {
        creator: 'NutriMind',
        sourcePageUrl: null,
        licenseCode: 'OWNED',
        licenseUrl: null,
        modifications: null,
      },
    });
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previous;
  }
});

test('[TEST-204] incomplete image records fail closed instead of emitting broken URLs', () => {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  try {
    assert.equal(toPublicMealImage({ ...base, imageAltText: null }), null);
    assert.equal(toPublicMealImage({ ...base, imagePublicId: null }), null);
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previous;
  }
});

test('[TEST-204] third-party delivery discloses display transformations', () => {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  try {
    const image = toPublicMealImage({
      ...base,
      imageKind: 'REPRESENTATIVE',
      imageLicenseCode: 'CC_BY_SA_4_0',
      imageSourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    });
    assert.equal(image?.attribution.modifications, 'Resized, format-optimized, and cropped for display.');
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previous;
  }
});

test('[TEST-205] third-party licenses require complete creator, source, and license attribution', () => {
  assert.equal(
    mealImageMetadataSchema.safeParse({ imageKind: 'EXACT', altText: base.imageAltText, licenseCode: 'CC_BY_4_0' })
      .success,
    false
  );
  assert.equal(
    mealImageMetadataSchema.safeParse({
      imageKind: 'REPRESENTATIVE',
      altText: base.imageAltText,
      licenseCode: 'CC_BY_SA_4_0',
      creator: 'Example photographer',
      sourcePageUrl: 'https://example.com/photo',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    }).success,
    true
  );
});

test('[TEST-205] owned and generated images allow internal provenance without invented public links', () => {
  assert.equal(
    mealImageMetadataSchema.safeParse({
      imageKind: 'EXACT',
      altText: base.imageAltText,
      licenseCode: 'OWNED',
      creator: 'NutriMind',
    }).success,
    true
  );
  assert.equal(
    mealImageMetadataSchema.safeParse({ imageKind: 'EXACT', altText: 'short', licenseCode: 'GENERATED' }).success,
    false
  );
});
