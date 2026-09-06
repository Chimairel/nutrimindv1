'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import type { BillingAccessView } from '@/types';

export function useBillingAccess() {
  const [data, setData] = useState<BillingAccessView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/billing/access');
      setData(response.data.data as BillingAccessView);
      return response.data.data as BillingAccessView;
    } catch {
      setError('Billing access status is temporarily unavailable.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
