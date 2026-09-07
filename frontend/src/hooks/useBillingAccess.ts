'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import type { BillingAccessView } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

export function useBillingAccess() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedAccess = readSessionResource<BillingAccessView>(ownerId, 'user-billing-access');
  const [data, setData] = useState<BillingAccessView | null>(cachedAccess);
  const [isLoading, setIsLoading] = useState(!cachedAccess);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/billing/access');
      setData(response.data.data as BillingAccessView);
      writeSessionResource(ownerId, 'user-billing-access', response.data.data as BillingAccessView);
      return response.data.data as BillingAccessView;
    } catch {
      setError('Billing access status is temporarily unavailable.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (ownerId) void refresh();
  }, [ownerId, refresh]);

  return { data, isLoading, error, refresh };
}
