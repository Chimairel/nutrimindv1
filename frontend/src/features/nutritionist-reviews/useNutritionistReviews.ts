import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { IngredientEvidenceSource } from './ingredient-evidence';

export interface QueueItem {
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidenceFlag: string;
  requiresSafetyRevalidation?: boolean;
  description?: string;
  scheduledDate: string;
  user: { id: string; name: string };
  ingredients: { ingredientName: string; dataSource: string }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    coolingDownForMe?: boolean;
    cooldownUntil?: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
  intendedCycle: { id: string; startDate: string; endDate: string; status: string };
  shoppingDeadlineAt: string;
  cookDeadlineAt: string;
  assuranceTier: 'BASE' | 'STANDARD' | 'ENHANCED';
  reviewStage: 'PRIMARY' | 'SECONDARY';
  remainingReviewers: number;
  deterministicFindings: { confidence: string; estimatedIngredientCount: number };
  sourceProvenance: 'CERTIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_FROM_SCRATCH';
  fallbackAvailable: boolean;
  rankingReasonCodes: string[];
  deadlinePriorityReason: string;
  coalescedDependentCount: number;
}

export interface DetailData {
  clinicalEvidence?: {
    policyVersion: string;
    requirements: Array<{ area: string; state: string; message: string }>;
    documents: Array<{
      id: string;
      area: string;
      documentType: string;
      validUntil: string | null;
      facts: Array<{ code: string; valueText: string | null; valueNumber: number | null; unit: string | null }>;
    }>;
  };
  mealPlan: {
    id: string;
    planGroupId: string;
    userId: string;
    status: string;
    mealType: string;
    mealName: string;
    description?: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    aiConfidenceFlag: string;
    requiresSafetyRevalidation?: boolean;
    planType: string;
    scheduledDate: string;
    createdAt: string;
  };
  user: {
    name: string;
    age: number;
    sex: string;
    goal: string;
    dailyCalorieTarget: number;
    dietaryPreference: string;
    ricePreference: string;
    conditions: string[];
    allergies: string[];
    safetyEntries?: Array<{
      domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT' | 'UNKNOWN';
      label: string;
      supportState: string;
    }>;
  };
  ingredients: {
    name: string;
    source: IngredientEvidenceSource;
    foodItemId?: string | null;
    compositionFoodName?: string | null;
    compositionSource?: string | null;
    compositionSourceUrl?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
  warnings: {
    severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE';
    message: string;
  }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
}

export interface ReviewPayload {
  action: 'approve';
  note?: string;
  updates?: {
    mealName: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
  };
}

export interface CandidateMeal {
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; category?: string; dataSource?: 'FNRI' | 'GEMINI_ESTIMATED' }[];
}

export type ReviewEditForm = {
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
};

