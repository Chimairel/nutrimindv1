'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { 
  CheckCircle, 
  Flame, 
  Check, 
  X, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  Plus, 
  Eye,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Info
} from 'lucide-react';

interface QueueItem {
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

interface DetailData {
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

interface ReviewPayload {
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

export default function ReviewsPage() {
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
        note: rejectNote.trim() 
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
      ingredients: [
        ...prev.ingredients,
        { name: '', category: 'PANTRY', dataSource: 'GEMINI_ESTIMATED' },
      ],
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
      case 'NEEDS_REVIEW': return 'rejected';
      case 'CAUTION': return 'pending';
      default: return 'verified';
    }
  };

  return (
    <div className="m-3 flex h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] overflow-hidden rounded-[30px] border border-brand-border/70 bg-brand-surface/65 text-left shadow-card-lg backdrop-blur-xl md:m-4 md:h-[calc(100%-2rem)] md:w-[calc(100%-2rem)]">
      {/* Master Queue List Panel */}
      <div className="flex h-full w-[38%] min-w-[280px] flex-col space-y-4 overflow-y-auto border-r border-brand-border/70 bg-brand-surface/75 p-5 custom-scrollbar">
        <div className="rounded-[24px] bg-[#07100d] p-5 text-white shadow-card">
          <p className="portal-kicker">Clinical workflow</p>
          <div className="mt-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
            Review queue
            <button 
              onClick={fetchQueue} 
              className="rounded-xl p-2 text-white/45 transition hover:bg-white/[0.06] hover:text-brand-cyan"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </h1>
          <Badge variant="pending" className="text-[9px]">{queue.length} pending</Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-brand-muted animate-pulse text-sm">Loading queue...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 border border-dashed border-brand-border rounded-xl">
            <CheckCircle className="w-8 h-8 text-brand-green" />
            <p className="text-xs text-brand-muted">No pending review cards!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((meal) => {
              const isSelected = selectedMealId === meal.id;
              return (
                <div
                  key={meal.id}
                  aria-disabled={meal.claimStatus.claimedByOther}
                  onClick={() => {
                    if (!meal.claimStatus.claimedByOther) handleSelectMeal(meal.id);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    meal.claimStatus.claimedByOther ? 'cursor-not-allowed opacity-65' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                      : 'border-brand-border/70 bg-brand-surface/55 hover:-translate-y-0.5 hover:border-brand-green/25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-brand-green">{meal.mealType}</span>
                    <Badge variant={flagColor(meal.aiConfidenceFlag)} className="text-[9px]">
                      {meal.aiConfidenceFlag}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-brand-text truncate mb-1">{meal.mealName}</h3>
                  {meal.highRiskReviewRequired && (
                    <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-amber-500">
                      {meal.requiresIndependentSecondReview ? 'Independent second review required' : 'Escalated review'}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-brand-muted">
                    <span>{meal.user.name}</span>
                    <span>{new Date(meal.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  {meal.claimStatus.claimedByOther && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Being reviewed</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details View Panel */}
      <div className="flex h-full flex-1 flex-col overflow-y-auto bg-transparent p-6 custom-scrollbar">
        {selectedMealId === null ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-brand-green/20 bg-brand-green/10">
              <Eye className="w-12 h-12 text-brand-muted" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-brand-text">No Card Selected</h2>
              <p className="text-xs text-brand-muted max-w-sm">
                Select a generated meal plan card from the sidebar queue to display the user clinical profile, ingredient sources, and automatic warnings.
              </p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <span className="text-brand-muted animate-pulse text-sm">Loading details and setting claim lock...</span>
          </div>
        ) : errorMsg && !detailData ? (
          <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-xl space-y-4 max-w-lg mx-auto mt-12 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-brand-text">Access Blocked</h3>
              <p className="text-xs text-brand-muted">{errorMsg}</p>
            </div>
            <Button variant="secondary" onClick={() => setSelectedMealId(null)} className="text-xs px-6">
              Back to Queue
            </Button>
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {/* Header Lock Info Banner */}
            {detailData.claimStatus.claimedByMe && (
              <div className="flex items-center gap-2 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  This review is locked to you for 30 minutes. Reopen the card if the claim expires before submission.
                </span>
              </div>
            )}
            {detailData.highRiskReviewRequired && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {detailData.requiresIndependentSecondReview
                  ? 'This meal has one approval. You are performing the required independent second review.'
                  : 'This profile requires two independent nutritionist approvals before the meal becomes actionable.'}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Split Panel Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Panel: User Profile */}
              <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                <div className="border-b border-brand-border pb-3">
                  <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider">User Health Profile</h2>
                  <h3 className="text-base font-extrabold text-brand-text mt-1">{detailData.user.name}</h3>
                  <p className="text-xs text-brand-muted">
                    {detailData.user.age} yrs • {detailData.user.sex}
                  </p>
                </div>

                {/* Health Conditions */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-brand-muted">⚠️ Conditions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailData.user.conditions.length === 0 ? (
                      <span className="text-xs text-brand-muted italic">None declared</span>
                    ) : (
                      detailData.user.conditions.map((hc, i) => (
                        <span key={i} className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold">
                          {hc}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Allergies */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-brand-muted">🚫 Allergies</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailData.user.allergies.length === 0 ? (
                      <span className="text-xs text-brand-muted italic">None declared</span>
                    ) : (
                      detailData.user.allergies.map((alg, i) => (
                        <span key={i} className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold">
                          {alg}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* General Info Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-brand-border">
                  <div>
                    <span className="block text-[10px] text-brand-muted">Target Goal</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.goal}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Daily Target</span>
                    <strong className="text-brand-text text-xs">{detailData.user.dailyCalorieTarget} kcal</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Diet Preference</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.dietaryPreference}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Carb Preference</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.carbPreference}</strong>
                  </div>
                </div>
              </div>

              {/* Right Panel: Meal Details */}
              <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                <div className="border-b border-brand-border pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider">Meal Details</h2>
                    {isEditing ? (
                      <input 
                        type="text"
                        value={editForm.mealName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, mealName: e.target.value }))}
                        className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-sm font-extrabold w-full mt-2 focus:outline-none focus:border-brand-green"
                      />
                    ) : (
                      <h3 className="text-base font-extrabold text-brand-text mt-1">{detailData.mealPlan.mealName}</h3>
                    )}
                    <p className="text-xs text-brand-muted mt-1 uppercase">
                      {detailData.mealPlan.mealType} • Generated {new Date(detailData.mealPlan.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-brand-muted">Description</h4>
                  {isEditing ? (
                    <textarea 
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-brand-green resize-none"
                    />
                  ) : (
                    <p className="text-xs text-brand-muted leading-relaxed">
                      {detailData.mealPlan.description || 'No description available.'}
                    </p>
                  )}
                </div>

                {/* Nutrition targets */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-brand-muted">Nutrition Data</h4>
                  {isEditing ? (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-brand-muted">Calories</label>
                        <input 
                          type="number"
                          value={editForm.calories}
                          onChange={(e) => setEditForm(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Protein (g)</label>
                        <input 
                          type="number"
                          value={editForm.proteinG}
                          onChange={(e) => setEditForm(prev => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Carbs (g)</label>
                        <input 
                          type="number"
                          value={editForm.carbsG}
                          onChange={(e) => setEditForm(prev => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Fat (g)</label>
                        <input 
                          type="number"
                          value={editForm.fatG}
                          onChange={(e) => setEditForm(prev => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 text-xs text-brand-muted items-center">
                      <span className="flex items-center gap-1 font-bold text-amber-500">
                        <Flame className="w-3.5 h-3.5 fill-current" />
                        <span>{detailData.mealPlan.calories.toFixed(0)} kcal</span>
                      </span>
                      <span>P: <strong>{detailData.mealPlan.proteinG.toFixed(1)}g</strong></span>
                      <span>C: <strong>{detailData.mealPlan.carbsG.toFixed(1)}g</strong></span>
                      <span>F: <strong>{detailData.mealPlan.fatG.toFixed(1)}g</strong></span>
                    </div>
                  )}
                </div>

                {/* Ingredients list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-brand-muted flex justify-between items-center">
                    <span>Ingredients</span>
                    {isEditing && (
                      <button 
                        onClick={addIngredientField}
                        className="text-brand-green hover:underline text-[11px] flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add Ingredient
                      </button>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {isEditing ? (
                      editForm.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text"
                            value={ing.name}
                            onChange={(e) => updateIngredientField(idx, e.target.value)}
                            placeholder="Ingredient name..."
                            className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs flex-grow focus:outline-none focus:border-brand-green"
                          />
                          <Badge variant={ing.dataSource === 'FNRI' ? 'verified' : 'pending'} className="text-[8px] uppercase select-none">
                            {ing.dataSource === 'FNRI' ? 'FNRI' : 'EST'}
                          </Badge>
                          <button 
                            onClick={() => removeIngredientField(idx)}
                            className="p-1 text-red-500 hover:bg-red-950/20 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {detailData.ingredients.map((ing, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-1 px-2.5 py-1 bg-brand-surface border border-brand-border text-xs rounded-lg text-brand-muted"
                          >
                            <span>{ing.name}</span>
                            <span className="text-[9px]" title={ing.source === 'FNRI' ? 'FNRI Database verified' : 'AI Estimated'}>
                              {ing.source === 'FNRI' ? '✅' : '⚠️'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Warnings list */}
            {detailData.warnings.length > 0 && (
              <div className="border border-brand-border rounded-xl p-5 bg-brand-surface/40 space-y-3">
                <h4 className="text-xs font-bold text-brand-muted flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Pre-computed Clinical Warnings
                </h4>
                <div className="space-y-2">
                  {detailData.warnings.map((w, idx) => {
                    let severityStyles = 'border-brand-cyan/20 bg-brand-cyan/10 text-brand-green dark:text-brand-cyan';
                    if (w.severity === 'CRITICAL') {
                      severityStyles = 'text-red-400 bg-red-950/30 border-red-900/30';
                    } else if (w.severity === 'IMPORTANT') {
                      severityStyles = 'text-amber-500 bg-amber-950/20 border-amber-800/20';
                    }
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${severityStyles}`}
                      >
                        {w.severity === 'CRITICAL' && <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
                        {w.severity === 'IMPORTANT' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />}
                        {w.severity === 'NOTICE' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-green dark:text-brand-cyan" />}
                        <span>{w.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Note to Patient form input */}
            <div className="bg-brand-surface/30 border border-brand-border rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                Note to Patient (optional)
              </h4>
              <textarea 
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Include a helpful message, advice, or summary context for the patient. They will see this alongside their approved meal."
                rows={2}
                className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:border-brand-green resize-none leading-relaxed"
              />
            </div>

            {/* Rejection forms section */}
            {showRejectForm && (
              <div className="p-5 border border-red-500/20 bg-red-950/10 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-red-400 flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" /> Reject Meal Plan
                </h4>
                <p className="text-xs text-brand-muted">
                  Rejection triggers an immediate AI replacement query mapped against the patient&apos;s conditions and allergens. Please write a specific rejection reason.
                </p>
                <textarea 
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Rejection reason (required)..."
                  rows={2}
                  className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:border-red-500 resize-none"
                />
                <div className="flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={handleReject} 
                    isLoading={actionLoading === selectedMealId}
                    disabled={!rejectNote.trim()}
                    className="text-xs px-6 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98]"
                  >
                    Confirm Rejection
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => { setShowRejectForm(false); setRejectNote(''); }} 
                    className="text-xs px-6 py-2"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons footer */}
            {!showRejectForm && (
              <div className="flex items-center gap-3 pt-2">
                {isEditing ? (
                  <>
                    <Button 
                      variant="primary" 
                      onClick={handleApprove} 
                      isLoading={actionLoading === selectedMealId}
                      className="text-xs px-8 py-2.5 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" />
                      <span>{detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0 ? 'Save first approval' : 'Save & Approve'}</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setIsEditing(false)} 
                      className="text-xs px-8 py-2.5"
                    >
                      Cancel Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="primary" 
                      onClick={handleApprove} 
                      isLoading={actionLoading === selectedMealId}
                      className="text-xs px-8 py-2.5 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" />
                      <span>{detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0 ? 'Submit first approval' : 'Approve'}</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={startEditing}
                      className="text-xs px-8 py-2.5 flex items-center gap-1.5 border-brand-muted text-brand-muted hover:text-brand-text hover:border-brand-text active:scale-[0.98]"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit & Approve</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowRejectForm(true)} 
                      className="text-xs px-8 py-2.5 flex items-center gap-1.5 text-red-400 border-red-500/20 hover:bg-red-950/20 hover:border-red-500/40 active:scale-[0.98]"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
