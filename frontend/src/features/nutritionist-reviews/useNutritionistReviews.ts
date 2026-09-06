import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '@/lib/axios';

export interface QueueItem {
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidenceFlag: string;
  description?: string;
  scheduledDate: string;
  user: { id: string; name: string };
  ingredients: { ingredientName: string; dataSource: string }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
}

export interface DetailData {
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
    carbPreference: string;
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
    source: 'FNRI' | 'GEMINI_ESTIMATED';
  }[];
  warnings: {
    severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE';
    message: string;
  }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
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
    ingredients: { name: string; category: string; dataSource: 'FNRI' | 'GEMINI_ESTIMATED' }[];
  };
}

const getApiError = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.error || fallback : fallback;

export type ReviewEditForm = {
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; category: string; dataSource: 'FNRI' | 'GEMINI_ESTIMATED' }[];
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

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    mealName: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: { name: string; category: string; dataSource: 'FNRI' | 'GEMINI_ESTIMATED' }[];
  }>({
    mealName: '',
    description: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    ingredients: [],
  });

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/nutritionist/queue');
      if (res.data?.success) {
        setQueue(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
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

    try {
      const res = await api.get(`/nutritionist/queue/${id}`);
      if (res.data?.success) {
        setDetailData(res.data.data);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch card details:', err);
      setErrorMsg(getApiError(err, 'Failed to load meal card details.'));
    } finally {
      setDetailLoading(false);
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
      setErrorMsg(getApiError(err, 'Approval failed. Please refresh the queue.'));
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
      setErrorMsg(getApiError(err, 'Rejection failed. Please refresh the queue.'));
    } finally {
      setActionLoading(null);
    }
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
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleSelectMeal,
    handleApprove,
    handleReject,
    startEditing,
    addIngredientField,
    removeIngredientField,
    updateIngredientField,
    flagColor,
  };
}
