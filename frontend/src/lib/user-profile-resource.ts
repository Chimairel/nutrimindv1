import api, { type ApiRequestConfig } from '@/lib/axios';
import type { UserProfileData } from '@/hooks/useProfile';
import { readSessionResource, refreshSessionResource } from '@/lib/session-resource-cache';
import { profileCheckError } from '@/lib/profile-load-failure';
import { cookieHelper, decodeToken } from '@/lib/auth';

export const userProfileResource = 'user-profile';

export type SessionProfileData = UserProfileData & {
  reportAcknowledged?: boolean;
  image?: string;
  googleImage?: string;
  authMethods?: { password: boolean; google: boolean };
  nutritionReport: (NonNullable<UserProfileData['nutritionReport']> & { profileRevision?: number }) | null;
};

export function cachedUserProfile(ownerId: string | undefined) {
  return readSessionResource<SessionProfileData>(ownerId, userProfileResource);
}

export function refreshUserProfile(ownerId: string | undefined): Promise<SessionProfileData> {
  return refreshSessionResource<SessionProfileData>(ownerId, userProfileResource, async () => {
    const deadline = Date.now() + 60_000;
    const controller = new AbortController();
    let deadlineTimer: ReturnType<typeof setTimeout>;
    const expired = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error('Account check timed out.'), { code: 'ETIMEDOUT', deadlineSeconds: 60 }));
      }, 60_000);
    });
    const read = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const config: ApiRequestConfig = {
            timeout: Math.min(attempt === 0 ? 45_000 : 15_000, deadline - Date.now()),
            signal: controller.signal,
            skipTransientRetry: true,
          };
          const response = await api.get('/user/profile', config);
          if (!response.data?.success || !response.data.data || typeof response.data.data !== 'object') {
            throw profileCheckError('PROFILE_INVALID');
          }
          return response.data.data as SessionProfileData;
        } catch (error) {
          const failure = error as {
            code?: string;
            response?: { status?: number; data?: { errorCode?: string } };
          } | null;
          if (failure?.response?.data?.errorCode === 'DATABASE_QUOTA_EXCEEDED') throw error;
          const transient =
            ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(failure?.code ?? '') ||
            [500, 502, 503, 504].includes(failure?.response?.status ?? 0);
          const sameOwner = () => decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId === ownerId;
          const pauseMs = 1_000 * (attempt + 1);
          if (!transient || attempt >= 3 || !ownerId || !sameOwner() || deadline - Date.now() <= pauseMs) {
            throw error;
          }
          // A dev API restart can fail immediately twice. Give reconnection time
          // to finish; never retry with a different account or authorize from cached claims.
          await new Promise((resolve) => setTimeout(resolve, pauseMs));
          if (!sameOwner() || controller.signal.aborted) throw error;
        }
      }
    };
    try {
      return await Promise.race([read(), expired]);
    } finally {
      clearTimeout(deadlineTimer!);
    }
  });
}

export function getRecentUserProfile(ownerId: string | undefined, maxAgeMs = 30_000): Promise<SessionProfileData> {
  const cached = readSessionResource<SessionProfileData>(ownerId, userProfileResource, maxAgeMs);
  return cached ? Promise.resolve(cached) : refreshUserProfile(ownerId);
}
