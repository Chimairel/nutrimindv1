/**
 * Philippine Planning Geography Region Formatting & Search Utilities.
 * Formats standard PSA region names with official region numbers/acronyms.
 * Example: 'Central Visayas' -> 'Region VII (Central Visayas)'
 */

export const REGION_DESIGNATIONS: Record<string, string> = {
  'National Capital Region': 'NCR (National Capital Region)',
  'Cordillera Administrative Region': 'CAR (Cordillera Administrative Region)',
  'Ilocos Region': 'Region I (Ilocos Region)',
  'Cagayan Valley': 'Region II (Cagayan Valley)',
  'Central Luzon': 'Region III (Central Luzon)',
  'CALABARZON': 'Region IV-A (CALABARZON)',
  'MIMAROPA Region': 'MIMAROPA (Southwestern Tagalog)',
  'Bicol Region': 'Region V (Bicol Region)',
  'Western Visayas': 'Region VI (Western Visayas)',
  'Central Visayas': 'Region VII (Central Visayas)',
  'Eastern Visayas': 'Region VIII (Eastern Visayas)',
  'Zamboanga Peninsula': 'Region IX (Zamboanga Peninsula)',
  'Northern Mindanao': 'Region X (Northern Mindanao)',
  'Davao Region': 'Region XI (Davao Region)',
  'SOCCSKSARGEN': 'Region XII (SOCCSKSARGEN)',
  'Caraga': 'Region XIII (Caraga)',
  'Bangsamoro Autonomous Region in Muslim Mindanao': 'BARMM (Bangsamoro Autonomous Region)',
  'Negros Island Region': 'NIR (Negros Island Region)',
};

// Aliases and numeral equivalents for smart search
const REGION_NUMERAL_MAP: Record<string, string> = {
  '1': 'Region I',
  'i': 'Region I',
  '2': 'Region II',
  'ii': 'Region II',
  '3': 'Region III',
  'iii': 'Region III',
  '4': 'Region IV-A',
  '4a': 'Region IV-A',
  'iv': 'Region IV-A',
  'iva': 'Region IV-A',
  '5': 'Region V',
  'v': 'Region V',
  '6': 'Region VI',
  'vi': 'Region VI',
  '7': 'Region VII',
  'vii': 'Region VII',
  '8': 'Region VIII',
  'viii': 'Region VIII',
  '9': 'Region IX',
  'ix': 'Region IX',
  '10': 'Region X',
  'x': 'Region X',
  '11': 'Region XI',
  'xi': 'Region XI',
  '12': 'Region XII',
  'xii': 'Region XII',
  '13': 'Region XIII',
  'xiii': 'Region XIII',
  'ncr': 'National Capital Region',
  'car': 'Cordillera Administrative Region',
  'barmm': 'Bangsamoro Autonomous Region in Muslim Mindanao',
  'nir': 'Negros Island Region',
  'mimaropa': 'MIMAROPA Region',
  'calabarzon': 'CALABARZON',
  'soccsksargen': 'SOCCSKSARGEN',
};

/**
 * Returns the user-facing display label with the official region number or acronym.
 */
export function formatRegionDisplay(canonicalName: string): string {
  if (!canonicalName) return '';
  const trimmed = canonicalName.trim();
  return REGION_DESIGNATIONS[trimmed] || trimmed;
}

/**
 * Resolves a displayed or typed region name back to the canonical PSA name stored in backend.
 */
export function getCanonicalRegionName(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  for (const [canonical, designated] of Object.entries(REGION_DESIGNATIONS)) {
    if (canonical.toLowerCase() === lower || designated.toLowerCase() === lower) {
      return canonical;
    }
  }

  // Check alias map
  if (REGION_NUMERAL_MAP[lower]) {
    const target = REGION_NUMERAL_MAP[lower];
    for (const [canonical, designated] of Object.entries(REGION_DESIGNATIONS)) {
      if (designated.toLowerCase().includes(target.toLowerCase()) || canonical.toLowerCase() === target.toLowerCase()) {
        return canonical;
      }
    }
  }

  return trimmed;
}

/**
 * Checks if a search query matches the canonical name or official numbered designation.
 */
export function searchMatchesRegion(query: string, canonicalName: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const canonicalLower = canonicalName.toLowerCase();
  const designated = (REGION_DESIGNATIONS[canonicalName] || '').toLowerCase();

  if (canonicalLower.includes(q) || designated.includes(q)) return true;

  // Check numeral alias match (e.g. searching '7' matches 'Region VII (Central Visayas)')
  const alias = REGION_NUMERAL_MAP[q];
  if (alias && designated.toLowerCase().includes(alias.toLowerCase())) {
    return true;
  }

  return false;
}
