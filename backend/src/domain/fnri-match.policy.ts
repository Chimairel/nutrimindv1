export interface FNRIMatchCandidate {
  name: string;
}

const GENERIC_QUERY_HAZARDS = new Set([
  'blood',
  'brain',
  'cracker',
  'crackers',
  'flavored',
  'flavour',
  'flavouring',
  'flvr',
  'heart',
  'kidney',
  'liver',
  'offal',
  'puff',
  'puffs',
  'skin',
  'snack',
  'tripe',
  'wafer',
  'wafers',
]);

const PREFERRED_DESCRIPTOR_WEIGHTS: Record<string, number> = {
  fresh: 5,
  meat: 20,
  raw: 5,
  whole: 20,
};

export function normalizeFoodName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(value: string): string[] {
  return normalizeFoodName(value).split(' ').filter(Boolean);
}

export function scoreStrongFNRIMatch(query: string, candidateName: string): number | null {
  const normalizedQuery = normalizeFoodName(query);
  const normalizedCandidate = normalizeFoodName(candidateName);
  if (!normalizedQuery || !normalizedCandidate) return null;
  if (normalizedQuery === normalizedCandidate) return 1_000;

  const queryTokens = tokens(query);
  const candidateTokens = tokens(candidateName);
  const candidateTokenSet = new Set(candidateTokens);

  if (!queryTokens.every((token) => candidateTokenSet.has(token))) return null;

  const addedTokens = candidateTokens.filter((token) => !queryTokens.includes(token));
  const hasUnrequestedHazard = addedTokens.some((token) => GENERIC_QUERY_HAZARDS.has(token));
  if (hasUnrequestedHazard) return null;

  // A short generic query must not silently resolve to a highly specific food.
  const maximumAddedTokens = queryTokens.length === 1 ? 3 : 5;
  if (addedTokens.length > maximumAddedTokens) return null;

  const preferredDescriptorScore = addedTokens.reduce(
    (score, token) => score + (PREFERRED_DESCRIPTOR_WEIGHTS[token] || 0),
    0,
  );
  return 500 + (queryTokens.length * 20) + preferredDescriptorScore - (addedTokens.length * 10);
}

export function selectStrongFNRIMatch<T extends FNRIMatchCandidate>(
  query: string,
  candidates: T[],
): T | null {
  return candidates
    .map((candidate) => ({ candidate, score: scoreStrongFNRIMatch(query, candidate.name) }))
    .filter((entry): entry is { candidate: T; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))[0]
    ?.candidate ?? null;
}
