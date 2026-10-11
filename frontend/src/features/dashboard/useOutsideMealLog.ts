import { useMembership } from '@/features/membership/MembershipProvider';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { MealType } from '@/types';
import type { OutsideMealLog, OutsideMealWarning } from './model';
import type { SubmitOptions } from './outside-meal-modal.types';

/** A preview is never a saved log. Retries reuse the same key for the same details. */
export function useOutsideMealLog(onSaved: (log: OutsideMealLog & { id: string }) => void, ownerId?: string) {
  const { refresh: refreshMembership } = useMembership();
  const [isOpen, setIsOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('BREAKFAST');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [warning, setWarning] = useState<OutsideMealWarning | null>(null);
  const inFlight = useRef(false);
  const request = useRef<{ key: string; signature: string } | null>(null);
  const image = useRef<File | null>(null);
  const activeOwner = useRef(ownerId);
  activeOwner.current = ownerId;
  const mounted = useRef(true);
  const activeToast = useRef<string | number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (activeToast.current !== null) toast.dismiss(activeToast.current);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setMealName('');
    setNotes('');
    setWarning(null);
    request.current = null;
    image.current = null;
    if (activeToast.current !== null) toast.dismiss(activeToast.current);
  }, [ownerId]);

  const reset = () => {
    setIsOpen(false);
    setMealName('');
    setNotes('');
    setWarning(null);
    request.current = null;
    image.current = null;
  };
  const onClose = () => {
    if (!inFlight.current) reset();
  };
  const onWarningCancel = () => {
    if (inFlight.current) return;
    setWarning(null);
    request.current = null;
  };

  const onSubmit = async (acknowledge = false, options?: SubmitOptions, requestRndReview = false) => {
    if (inFlight.current) return;
    if (acknowledge && !warning) return;
    const submittedOwner = ownerId;
    inFlight.current = true;
    setIsLoading(true);
    const toastId = toast.loading(acknowledge ? 'Logging your food…' : 'Checking your food…');
    activeToast.current = toastId;
    try {
      const details = {
        items: options?.items,
        mealType,
        useAiEstimate: options?.useAiEstimate,
        notes: notes.trim(),
        estimationContext: options?.estimationContext,
        consumedAt: options?.consumedAt,
      };
      if (!acknowledge) {
        const signature = JSON.stringify(details);
        if (request.current?.signature !== signature) request.current = { key: crypto.randomUUID(), signature };
        image.current = options?.imageFile ?? null;
      }
      const response = await api.post(
        '/user/meals/log-outside',
        acknowledge
          ? {
              mealType,
              warningAcknowledged: true,
              ...(requestRndReview ? { requestRndReview: true } : {}),
              confirmationId: warning!.confirmationId,
              requestKey: request.current?.key,
            }
          : { ...details, requestKey: request.current?.key }
      );
      if (!mounted.current || activeOwner.current !== submittedOwner) {
        toast.dismiss(toastId);
        return;
      }
      const payload = response.data?.data;
      if (!response.data?.success || !payload) throw new Error(response.data?.error || 'Could not log this food.');
      if (payload.warningRequired) {
        setWarning(payload);
        toast.dismiss(toastId);
        return;
      }
      if (!payload.log?.id) throw new Error('The saved food response was incomplete. Retry to check the entry.');
      const photo = image.current;
      onSaved(payload.log);
      if (requestRndReview) refreshMembership();
      reset();
      const followUp = payload.safetyFollowUp as { status: string; messages: string[] } | undefined;
      if (followUp?.status === 'CONFLICT_DETECTED') {
        toast.warning('Food logged — possible conflict', {
          id: toastId,
          description: followUp.messages.join(' '),
          duration: 10000,
        });
      } else {
        toast.success(requestRndReview ? 'Food logged; RND review requested' : 'Food logged', {
          id: toastId,
          description: 'Your intake has been updated. Estimated values remain provisional.',
        });
      }
      // Photo failure must never turn a committed log into a failed submission.
      if (photo) {
        const form = new FormData();
        form.append('image', photo);
        void api.post(`/user/meals/logs/${payload.log.id}/image`, form).catch(() => {
          if (mounted.current && activeOwner.current === submittedOwner)
            toast.warning('Food saved, but the photo could not be attached.');
        });
      }
    } catch (error) {
      if (!mounted.current || activeOwner.current !== submittedOwner) {
        toast.dismiss(toastId);
        return;
      }
      const failure = error as { code?: string; response?: { data?: { code?: string } } };
      const code = failure.response?.data?.code;
      if (code === 'PREVIEW_EXPIRED_OR_USED') {
        setWarning(null);
        request.current = null;
      }
      toast.error(
        !failure.response && ['ECONNABORTED', 'ETIMEDOUT'].includes(failure.code ?? '')
          ? acknowledge
            ? 'The request took too long. Retry to check whether your food was saved.'
            : 'The request took too long. Please try again.'
          : !failure.response && failure.code === 'ERR_NETWORK'
            ? 'We could not connect. Check your internet connection and try again.'
            : error instanceof Error && !failure.response
              ? error.message
              : getApiErrorMessage(
                  error,
                  acknowledge ? 'Could not log your food. Please retry.' : 'Could not check your food. Please retry.'
                ),
        {
          id: toastId,
          ...(code?.startsWith('AI_')
            ? { description: 'Your draft is kept. You can retry or enter nutrition values yourself.' }
            : {}),
        }
      );
    } finally {
      inFlight.current = false;
      activeToast.current = null;
      if (mounted.current) setIsLoading(false);
    }
  };

  return {
    isOpen,
    setIsOpen,
    mealName,
    mealType,
    notes,
    isLoading,
    warning,
    onClose,
    onWarningCancel,
    onSubmit,
    onMealNameChange: setMealName,
    onMealTypeChange: setMealType,
    onNotesChange: setNotes,
  };
}
