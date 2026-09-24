import type { OutsideMealInputItem } from './model';

export const emptyMacros = { calories: '', proteinG: '', carbsG: '', fatG: '' };

export function displayMacros(macros: { calories: number; proteinG: number; carbsG: number; fatG: number }) {
  return {
    calories: String(Math.round(macros.calories)),
    proteinG: String(Math.round(macros.proteinG * 10) / 10),
    carbsG: String(Math.round(macros.carbsG * 10) / 10),
    fatG: String(Math.round(macros.fatG * 10) / 10),
  };
}

export function parseItems(value: string): OutsideMealInputItem[] {
  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^(.*?)(?:\s*[-(]\s*)(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*\)?$/i);
      return { name: (match?.[1] ?? raw).trim(), ...(match ? { portionGrams: Number(match[2]) } : {}) };
    });
}
