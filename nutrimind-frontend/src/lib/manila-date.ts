export const MANILA_TIME_ZONE = 'Asia/Manila';

export function getManilaDateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function formatManilaDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: MANILA_TIME_ZONE,
  }).format(date);
}

export function manilaDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+08:00`);
}
