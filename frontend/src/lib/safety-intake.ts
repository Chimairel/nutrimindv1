import type { SafetyEntryDomain, SafetyProfileEntry } from '@/types';

export interface SafetyInputValue {
  domain: SafetyEntryDomain;
  value: string;
  provenance: 'PREDEFINED' | 'CUSTOM';
}

interface SafetyProfileSource {
  safetyEntries?: SafetyProfileEntry[];
  healthConditions?: string[];
  allergies?: string[];
  userProfile?: { otherConditions?: string; otherAllergies?: string } | null;
}

export function safetyInputsFromProfile(profile: SafetyProfileSource | null): SafetyInputValue[] {
  if (!profile) return [];
  if (profile.safetyEntries?.length) {
    return profile.safetyEntries.map((entry: SafetyProfileEntry) => ({
      domain: entry.domain,
      value: entry.provenance === 'PREDEFINED' && entry.canonicalCode
        ? entry.canonicalCode
        : entry.originalText,
      provenance: entry.provenance === 'PREDEFINED' ? 'PREDEFINED' : 'CUSTOM',
    }));
  }

  const values: SafetyInputValue[] = [];
  for (const condition of profile.healthConditions || []) {
    values.push({ domain: 'CONDITION', value: condition, provenance: 'PREDEFINED' });
  }
  for (const custom of (profile.userProfile?.otherConditions || '').split(',').map((item) => item.trim()).filter(Boolean)) {
    values.push({ domain: 'CONDITION', value: custom, provenance: 'CUSTOM' });
  }
  for (const allergy of profile.allergies || []) {
    values.push({ domain: 'ALLERGY', value: allergy, provenance: 'PREDEFINED' });
  }
  for (const custom of (profile.userProfile?.otherAllergies || '').split(',').map((item) => item.trim()).filter(Boolean)) {
    values.push({ domain: 'ALLERGY', value: custom, provenance: 'CUSTOM' });
  }
  return values;
}
