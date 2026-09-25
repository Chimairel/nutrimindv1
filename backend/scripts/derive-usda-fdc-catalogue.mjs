/* global console */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCES = [
  {
    file: 'FoodData_Central_foundation_food_json_2026-04-30.json',
    sha256: '27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc',
    key: 'FoundationFoods',
    dataset: 'Foundation Foods, April 2026',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip',
  },
  {
    file: 'surveyDownload.json',
    sha256: '2e7eb9fda92adf1d4d784dba5eaa3a7fd4418cd86ccff383c7c9294d79e9b808',
    key: 'SurveyFoods',
    dataset: 'FNDDS 2021–2023, October 2024',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip',
  },
  {
    file: 'FoodData_Central_sr_legacy_food_json_2018-04.json',
    sha256: '70d4235ae3a2bdf48a7b9eaa1286a83fa67b6f3270436c9ce8b008213f500129',
    key: 'SRLegacyFoods',
    dataset: 'SR Legacy, April 2018',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
  },
];

const inputDirectory = path.resolve('data/usda/source-delivery');
const outputFile = path.resolve('prisma/data/usda-fdc-catalogue.json');
const wantedNutrients = {
  proteinG: [1003],
  fatG: [1004],
  carbsG: [1005],
  fiber: [1079],
  sodium: [1093],
  potassium: [1092],
  calcium: [1087],
  iron: [1089],
  vitaminA: [1106],
  vitaminC: [1162],
};

function nutrientAmount(food, ids, unit) {
  for (const id of ids) {
    const nutrient = food.foodNutrients?.find((item) => item.nutrient?.id === id && item.nutrient.unitName === unit);
    if (Number.isFinite(nutrient?.amount) && nutrient.amount >= 0) return nutrient.amount;
  }
  return null;
}

function projectFood(food, source) {
  if (!food || !Number.isSafeInteger(food.fdcId) || !food.description?.trim()) return null;
  const calories = nutrientAmount(food, [1008, 2048, 2047], 'kcal');
  const proteinG = nutrientAmount(food, wantedNutrients.proteinG, 'g');
  const fatG = nutrientAmount(food, wantedNutrients.fatG, 'g');
  const carbsG = nutrientAmount(food, wantedNutrients.carbsG, 'g');
  if ([calories, proteinG, fatG, carbsG].some((value) => value === null)) return null;
  return {
    fdcId: food.fdcId,
    name: food.description.trim(),
    dataType: food.dataType,
    dataset: source.dataset,
    publishedAt: food.publicationDate,
    sourceUrl: `https://fdc.nal.usda.gov/food-search/?query=${food.fdcId}`,
    category: food.foodCategory?.description ?? food.wweiaFoodCategory?.wweiaFoodCategoryDescription ?? null,
    calories,
    proteinG,
    fatG,
    carbsG,
    fiber: nutrientAmount(food, wantedNutrients.fiber, 'g'),
    sodium: nutrientAmount(food, wantedNutrients.sodium, 'mg'),
    potassium: nutrientAmount(food, wantedNutrients.potassium, 'mg'),
    calcium: nutrientAmount(food, wantedNutrients.calcium, 'mg'),
    iron: nutrientAmount(food, wantedNutrients.iron, 'mg'),
    vitaminA: nutrientAmount(food, wantedNutrients.vitaminA, 'µg'),
    vitaminC: nutrientAmount(food, wantedNutrients.vitaminC, 'mg'),
  };
}

const records = [];
for (const source of SOURCES) {
  const buffer = await readFile(path.join(inputDirectory, source.file));
  const actualHash = createHash('sha256').update(buffer).digest('hex');
  if (actualHash !== source.sha256) throw new Error(`Unexpected USDA dataset hash: ${source.file}`);
  const parsed = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed[source.key])) throw new Error(`Missing USDA collection ${source.key}`);
  const selected = parsed[source.key].map((food) => projectFood(food, source)).filter(Boolean);
  records.push(...selected);
  console.log(`${source.dataset}: ${selected.length} nutrient-complete records`);
}

records.sort((left, right) => left.fdcId - right.fdcId);
if (new Set(records.map((item) => item.fdcId)).size !== records.length) throw new Error('Duplicate USDA FDC IDs');
const output = { source: 'USDA FoodData Central', sourceUrl: 'https://fdc.nal.usda.gov/', datasets: SOURCES, records };
await writeFile(outputFile, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`${records.length} records written to ${outputFile}`);