export function useNutritionistReviews() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Card Details
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);

  // Actions states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [generalNote, setGeneralNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-Flight Candidate Replacement State
  const [candidateMeal, setCandidateMeal] = useState<CandidateMeal | null>(null);
  const [isGeneratingCandidate, setIsGeneratingCandidate] = useState(false);
  const [isEditingCandidate, setIsEditingCandidate] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    mealName: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
  }>({
    mealName: '',
    description: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    ingredients: [],
  });

  const fetchQueue = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.get('/nutritionist/queue');
      if (res.data?.success) {
        setQueue(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchQueue(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSelectMeal = async (id: string) => {
    setSelectedMealId(id);
    setDetailLoading(true);
    setDetailData(null);
    setErrorMsg(null);
    setIsEditing(false);
    setShowRejectForm(false);
    setRejectNote('');
    setGeneralNote('');
    setCandidateMeal(null);
    setIsEditingCandidate(false);

    try {
      const res = await api.get(`/nutritionist/queue/${id}`);
      if (res.data?.success) {
        setDetailData(res.data.data);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch card details:', err);
      setErrorMsg(getApiErrorMessage(err, 'Failed to load meal card details.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClaimMeal = async () => {
    if (!selectedMealId) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);
    try {
      const res = await api.post(`/nutritionist/queue/${selectedMealId}/claim`);
      if (res.data?.success) setDetailData(res.data.data);
      await fetchQueue();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Could not claim this meal. Refresh the queue and try again.'));
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseMeal = async () => {
    if (!selectedMealId) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);
    try {
      await api.post(`/nutritionist/queue/${selectedMealId}/release`);
      setDetailData(null);
      setSelectedMealId(null);
      setIsEditing(false);
      setShowRejectForm(false);
      setCandidateMeal(null);
      await fetchQueue();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Could not release this meal. Refresh the queue and try again.'));
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedMealId) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    try {
      const payload: ReviewPayload = {
        action: 'approve',
        note: generalNote.trim() || undefined,
      };

      if (isEditing) {
        payload.updates = {
          mealName: editForm.mealName,
          description: editForm.description,
          calories: editForm.calories,
          proteinG: editForm.proteinG,
          carbsG: editForm.carbsG,
          fatG: editForm.fatG,
          ingredients: editForm.ingredients,
        };
      }

      await api.patch(`/nutritionist/review/${selectedMealId}`, payload);
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setIsEditing(false);
    } catch (err: unknown) {
      console.error('Approve failed:', err);
      setErrorMsg(getApiErrorMessage(err, 'Approval failed. Please refresh the queue.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedMealId || !rejectNote.trim()) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    try {
      await api.patch(`/nutritionist/review/${selectedMealId}`, {
        action: 'reject',
        note: rejectNote.trim(),
      });
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setShowRejectForm(false);
      setRejectNote('');
    } catch (err: unknown) {
      console.error('Reject failed:', err);
      setErrorMsg(getApiErrorMessage(err, 'Rejection failed. Please refresh the queue.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateCandidate = async () => {
    if (!selectedMealId || !rejectNote.trim() || isGeneratingCandidate) return;
    setIsGeneratingCandidate(true);
    setErrorMsg(null);

    try {
      const res = await api.post(`/nutritionist/review/${selectedMealId}/regenerate-candidate`, {
        reason: rejectNote.trim(),
      });
      if (res.data?.data) {
        setCandidateMeal(res.data.data);
      }
    } catch (err: unknown) {
      console.error('Generate candidate failed:', err);
      setErrorMsg(
        getApiErrorMessage(err, 'Failed to generate replacement candidate. Please check the rejection reason.')
      );
    } finally {
      setIsGeneratingCandidate(false);
    }
  };

  const handleReplaceAndApprove = async () => {
    if (!selectedMealId || !candidateMeal || !rejectNote.trim()) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    try {
      await api.post(`/nutritionist/review/${selectedMealId}/replace-and-approve`, {
        reason: rejectNote.trim(),
        note: generalNote.trim() || undefined,
        candidate: candidateMeal,
      });
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setShowRejectForm(false);
      setRejectNote('');
      setCandidateMeal(null);
      setIsEditingCandidate(false);
    } catch (err: unknown) {
      console.error('Replace and approve failed:', err);
      setErrorMsg(getApiErrorMessage(err, 'Failed to certify replacement meal. Please refresh the queue.'));
    } finally {
      setActionLoading(null);
    }
  };

  const updateCandidateField = <K extends keyof CandidateMeal>(field: K, value: CandidateMeal[K]) => {
    setCandidateMeal((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const addCandidateIngredient = () => {
    setCandidateMeal((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [...prev.ingredients, { name: '', category: 'PANTRY', dataSource: 'GEMINI_ESTIMATED' }],
          }
        : prev
    );
  };

  const removeCandidateIngredient = (index: number) => {
    setCandidateMeal((prev) =>
      prev
        ? {
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index),
          }
        : prev
    );
  };

  const updateCandidateIngredient = (index: number, name: string) => {
    setCandidateMeal((prev) => {
      if (!prev) return prev;
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], name };
      return { ...prev, ingredients: updated };
    });
  };

  const resetCandidate = () => {
    setCandidateMeal(null);
    setIsEditingCandidate(false);
  };

  const startEditing = () => {
    if (!detailData) return;
    setEditForm({
      mealName: detailData.mealPlan.mealName,
      description: detailData.mealPlan.description || '',
      calories: detailData.mealPlan.calories,
      proteinG: detailData.mealPlan.proteinG,
      carbsG: detailData.mealPlan.carbsG,
      fatG: detailData.mealPlan.fatG,
      ingredients: detailData.ingredients.map((ing) => ({
        name: ing.name,
        category: 'PANTRY',
        dataSource: ing.source,
      })),
    });
    setIsEditing(true);
  };

  const addIngredientField = () => {
    setEditForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', category: 'PANTRY', dataSource: 'GEMINI_ESTIMATED' }],
    }));
  };

  const removeIngredientField = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredientField = (index: number, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], name: value };
      return { ...prev, ingredients: updated };
    });
  };

  const flagColor = (flag: string): 'rejected' | 'pending' | 'verified' => {
    switch (flag) {
      case 'NEEDS_REVIEW':
        return 'rejected';
      case 'CAUTION':
        return 'pending';
      default:
        return 'verified';
    }
  };
  return {
    queue,
    fetchQueue,
    isLoading,
    selectedMealId,
    setSelectedMealId,
    detailLoading,
    detailData,
    actionLoading,
    rejectNote,
    setRejectNote,
    showRejectForm,
    setShowRejectForm,
    generalNote,
    setGeneralNote,
    errorMsg,
    candidateMeal,
    setCandidateMeal,
    isGeneratingCandidate,
    isEditingCandidate,
    setIsEditingCandidate,
    handleGenerateCandidate,
    handleReplaceAndApprove,
    updateCandidateField,
    addCandidateIngredient,
    removeCandidateIngredient,
    updateCandidateIngredient,
    resetCandidate,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleSelectMeal,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
    handleReject,
    startEditing,
    addIngredientField,
    removeIngredientField,
    updateIngredientField,
    flagColor,
  };
}
