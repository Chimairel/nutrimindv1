import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionResourceCache,
  invalidateSessionResource,
  readSessionResource,
  writeSessionResource,
} from './session-resource-cache';

describe('session resource cache', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    vi.useRealTimers();
  });

  it('returns cached data only to the owning account', () => {
    writeSessionResource('user-a', 'profile', { calories: 2100 });

    expect(readSessionResource('user-a', 'profile')).toEqual({ calories: 2100 });
    expect(readSessionResource('user-b', 'profile')).toBeNull();
  });

  it('expires old data and supports targeted invalidation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'));
    writeSessionResource('user-a', 'meals', ['breakfast']);

    vi.advanceTimersByTime(1_001);
    expect(readSessionResource('user-a', 'meals', 1_000)).toBeNull();

    writeSessionResource('user-a', 'meals', ['lunch']);
    invalidateSessionResource('user-a', 'meals');
    expect(readSessionResource('user-a', 'meals')).toBeNull();
  });
});
