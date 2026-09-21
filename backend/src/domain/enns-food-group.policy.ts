import { PSGC_PROVINCE_HUCS } from '@/data/philippine-planning-geography';

export const ENNS_FOOD_GROUPS = [
  { code: 'RICE_PRODUCTS', sourceVariable: 'epwt_fg2', label: 'Rice and Products' },
  { code: 'CORN_PRODUCTS', sourceVariable: 'epwt_fg3', label: 'Corn and Products' },
  { code: 'OTHER_CEREAL_PRODUCTS', sourceVariable: 'epwt_fg4', label: 'Other Cereal Products' },
  { code: 'STARCHY_ROOTS_TUBERS', sourceVariable: 'epwt_fg5', label: 'Starchy Roots and Tubers' },
  { code: 'SUGAR_SYRUPS', sourceVariable: 'epwt_fg6', label: 'Sugar and Syrups' },
  { code: 'DRIED_BEANS', sourceVariable: 'epwt_fg7', label: 'Dried Beans' },
  { code: 'GREEN_LEAFY_YELLOW_VEGETABLES', sourceVariable: 'epwt_fg9', label: 'Green Leafy and Yellow Vegetables' },
  { code: 'OTHER_VEGETABLES', sourceVariable: 'epwt_fg10', label: 'Other Vegetables' },
  { code: 'VITAMIN_C_RICH_FRUITS', sourceVariable: 'epwt_fg12', label: 'Vitamin C-Rich Fruits' },
  { code: 'OTHER_FRUITS', sourceVariable: 'epwt_fg13', label: 'Other Fruits' },
  { code: 'FISH_PRODUCTS', sourceVariable: 'epwt_fg15', label: 'Fish and Fish Products' },
  { code: 'MEAT_PRODUCTS', sourceVariable: 'epwt_fg16', label: 'Meat and Meat Products' },
  { code: 'POULTRY', sourceVariable: 'epwt_fg17', label: 'Poultry' },
  { code: 'EGGS', sourceVariable: 'epwt_fg18', label: 'Eggs' },
  { code: 'WHOLE_MILK', sourceVariable: 'epwt_fg20', label: 'Whole Milk' },
  { code: 'MILK_PRODUCTS', sourceVariable: 'epwt_fg21', label: 'Milk Products' },
  { code: 'FATS_OILS', sourceVariable: 'epwt_fg23', label: 'Fats and Oils' },
  { code: 'BEVERAGES', sourceVariable: 'epwt_fg25', label: 'Beverages' },
  { code: 'CONDIMENTS_SPICES', sourceVariable: 'epwt_fg26', label: 'Condiments and Spices' },
  { code: 'OTHER_MISCELLANEOUS', sourceVariable: 'epwt_fg27', label: 'Other Miscellaneous' },
] as const;

export type EnnsFoodGroupCode = (typeof ENNS_FOOD_GROUPS)[number]['code'];

const currentProvinceHucByKey = new Map(
  PSGC_PROVINCE_HUCS.map((option) => [normalizePlaceName(option.name), option] as const)
);

const provinceAliases: Record<string, string> = {
  lapulapucityopon: 'Lapu-Lapu',
  westernsamar: 'Samar',
  compostelavalley: 'Davao de Oro',
  northcotabato: 'Cotabato',
  cityofmanila: 'Manila',
  cityofmarikina: 'Marikina',
  cityofpasig: 'Pasig',
  cityofmalabon: 'Malabon',
  cityofnavotas: 'Navotas',
  cityofvalenzuela: 'Valenzuela',
  laspiascity: 'Las Piñas',
  cityofparaaque: 'Parañaque',
  cityofparanaque: 'Parañaque',
  cityofmuntinlupa: 'Muntinlupa',
};

const historicalRegionByCode: Record<string, string> = {
  '1': 'Ilocos Region',
  '2': 'Cagayan Valley',
  '3': 'Central Luzon',
  '5': 'Bicol Region',
  '6': 'Western Visayas',
  '7': 'Central Visayas',
  '8': 'Eastern Visayas',
  '9': 'Zamboanga Peninsula',
  '10': 'Northern Mindanao',
  '11': 'Davao Region',
  '12': 'SOCCSKSARGEN',
  '13': 'National Capital Region',
  '14': 'Cordillera Administrative Region',
  '15': 'Bangsamoro Autonomous Region in Muslim Mindanao',
  '16': 'Caraga',
  '41': 'CALABARZON',
  '42': 'MIMAROPA Region',
};

export function normalizePlaceName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-PH')
    .replace(/[^a-z0-9]/g, '');
}

