import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';

export function useMealGenerationProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const begin = useCallback((message = 'Preparing your nutrition profile.') => {
    startedAtRef.current = Date.now();
    setProgress(5);
    setElapsedSeconds(0);
    setStageMessage(message);
  }, []);

  const complete = useCallback((message = 'Your plan is ready for review.') => {
    setProgress(100);
    setStageMessage(message);
  }, []);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      return;
    }
    if (startedAtRef.current === null) startedAtRef.current = Date.now();

    let pollInFlight = false;
    let mounted = true;
    const updateServerProgress = async () => {
      const startedAt = startedAtRef.current ?? Date.now();
      if (mounted) setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      if (pollInFlight) return;

      pollInFlight = true;
      try {
        const response = await api.get('/user/meals/generation-status');
        const job = response.data?.data;
        if (mounted && job) {
          setProgress(job.progressPct ?? 0);
          setStageMessage(job.stageMessage ?? null);
        }
      } catch {
        // The generation request remains authoritative. A transient progress
        // poll failure must not cancel it or invent a completion percentage.
      } finally {
        pollInFlight = false;
      }
    };

    void updateServerProgress();
    const interval = window.setInterval(() => void updateServerProgress(), 1_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [active]);

  return { progress, elapsedSeconds, stageMessage, begin, complete };
}
