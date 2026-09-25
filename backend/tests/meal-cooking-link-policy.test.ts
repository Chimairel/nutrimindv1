import assert from 'node:assert/strict';
import test from 'node:test';
import { cookingLinkForMeal } from '../src/domain/meal-cooking-link.policy';

test('a Panlasang corpus meal opens its exact article even without a stored video', () => {
  assert.deepEqual(cookingLinkForMeal({
    sourceRawRecipeCandidate: {
      recipeName: 'Chicken Adobo Fried Rice and Tortang Corned Beef',
      sourceName: 'PANLASANG_PINOY',
      sourceUrl: 'https://panlasangpinoy.com/chicken-adobo-fried-rice-and-tortang-corned-beef/',
      sourceImageUrl: null,
      sourceVideoUrl: null,
    },
  }), {
    url: 'https://panlasangpinoy.com/chicken-adobo-fried-rice-and-tortang-corned-beef/',
    kind: 'PANLASANG_RECIPE',
  });
});

test('a linked video is used only when there is no Panlasang article, and spoofed hosts are rejected', () => {
  assert.deepEqual(cookingLinkForMeal({ libraryDescription: 'Video: https://youtu.be/uXi6QDOdhGg' }), {
    url: 'https://www.youtube.com/watch?v=uXi6QDOdhGg',
    kind: 'SOURCE_VIDEO',
  });
  assert.equal(cookingLinkForMeal({ libraryDescription: 'Source: https://panlasangpinoy.com.evil.example/recipe/' }), null);
  assert.equal(cookingLinkForMeal({ libraryDescription: 'Video: https://youtube.com.evil.example/watch?v=uXi6QDOdhGg' }), null);
});
