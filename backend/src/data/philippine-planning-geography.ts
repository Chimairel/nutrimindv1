/**
 * Coarse Philippine planning geography for user-facing autocomplete.
 * Snapshot: PSA Philippine Standard Geographic Code, 2Q 2026.
 * Source: https://psa.gov.ph/classification/psgc
 * License: CC BY 4.0 (PSA website content unless otherwise stated).
 *
 * This intentionally contains regions, provinces, and highly urbanized cities
 * only. NutriMind does not collect street addresses or pretend that ordinary
 * component cities have province-level food-consumption evidence.
 */
export const PSGC_PLANNING_GEOGRAPHY = {
  sourceLabel: 'Philippine Statistics Authority — PSGC',
  sourceVersion: '2Q 2026',
  sourceUrl: 'https://psa.gov.ph/classification/psgc',
  regions: [
    {
      name: 'National Capital Region',
      provinceHucs: [
        'Caloocan',
        'Las Piñas',
        'Makati',
        'Malabon',
        'Mandaluyong',
        'Manila',
        'Marikina',
        'Muntinlupa',
        'Navotas',
        'Parañaque',
        'Pasay',
        'Pasig',
        'Quezon City',
        'San Juan',
        'Taguig',
        'Valenzuela',
      ],
    },
    {
      name: 'Cordillera Administrative Region',
      provinceHucs: ['Abra', 'Apayao', 'Baguio', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
    },
    { name: 'Ilocos Region', provinceHucs: ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'] },
    { name: 'Cagayan Valley', provinceHucs: ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'] },
    {
      name: 'Central Luzon',
      provinceHucs: [
        'Angeles',
        'Aurora',
        'Bataan',
        'Bulacan',
        'Nueva Ecija',
        'Olongapo',
        'Pampanga',
        'Tarlac',
        'Zambales',
      ],
    },
    { name: 'CALABARZON', provinceHucs: ['Batangas', 'Cavite', 'Laguna', 'Lucena', 'Quezon', 'Rizal'] },
    {
      name: 'MIMAROPA Region',
      provinceHucs: ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Puerto Princesa', 'Romblon'],
    },
    {
      name: 'Bicol Region',
      provinceHucs: ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
    },
    { name: 'Western Visayas', provinceHucs: ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Iloilo City'] },
    { name: 'Negros Island Region', provinceHucs: ['Bacolod', 'Negros Occidental', 'Negros Oriental', 'Siquijor'] },
    { name: 'Central Visayas', provinceHucs: ['Bohol', 'Cebu', 'Cebu City', 'Lapu-Lapu', 'Mandaue'] },
    {
      name: 'Eastern Visayas',
      provinceHucs: ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte', 'Tacloban'],
    },
    {
      name: 'Zamboanga Peninsula',
      provinceHucs: ['Sulu', 'Zamboanga City', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
    },
    {
      name: 'Northern Mindanao',
      provinceHucs: [
        'Bukidnon',
        'Cagayan de Oro',
        'Camiguin',
        'Iligan',
        'Lanao del Norte',
        'Misamis Occidental',
        'Misamis Oriental',
      ],
    },
    {
      name: 'Davao Region',
      provinceHucs: [
        'Davao City',
        'Davao de Oro',
        'Davao del Norte',
        'Davao del Sur',
        'Davao Occidental',
        'Davao Oriental',
      ],
    },
    {
      name: 'SOCCSKSARGEN',
      provinceHucs: ['Cotabato', 'General Santos', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
    },
    {
      name: 'Caraga',
      provinceHucs: [
        'Agusan del Norte',
        'Agusan del Sur',
        'Butuan',
        'Dinagat Islands',
        'Surigao del Norte',
        'Surigao del Sur',
      ],
    },
    {
      name: 'Bangsamoro Autonomous Region in Muslim Mindanao',
      provinceHucs: ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Tawi-Tawi'],
    },
  ],
} as const;

export const PSGC_REGIONS = PSGC_PLANNING_GEOGRAPHY.regions.map((region) => region.name);

export const PSGC_PROVINCE_HUCS = PSGC_PLANNING_GEOGRAPHY.regions.flatMap((region) =>
  region.provinceHucs.map((name) => ({ name, regionName: region.name }))
);

export function isPsgcRegion(value: string): boolean {
  const key = value.trim().toLocaleLowerCase('en-PH');
  return PSGC_REGIONS.some((name) => name.toLocaleLowerCase('en-PH') === key);
}

export function isPsgcProvinceHucForRegion(regionName: string, provinceHucName: string): boolean {
  const regionKey = regionName.trim().toLocaleLowerCase('en-PH');
  const localityKey = provinceHucName.trim().toLocaleLowerCase('en-PH');
  return PSGC_PROVINCE_HUCS.some(
    (item) =>
      item.regionName.toLocaleLowerCase('en-PH') === regionKey && item.name.toLocaleLowerCase('en-PH') === localityKey
  );
}
