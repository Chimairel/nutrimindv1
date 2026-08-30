import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Map first letter of food_id to official FNRI food categories
const categoryMap: Record<string, string> = {
  'A': 'Cereals & Grains',
  'B': 'Starchy Roots & Tubers',
  'C': 'Dry Beans, Peas, Nuts & Seeds',
  'D': 'Vegetables',
  'E': 'Fruits',
  'F': 'Fish & Shellfish',
  'G': 'Meat & Poultry',
  'H': 'Eggs',
  'I': 'Milk & Dairy',
  'J': 'Fats & Oils',
  'K': 'Sugars & Sweets',
  'L': 'Beverages',
  'M': 'Miscellaneous',
};

// Character-by-character CSV line parser handling double-quoted cells with internal commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Converts raw cells to Float, mapping empty/trace symbols to 0
function parseFloatOrZero(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim();
  if (
    cleaned === '' ||
    cleaned === '-' ||
    cleaned.toLowerCase() === 'tr' ||
    cleaned.toLowerCase() === 'n/a'
  ) {
    return 0;
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Converts raw cells to Float, returning null for missing optionals
function parseFloatOrNull(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.trim();
  if (
    cleaned === '' ||
    cleaned === '-' ||
    cleaned.toLowerCase() === 'tr' ||
    cleaned.toLowerCase() === 'n/a'
  ) {
    return null;
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

async function main() {
  console.log('[Seeder] Starting FNRI Philippine Food Composition Table seeding process...');
  const csvPath = path.join(__dirname, 'data', 'fnri.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`[Seeder] 🛑 ERROR: FNRI CSV dataset not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  // Handle various system line terminators
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Skip the first header line
  const dataLines = lines.slice(1);
  console.log(`[Seeder] Found ${dataLines.length} food item rows to parse.`);

  let insertedCount = 0;
  let updatedCount = 0;

  // Process rows sequentially to prevent socket pool exhausts
  for (const line of dataLines) {
    const cells = parseCSVLine(line);
    if (cells.length < 2) continue; // Skip empty rows

    const foodId = cells[0];
    const foodName = cells[1];
    const _scientificName = cells[2];
    const _alternateName = cells[3];
    const _ediblePortion = cells[4];
    const hasDataString = cells[5];

    // If there is no real composition data, skip the row
    if (hasDataString.toUpperCase() !== 'TRUE') continue;

    // Resolve general category based on the first letter of the food_id
    const firstChar = foodId.trim().charAt(0).toUpperCase();
    const category = categoryMap[firstChar] || 'Miscellaneous';

    // Parse macro and micro properties
    const water = parseFloatOrNull(cells[6]);
    const calories = parseFloatOrZero(cells[7]);
    const proteinG = parseFloatOrZero(cells[8]);
    const fatG = parseFloatOrZero(cells[9]);
    const carbsG = parseFloatOrZero(cells[10]);
    const _ash = parseFloatOrNull(cells[12]);
    const fiber = parseFloatOrNull(cells[13]);
    const _sugar = parseFloatOrNull(cells[14]);
    const calcium = parseFloatOrNull(cells[15]);
    const _phosphorus = parseFloatOrNull(cells[16]);
    const iron = parseFloatOrNull(cells[17]);
    const sodium = parseFloatOrNull(cells[18]);
    const vitA = parseFloatOrNull(cells[21]); // RAE
    const vitB1 = parseFloatOrNull(cells[22]); // Thiamin
    const vitB2 = parseFloatOrNull(cells[23]); // Riboflavin
    const niacin = parseFloatOrNull(cells[24]);
    const vitC = parseFloatOrNull(cells[25]); // Ascorbic Acid
    const potassium = parseFloatOrNull(cells[30]);

    // Upsert equivalent: check if food with the exact same name already exists
    const existing = await prisma.foodItem.findFirst({
      where: { name: foodName },
    });

    const foodData = {
      name: foodName,
      category,
      calories,
      proteinG,
      carbsG,
      fatG,
      fiber,
      sodium,
      potassium,
      calcium,
      iron,
      vitaminA: vitA,
      vitaminC: vitC,
      vitaminB1: vitB1,
      vitaminB2: vitB2,
      niacin,
      water,
      source: 'FNRI',
    };

    if (existing) {
      // Update record values to match seed updates
      await prisma.foodItem.update({
        where: { id: existing.id },
        data: foodData,
      });
      updatedCount++;
    } else {
      // Create new record
      await prisma.foodItem.create({
        data: foodData,
      });
      insertedCount++;
    }
  }

  console.log(`[Seeder] Seeding completed: ${insertedCount} inserted, ${updatedCount} updated.`);
}

main()
  .catch((e) => {
    console.error('[Seeder] 🛑 Database Seeding FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
