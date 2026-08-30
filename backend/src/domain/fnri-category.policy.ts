export const FNRI_CATEGORY_BY_ID_PREFIX: Readonly<Record<string, string>> = {
  A: 'Cereals & Grains',
  B: 'Starchy Roots & Tubers',
  C: 'Dry Beans, Peas, Nuts & Seeds',
  D: 'Vegetables',
  E: 'Fruits',
  F: 'Meat & Poultry',
  G: 'Fish & Shellfish',
  H: 'Eggs',
  J: 'Milk & Dairy',
  K: 'Fats & Oils',
  M: 'Sugars & Sweets',
  N: 'Miscellaneous',
  P: 'Beverages',
  Q: 'Beverages',
  R: 'Miscellaneous',
  S: 'Miscellaneous',
  T: 'Miscellaneous',
};

export function getFNRICategory(foodId: string): string {
  const prefix = foodId.trim().charAt(0).toUpperCase();
  return FNRI_CATEGORY_BY_ID_PREFIX[prefix] || 'Miscellaneous';
}