export function resolveEnnsPlanningGeography(sourceProvinceHucName: string, sourceRegionCode: string) {
  const sourceKey = normalizePlaceName(sourceProvinceHucName);
  const alias = provinceAliases[sourceKey];
  const directKey = normalizePlaceName(alias ?? sourceProvinceHucName.replace(/\b(?:Province|City)\b/gi, ''));
  const current = currentProvinceHucByKey.get(sourceKey) ?? currentProvinceHucByKey.get(directKey);
  if (current) {
    return { provinceHucName: current.name, regionName: current.regionName, isHistoricalProxy: false };
  }

  if (sourceKey === 'cityofisabela') {
    return { provinceHucName: null, regionName: 'Zamboanga Peninsula', isHistoricalProxy: true };
  }
  if (sourceKey === 'maguindanao') {
    return {
      provinceHucName: null,
      regionName: 'Bangsamoro Autonomous Region in Muslim Mindanao',
      isHistoricalProxy: true,
    };
  }
  if (sourceKey === 'pateros') {
    return { provinceHucName: null, regionName: 'National Capital Region', isHistoricalProxy: true };
  }

  const regionName = historicalRegionByCode[sourceRegionCode];
  if (!regionName) throw new Error(`Unknown ENNS region code ${sourceRegionCode}.`);
  return { provinceHucName: null, regionName, isHistoricalProxy: true };
}

function hasAny(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

export function classifyIngredientIntoEnnsFoodGroup(input: {
  name?: string | null;
  category?: string | null;
}): EnnsFoodGroupCode | null {
  const name = input.name?.trim().toLocaleLowerCase('en-PH') ?? '';
  const category = input.category?.trim().toLocaleLowerCase('en-PH') ?? '';
  const combined = `${name} ${category}`;
  if (!combined.trim()) return null;

  if (category.includes('egg') || hasAny(name, /\begg(?:s)?\b|balut|penoy/)) return 'EGGS';
  if (
    category.includes('fish') ||
    hasAny(
      name,
      /fish|tilapia|bangus|tuna|sardine|salmon|galunggong|shrimp|prawn|crab|squid|pusit|clam|mussel|shellfish/
    )
  )
    return 'FISH_PRODUCTS';
  if (hasAny(name, /chicken|poultry|turkey|duck|itik/)) return 'POULTRY';
  if (
    category.includes('meat') ||
    hasAny(name, /pork|beef|carabao|goat|mutton|lamb|ham|bacon|sausage|longgani|hotdog|meat/)
  )
    return 'MEAT_PRODUCTS';
  if (hasAny(name, /\brice\b|palay|malagkit|glutinous rice/)) return 'RICE_PRODUCTS';
  if (hasAny(name, /\bcorn\b|maize/)) return 'CORN_PRODUCTS';
  if (
    category.includes('cereal') ||
    category.includes('grain') ||
    hasAny(name, /bread|flour|oat|noodle|pasta|pandesal|biscuit/)
  )
    return 'OTHER_CEREAL_PRODUCTS';
  if (category.includes('starchy') || hasAny(name, /potato|kamote|cassava|kamoteng kahoy|gabi|taro|ube|yam/))
    return 'STARCHY_ROOTS_TUBERS';
  if (category.includes('sugar') || hasAny(name, /sugar|syrup|honey|molasses/)) return 'SUGAR_SYRUPS';
  if (category.includes('bean') || hasAny(name, /monggo|mung|bean|pea|lentil|chickpea|nut|seed/)) return 'DRIED_BEANS';
  if (category.includes('vegetable')) {
    return hasAny(
      name,
      /malunggay|moringa|pechay|kangkong|spinach|lettuce|mustasa|saluyot|camote tops|squash|kalabasa|carrot/
    )
      ? 'GREEN_LEAFY_YELLOW_VEGETABLES'
      : 'OTHER_VEGETABLES';
  }
  if (category.includes('fruit')) {
    return hasAny(name, /calamansi|calamondin|orange|lemon|lime|pomelo|guava|papaya|mango|pineapple|strawberr|kiwi/)
      ? 'VITAMIN_C_RICH_FRUITS'
      : 'OTHER_FRUITS';
  }
  if (category.includes('milk') || category.includes('dairy') || hasAny(name, /milk|cheese|yogurt|cream/)) {
    return hasAny(name, /whole milk|fresh milk|cow'?s milk|carabao milk|goat milk/) &&
      !hasAny(name, /powder|cheese|yogurt|cream/)
      ? 'WHOLE_MILK'
      : 'MILK_PRODUCTS';
  }
  if (
    category.includes('fat') ||
    category.includes('oil') ||
    hasAny(name, /cooking oil|coconut oil|butter|margarine|lard/)
  )
    return 'FATS_OILS';
  if (category.includes('beverage') || hasAny(name, /coffee|tea|juice|soft drink|soda|beverage/)) return 'BEVERAGES';
  if (hasAny(name, /salt|pepper|soy sauce|vinegar|patis|fish sauce|bagoong|spice|seasoning|condiment/))
    return 'CONDIMENTS_SPICES';
  if (category.includes('misc')) return 'OTHER_MISCELLANEOUS';
  return null;
}

export function calculateFoodGroupFamiliarityScore(input: {
  rank?: number | null;
  percentConsuming?: number | null;
  relativeToNational?: number | null;
}): number {
  const prevalence = Math.min(1, Math.max(0, (input.percentConsuming ?? 0) / 100));
  const rankSignal = input.rank && input.rank > 0 ? 1 / Math.sqrt(input.rank) : 0;
  const localityLift = Math.min(2, Math.max(0.5, input.relativeToNational ?? 1));
  return (prevalence * 0.7 + rankSignal * 0.3) * localityLift;
}
