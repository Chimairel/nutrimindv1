import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';

export function useMealGenerationProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [isFailed, setIsFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const begin = useCallback((message = 'Preparing your nutrition profile.') => {
    startedAtRef.current = Date.now();
    setProgress(5);
    setElapsedSeconds(0);
    setStageMessage(message);
    setIsFailed(false);
    setErrorMessage(null);
  }, []);

  const complete = useCallback((message = 'Your plan is ready for review.') => {
    setProgress(100);
    setStageMessage(message);
    setIsFailed(false);
    setErrorMessage(null);
  }, []);

  const fail = useCallback((error = 'Plan generation could not be completed.') => {
    setIsFailed(true);
    setErrorMessage(error);
    setStageMessage(error);
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    setProgress(0);
    setElapsedSeconds(0);
    setStageMessage(null);
    setIsFailed(false);
    setErrorMessage(null);
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
          // A prior run can remain marked GENERATING. Its start time, rather
          // than its last update, determines whether it belongs to this run.
          if (startedAtRef.current && job.startedAt) {
            const jobStartedAt = new Date(job.startedAt).getTime();
            if (jobStartedAt < startedAtRef.current - 5000) {
              return;
            }
          } else if (startedAtRef.current && job.updatedAt) {
            const jobUpdatedAt = new Date(job.updatedAt).getTime();
            if (jobUpdatedAt < startedAtRef.current - 5000) return;
          }

          if (job.status === 'FAILED') {
            setIsFailed(true);
            const msg = job.stageMessage || 'Plan generation could not be completed.';
            setErrorMessage(msg);
            setStageMessage(msg);
            setProgress(job.progressPct ?? 0);
          } else if (job.status === 'COMPLETED') {
            setIsFailed(false);
            setErrorMessage(null);
            setProgress(100);
            setStageMessage(job.stageMessage ?? 'Your plan is ready for review.');
          } else {
            setIsFailed(false);
            setErrorMessage(null);
            setProgress(job.progressPct ?? 0);
            setStageMessage(job.stageMessage ?? null);
          }
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

  return {
    progress,
    elapsedSeconds,
    stageMessage,
    isFailed,
    errorMessage,
    begin,
    complete,
    fail,
    reset,
  };
}
