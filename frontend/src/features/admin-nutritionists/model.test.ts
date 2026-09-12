import { describe, expect, it } from 'vitest';
import { toLocalInput } from './model';

describe('application availability date input', () => {
  it.each([undefined, '', 'Monday afternoon', 'not-a-date'])(
    'leaves legacy or missing availability editable: %s',
    (value) => {
      expect(toLocalInput(value)).toBe('');
    }
  );
  it('converts a valid timestamp to a local datetime without losing its time', () => {
    const source = new Date('2026-09-13T08:30:00.000Z');
    const result = toLocalInput(source.toISOString());
    expect(new Date(result).getTime()).toBe(source.getTime());
  });
});
