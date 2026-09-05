'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Utensils, Stethoscope, ShieldAlert, Flag, Salad } from 'lucide-react';
import { normalizeExclusiveNone } from '@/lib/profile-normalization';


interface Flag {
  id: string;
  reason: string;
  createdAt: string;
  flaggedByNutritionist: {
    user: {
      name: string;
    };
  };
}

interface Verifier {
  id: string;
  userId: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  user: {
    name: string;
  };
}

interface LibraryMeal {
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  description?: string;
  suitableConditions?: string[];
  allergenFree?: string[];
  dietaryTags?: string[];
  usageCount: number;
  status: 'APPROVED' | 'FLAGGED' | 'ARCHIVED';
  safetyEvidenceStatus: 'INCOMPLETE' | 'COMPLETE' | 'STALE';
  safetyEvidenceRevision: number;
  certifiedEvidenceRevision?: number | null;
  safetyPolicyVersion?: string | null;
  conditionDeclarationState: 'NOT_REVIEWED' | 'REVIEWED_NONE_DECLARED' | 'REVIEWED_WITH_DECLARATIONS';
  allergenDeclarationState: 'NOT_REVIEWED' | 'REVIEWED_NONE_DECLARED' | 'REVIEWED_WITH_DECLARATIONS';
  crossContactAssessment: 'NOT_ASSESSED' | 'ASSESSED_NO_KNOWN_RISK' | 'RISK_IDENTIFIED';
  safetyInvalidationReason?: string | null;
  safetyReviewedAt?: string | null;
  addedAt: string;
  verifiedByNutritionistId: string;
  verifiedByNutritionist?: Verifier;
  flags?: Flag[];
  ingredients?: {
    id: string;
    ingredientName: string;
    category?: string | null;
    foodItemId?: string | null;
    dataSource: 'FNRI' | 'GEMINI_ESTIMATED';
    position: number;
  }[];
  safetyReviewedByNutritionist?: { user: { name: string } } | null;
}

interface LibraryCoverage {
  certifiedMeals: number;
  requiredPerSlot: number;
  profiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    total: number;
    minimumPerSlot: number;
    weekReady: boolean;
  }>;
  combinationColumns: Array<{ key: string; label: string }>;
  combinationMatrix: Array<{
    key: string;
    label: string;
    cells: Array<{
      key: string;
      label: string;
      counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
      total: number;
      minimumPerSlot: number;
      weekReady: boolean;
    }>;
  }>;
  structuredProfiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    total: number;
    minimumPerSlot: number;
    weekReady: boolean;
  }>;
}

const AVAILABLE_CONDITIONS = [
  { label: 'Diabetes reviewed', value: 'DIABETES' },
  { label: 'Hypertension reviewed', value: 'HYPERTENSION' },
  { label: 'Kidney disease reviewed', value: 'KIDNEY_DISEASE' },
  { label: 'Heart condition reviewed', value: 'HEART_CONDITION' },
  { label: 'Pregnancy reviewed', value: 'PREGNANT' },
];

const AVAILABLE_ALLERGENS = [
  { label: 'Shellfish', value: 'SHELLFISH' },
  { label: 'Nuts', value: 'NUTS' },
  { label: 'Dairy', value: 'DAIRY' },
  { label: 'Gluten', value: 'GLUTEN' },
  { label: 'Eggs', value: 'EGGS' },
];

const AVAILABLE_DIETS = [
  { label: 'Omnivore', value: 'OMNIVORE' },
  { label: 'Vegetarian', value: 'VEGETARIAN' },
  { label: 'Vegan', value: 'VEGAN' },
  { label: 'Pescatarian', value: 'PESCATARIAN' },
  { label: 'Lose Weight', value: 'LOSE_WEIGHT' },
  { label: 'Gain Weight', value: 'GAIN_WEIGHT' },
  { label: 'Maintain Weight', value: 'MAINTAIN' },
  { label: 'Build Muscle', value: 'BUILD_MUSCLE' },
];

export default function MealLibraryPage() {
  const { user: currentUser } = useAuth();
  const [meals, setMeals] = useState<LibraryMeal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<LibraryCoverage | null>(null);

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('All');
  const [conditionTag, setConditionTag] = useState('All');
  const [status, setStatus] = useState('All');
  const [verifiedByMe, setVerifiedByMe] = useState(false);

  // Modal / Action States
  const [activeModal, setActiveModal] = useState<'view' | 'edit' | 'delete' | 'flag' | 'resolve' | 'verifier' | 'certify' | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<LibraryMeal | null>(null);
  const [selectedVerifier, setSelectedVerifier] = useState<Verifier | null>(null);
  
  // Form input states
  const [editForm, setEditForm] = useState({
    mealName: '',
    description: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    suitableConditions: [] as string[],
    allergenFree: [] as string[],
    dietaryTags: [] as string[],
  });
  const [flagReason, setFlagReason] = useState('');
  const [evidenceForm, setEvidenceForm] = useState({
    suitableConditions: [] as string[],
    allergensPresent: [] as string[],
    allergensReviewedAbsent: [] as string[],
    crossContactAcknowledged: false,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchVal]);

  const fetchLibrary = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await api.get('/nutritionist/library', {
        params: {
          search,
          mealType: mealType === 'All' ? undefined : mealType,
          conditionTag: conditionTag === 'All' ? undefined : conditionTag,
          status: status === 'All' ? undefined : status,
          verifiedByMe: verifiedByMe ? 'true' : undefined,
          page,
          limit: 20,
        },
      });
      if (res.data?.success) {
        setMeals(res.data.data.meals);
        setTotalCount(res.data.data.total);
        setTotalPages(Math.ceil(res.data.data.total / res.data.data.limit));
      }
    } catch (err) {
      console.error('Failed to fetch library:', err);
      setFetchError('The verified meal library could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCoverage = React.useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/library-coverage');
      if (response.data?.success) setCoverage(response.data.data);
    } catch {
      setCoverage(null);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mealType, conditionTag, status, verifiedByMe, page]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Check if current user is owner or admin (for override checks)
  const isOwner = (meal: LibraryMeal) => {
    if (!currentUser) return false;
    return meal.verifiedByNutritionist?.userId === currentUser.userId || currentUser.role === 'ADMIN';
  };

  // Open Edit Modal & Populate Form
  const handleOpenEdit = (meal: LibraryMeal) => {
    setSelectedMeal(meal);
    setEditForm({
      mealName: meal.mealName,
      description: meal.description || '',
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      suitableConditions: normalizeExclusiveNone(meal.suitableConditions),
      allergenFree: normalizeExclusiveNone(meal.allergenFree),
      dietaryTags: (meal.dietaryTags || []) as string[],
    });
    setActionError(null);
    setActiveModal('edit');
  };

  const handleOpenCertification = (meal: LibraryMeal) => {
    setSelectedMeal(meal);
    setEvidenceForm({
      suitableConditions: normalizeExclusiveNone(meal.suitableConditions),
      allergensPresent: [],
      allergensReviewedAbsent: normalizeExclusiveNone(meal.allergenFree),
      crossContactAcknowledged: meal.crossContactAssessment === 'ASSESSED_NO_KNOWN_RISK',
    });
    setActionError(null);
    setActiveModal('certify');
  };

  const handleCertificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal || !evidenceForm.crossContactAcknowledged) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const allergenCount = evidenceForm.allergensPresent.length + evidenceForm.allergensReviewedAbsent.length;
      const res = await api.post(`/nutritionist/library/${selectedMeal.id}/safety-evidence/certify`, {
        expectedRevision: selectedMeal.safetyEvidenceRevision,
        conditionDeclarationState: evidenceForm.suitableConditions.length > 0
          ? 'REVIEWED_WITH_DECLARATIONS'
          : 'REVIEWED_NONE_DECLARED',
        allergenDeclarationState: allergenCount > 0
          ? 'REVIEWED_WITH_DECLARATIONS'
          : 'REVIEWED_NONE_DECLARED',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        suitableConditions: evidenceForm.suitableConditions,
        allergensPresent: evidenceForm.allergensPresent,
        allergensReviewedAbsent: evidenceForm.allergensReviewedAbsent,
      });
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setActionError(error.response?.data?.error || 'Failed to certify the current evidence revision.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit Mutation
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.patch(`/nutritionist/library/${selectedMeal.id}`, {
        mealName: editForm.mealName,
        description: editForm.description,
        calories: editForm.calories,
        proteinG: editForm.proteinG,
        carbsG: editForm.carbsG,
        fatG: editForm.fatG,
        dietaryTags: editForm.dietaryTags,
      });
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setActionError(error.response?.data?.error || 'Failed to update library meal.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Delete Mutation
  const handleDeleteSubmit = async () => {
    if (!selectedMeal) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.delete(`/nutritionist/library/${selectedMeal.id}`);
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setActionError(error.response?.data?.error || 'Failed to delete library meal.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Flag Mutation
  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal || !flagReason.trim()) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.post(`/nutritionist/library/${selectedMeal.id}/flag`, { reason: flagReason });
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
        setFlagReason('');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setActionError(error.response?.data?.error || 'Failed to submit flag.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Resolve Flag Mutation
  const handleResolveFlag = async (resolution: 'edit' | 'delete' | 'dismiss') => {
    if (!selectedMeal) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const payload = {
        resolution,
        updatedFields: resolution === 'edit' ? {
          mealName: editForm.mealName,
          description: editForm.description,
          calories: editForm.calories,
          proteinG: editForm.proteinG,
          carbsG: editForm.carbsG,
          fatG: editForm.fatG,
          dietaryTags: editForm.dietaryTags,
        } : undefined,
      };
      const res = await api.patch(`/nutritionist/library/${selectedMeal.id}/resolve-flag`, payload);
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setActionError(error.response?.data?.error || 'Failed to resolve flag.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper toggle arrays
  const handleToggleDiet = (val: string) => {
    setEditForm(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(val)
        ? prev.dietaryTags.filter(d => d !== val)
        : [...prev.dietaryTags, val]
    }));
  };

  const toggleEvidenceCondition = (value: string) => {
    setEvidenceForm((current) => ({
      ...current,
      suitableConditions: current.suitableConditions.includes(value)
        ? current.suitableConditions.filter((item) => item !== value)
        : [...current.suitableConditions, value],
    }));
  };

  const setEvidenceAllergen = (value: string, mode: 'present' | 'absent' | 'clear') => {
    setEvidenceForm((current) => ({
      ...current,
      allergensPresent: mode === 'present'
        ? [...current.allergensPresent.filter((item) => item !== value), value]
        : current.allergensPresent.filter((item) => item !== value),
      allergensReviewedAbsent: mode === 'absent'
        ? [...current.allergensReviewedAbsent.filter((item) => item !== value), value]
        : current.allergensReviewedAbsent.filter((item) => item !== value),
    }));
  };

  return (
    <div className="portal-page space-y-6">
      
      {/* Header */}
      <PortalPageHeader icon={BookOpen} eyebrow="Meal intelligence" title="Verified meal library" description="Search, inspect, and maintain the reusable meal evidence available to compatible user plans." meta={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/50">{totalCount} records</span>} />

      {coverage && (
        <section aria-labelledby="coverage-heading" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">Coverage monitor</p>
              <h2 id="coverage-heading" className="font-display text-lg font-black text-brand-text">Seven-day library readiness</h2>
            </div>
            <p className="text-xs text-brand-muted">{coverage.certifiedMeals} current certified meals · {coverage.requiredPerSlot} required per slot</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {coverage.profiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-brand-text">{profile.label}</p>
                    <p className="mt-1 text-[10px] text-brand-muted">Lowest slot: {profile.minimumPerSlot}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Week ready' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden border-brand-border/60 bg-brand-surface/65 p-0">
            <div className="border-b border-brand-border/60 px-4 py-3">
              <h3 className="text-sm font-extrabold text-brand-text">Combined restriction matrix</h3>
              <p className="mt-1 text-[11px] text-brand-muted">Each cell shows the lowest available main-meal slot. Hover or focus a cell for breakfast, lunch, and dinner counts.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-brand-bg/45">
                    <th scope="col" className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-bg px-4 py-3 font-mono text-[9px] uppercase tracking-wider text-brand-muted">Condition</th>
                    {coverage.combinationColumns.map((column) => (
                      <th key={column.key} scope="col" className="px-3 py-3 text-center text-[10px] font-extrabold text-brand-muted">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.combinationMatrix.map((row) => (
                    <tr key={row.key} className="border-t border-brand-border/50">
                      <th scope="row" className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-surface px-4 py-3 text-xs font-extrabold text-brand-text">{row.label}</th>
                      {row.cells.map((cell) => {
                        const detail = `Breakfast ${cell.counts.BREAKFAST}, lunch ${cell.counts.LUNCH}, dinner ${cell.counts.DINNER}`;
                        return (
                          <td key={cell.key} className="px-2 py-2 text-center">
                            <span
                              tabIndex={0}
                              title={detail}
                              aria-label={`${row.label} and ${cell.label}: ${cell.minimumPerSlot} lowest-slot meals. ${detail}. ${cell.weekReady ? 'Week ready' : 'Coverage gap'}.`}
                              className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-xl border px-2 py-2 font-mono text-[10px] font-black outline-none transition focus:ring-2 focus:ring-brand-cyan/40 ${cell.weekReady ? 'border-brand-green/35 bg-brand-green/10 text-brand-green' : 'border-status-warning-text/35 bg-status-warning-bg/15 text-status-warning-text'}`}
                            >
                              {cell.minimumPerSlot}
                              <span aria-hidden="true">/7</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-3" aria-label="Structured combined profile coverage">
            {coverage.structuredProfiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-cyan">Structured profile</p>
                    <p className="mt-1 text-sm font-extrabold text-brand-text">{profile.label}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Week ready' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Top Filter Panel */}
      <Card className="portal-filter-panel space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search bar */}
          <div className="md:col-span-2">
            <label htmlFor="library-search" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Search meal name</label>
            <div className="relative">
              <input
                id="library-search"
                name="search"
                type="text"
                placeholder="Search e.g. Tinola..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10 placeholder:text-brand-muted/60"
              />
              {searchVal && (
                <button
                  type="button"
                  aria-label="Clear meal search"
                  onClick={() => setSearchVal('')} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Meal Type */}
          <div>
            <label htmlFor="library-meal-type" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Meal Type</label>
            <select
              id="library-meal-type"
              value={mealType}
              onChange={(e) => { setMealType(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Types</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACK">Snack</option>
            </select>
          </div>

          {/* Condition Tag */}
          <div>
            <label htmlFor="library-condition" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Condition Tag</label>
            <select
              id="library-condition"
              value={conditionTag}
              onChange={(e) => { setConditionTag(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Conditions</option>
              {AVAILABLE_CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-brand-border/40">
          
          <div className="flex gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="library-status" className="text-xs font-bold text-brand-muted uppercase">Status:</label>
              <select
                id="library-status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text focus:outline-none focus:border-brand-green/80"
              >
                <option value="All">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="FLAGGED">Flagged</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Owner filter */}
          <label htmlFor="library-verified-by-me" className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              id="library-verified-by-me"
              type="checkbox"
              checked={verifiedByMe}
              onChange={(e) => { setVerifiedByMe(e.target.checked); setPage(1); }}
              className="w-4.5 h-4.5 rounded border-brand-border text-brand-green focus:ring-brand-green bg-brand-bg"
            />
            <span className="text-xs font-bold text-brand-text">Show only meals verified by me</span>
          </label>
          
        </div>
      </Card>

      {fetchError && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Main Meal Grid / Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <div className="w-8 h-8 border-2 border-brand-green/20 border-t-brand-green rounded-full animate-spin"></div>
          <span className="text-sm text-brand-muted">Fetching verified library meals...</span>
        </div>
      ) : meals.length === 0 ? (
        <Card className="p-16 text-center border-brand-border/40 bg-brand-surface/30 flex flex-col items-center">
          <Utensils className="w-12 h-12 text-brand-muted mb-4" />
          <h3 className="text-lg font-bold text-brand-text font-display">No Meals Found</h3>
          <p className="text-sm text-brand-muted mt-1 max-w-md mx-auto">
            Try adjusting your search query, selecting different filters, or checking back later.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meals.map((meal) => {
              const owned = isOwner(meal);
              const isFlagged = meal.status === 'FLAGGED';
              const isArchived = meal.status === 'ARCHIVED';
              const activeFlag = meal.flags?.[0];

              return (
                <Card 
                  key={meal.id} 
                  className={`relative p-5 border-brand-border/60 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-brand-border-hover hover:shadow-lg ${
                    isFlagged ? 'border-amber-900/60 bg-amber-950/5' : ''
                  }`}
                >
                  <div>
                    {/* Top tags & status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2.5 py-1 rounded-md tracking-wider uppercase font-display">
                        {meal.mealType}
                      </span>
                      <div className="flex gap-1.5">
                        {isFlagged ? (
                          <Badge variant="pending" showIcon>Flagged</Badge>
                        ) : isArchived ? (
                          <Badge variant="pending" showIcon>Archived</Badge>
                        ) : (
                          <Badge variant="verified" showIcon>Approved</Badge>
                        )}
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                          meal.safetyEvidenceStatus === 'COMPLETE'
                            ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                            : meal.safetyEvidenceStatus === 'STALE'
                              ? 'border-amber-700/50 bg-amber-950/20 text-amber-300'
                              : 'border-brand-border/60 bg-brand-bg/60 text-brand-muted'
                        }`}>
                          {meal.safetyEvidenceStatus === 'COMPLETE'
                            ? 'Evidence certified'
                            : meal.safetyEvidenceStatus === 'STALE'
                              ? 'Evidence stale'
                              : 'Evidence incomplete'}
                        </span>
                      </div>
                    </div>

                    {/* Meal details */}
                    <h3 className="text-base font-bold text-brand-text leading-snug">{meal.mealName}</h3>
                    {meal.description && (
                      <p className="text-xs text-brand-muted line-clamp-2 mt-1.5 leading-relaxed">
                        {meal.description}
                      </p>
                    )}

                    {/* Macros grid */}
                    <div className="grid grid-cols-4 gap-2 my-4 p-2.5 bg-brand-bg/60 rounded-xl border border-brand-border/30 text-center">
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Calories</span>
                        <span className="text-xs font-bold text-brand-text">{meal.calories} kcal</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Protein</span>
                        <span className="text-xs font-bold text-brand-text">{meal.proteinG}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Carbs</span>
                        <span className="text-xs font-bold text-brand-text">{meal.carbsG}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Fat</span>
                        <span className="text-xs font-bold text-brand-text">{meal.fatG}g</span>
                      </div>
                    </div>

                    {/* Suitability details */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {normalizeExclusiveNone(meal.suitableConditions).map(cond => (
                        <span key={cond} className="text-[10px] bg-brand-border/30 text-brand-text px-2 py-0.5 rounded border border-brand-border/50 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-brand-green" /> {AVAILABLE_CONDITIONS.find(c => c.value === cond)?.label || cond}
                        </span>
                      ))}
                      {normalizeExclusiveNone(meal.allergenFree).map(alg => (
                        <span key={alg} className="text-[10px] bg-brand-border/30 text-brand-text px-2 py-0.5 rounded border border-brand-border/50 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-brand-green" /> {AVAILABLE_ALLERGENS.find(a => a.value === alg)?.label || alg}
                        </span>
                      ))}
                    </div>

                    {/* Flag Alert Warning banner */}
                    {isFlagged && activeFlag && (
                      <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-xs text-amber-200/90 leading-relaxed mb-4">
                        <span className="font-bold flex items-center gap-1 mb-1">
                          <Flag className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Flagged for Re-Review:
                        </span>
                        &quot;{activeFlag.reason}&quot; — <span className="font-semibold">{activeFlag.flaggedByNutritionist?.user?.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Verifier Badge & Actions footer */}
                  <div className="flex items-center justify-between border-t border-brand-border/40 pt-4 mt-2">
                    
                    {/* Verifier credentials */}
                    <div className="text-[11px] text-brand-muted">
                      <span>Verifier: </span>
                      {meal.verifiedByNutritionist ? (
                        <button
                          onClick={() => {
                            setSelectedVerifier(meal.verifiedByNutritionist!);
                            setActiveModal('verifier');
                          }}
                          className="font-bold text-brand-green hover:underline cursor-pointer"
                        >
                          {meal.verifiedByNutritionist.user.name}
                        </button>
                      ) : (
                        <span className="italic">System / Unknown</span>
                      )}
                      <span className="block mt-0.5">Used {meal.usageCount}x</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setActiveModal('view');
                        }}
                        className="!px-3 !py-1.5 !h-8 text-xs font-semibold"
                      >
                        View
                      </Button>

                      {!isFlagged && !isArchived && (
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenCertification(meal)}
                          className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-brand-green"
                        >
                          {meal.safetyEvidenceStatus === 'COMPLETE' ? 'Re-certify' : 'Review evidence'}
                        </Button>
                      )}

                      {owned && !isArchived ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenEdit(meal)}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-brand-green"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setActiveModal('delete');
                            }}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-red-900/60 hover:text-red-400"
                          >
                            Archive
                          </Button>
                        </>
                      ) : (
                        !isFlagged && !isArchived && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setFlagReason('');
                              setActiveModal('flag');
                            }}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-amber-900/60 hover:text-amber-400"
                          >
                            Flag
                          </Button>
                        )
                      )}
                    </div>

                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-brand-border/40">
              <span className="text-xs text-brand-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="!px-3 !py-1.5 !h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="!px-3 !py-1.5 !h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODALS SECTION */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* View Meal Details Modal */}
      {selectedMeal && activeModal === 'view' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={selectedMeal.mealName}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Description</span>
              <p className="text-sm text-brand-text leading-relaxed mt-1">
                {selectedMeal.description || 'No description available.'}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Macronutrients & Portions</span>
              <div className="grid grid-cols-4 gap-4 mt-2 p-3 bg-brand-surface rounded-xl border border-brand-border text-center">
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Calories</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.calories} kcal</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Protein</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.proteinG} g</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Carbs</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.carbsG} g</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Fat</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.fatG} g</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Pre-Verified Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {normalizeExclusiveNone(selectedMeal.suitableConditions).map(cond => (
                  <Badge key={cond} variant="verified" className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" /> {AVAILABLE_CONDITIONS.find(c => c.value === cond)?.label || cond}
                  </Badge>
                ))}
                {normalizeExclusiveNone(selectedMeal.allergenFree).map(alg => (
                  <Badge key={alg} variant="user" className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> {AVAILABLE_ALLERGENS.find(a => a.value === alg)?.label || alg}
                  </Badge>
                ))}
                {selectedMeal.dietaryTags && (selectedMeal.dietaryTags as string[]).map(tag => (
                  <Badge key={tag} variant="ai" className="flex items-center gap-1">
                    <Salad className="w-3 h-3" /> {AVAILABLE_DIETS.find(d => d.value === tag)?.label || tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-brand-muted">Reusable evidence</span>
                <span className="text-xs font-bold text-brand-text">
                  {selectedMeal.safetyEvidenceStatus} · revision {selectedMeal.safetyEvidenceRevision}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                {selectedMeal.safetyEvidenceStatus === 'COMPLETE'
                  ? `Certified for deterministic library matching by ${selectedMeal.safetyReviewedByNutritionist?.user.name || 'qualified staff'}. User-specific restrictions are still checked every time.`
                  : selectedMeal.safetyEvidenceStatus === 'STALE'
                    ? `Re-review required${selectedMeal.safetyInvalidationReason ? `: ${selectedMeal.safetyInvalidationReason.replaceAll('_', ' ').toLowerCase()}` : ''}.`
                    : 'This meal is approved for its original user, but its reusable evidence has not yet been certified.'}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Stable ingredient evidence</span>
              <div className="mt-2 space-y-2">
                {(selectedMeal.ingredients || []).length === 0 ? (
                  <p className="rounded-xl border border-amber-800/40 bg-amber-950/15 p-3 text-xs text-amber-300">
                    No library-owned ingredient snapshot is available. This legacy entry cannot be certified automatically.
                  </p>
                ) : (selectedMeal.ingredients || []).map((ingredient) => (
                  <div key={ingredient.id} className="flex items-center justify-between rounded-xl border border-brand-border/50 bg-brand-surface/50 px-3 py-2 text-xs">
                    <span className="font-semibold text-brand-text">{ingredient.ingredientName}</span>
                    <span className={ingredient.dataSource === 'FNRI' && ingredient.foodItemId ? 'text-brand-green' : 'text-amber-300'}>
                      {ingredient.dataSource === 'FNRI' && ingredient.foodItemId ? 'FNRI linked' : 'Unresolved evidence'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedMeal.verifiedByNutritionist && (
              <div className="p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                <span className="text-xs font-bold text-brand-muted uppercase block mb-1">Signed & Verified By</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-brand-text">{selectedMeal.verifiedByNutritionist.user.name}</span>
                  <span className="text-brand-muted">PRC License: {selectedMeal.verifiedByNutritionist.prcLicenseNumber}</span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Verifier Profile Modal */}
      {selectedVerifier && activeModal === 'verifier' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={`${selectedVerifier.user.name} Profile`}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block font-bold text-brand-muted uppercase">PRC License</span>
                <span className="text-brand-text font-semibold">{selectedVerifier.prcLicenseNumber}</span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">License Expiry</span>
                <span className="text-brand-text font-semibold">
                  {new Date(selectedVerifier.prcLicenseExpiry).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">Specialization</span>
                <span className="text-brand-text font-semibold">{selectedVerifier.specialization || 'General Nutrition'}</span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">Experience</span>
                <span className="text-brand-text font-semibold">{selectedVerifier.yearsOfExperience || 0} years</span>
              </div>
            </div>

            {selectedVerifier.university && (
              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase">University</span>
                <span className="text-sm text-brand-text font-semibold">{selectedVerifier.university}</span>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-brand-muted uppercase">Biography</span>
              <p className="text-sm text-brand-text leading-relaxed mt-1">
                {selectedVerifier.bio || 'No biography written.'}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Independent reusable-evidence certification */}
      {selectedMeal && activeModal === 'certify' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title="Review reusable meal evidence"
          size="lg"
        >
          <form onSubmit={handleCertificationSubmit} className="space-y-5">
            {actionError && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-400">
                {actionError}
              </div>
            )}

            <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4 text-xs leading-relaxed text-brand-muted">
              This review applies only to revision <strong className="text-brand-text">{selectedMeal.safetyEvidenceRevision}</strong> of
              {' '}<strong className="text-brand-text">{selectedMeal.mealName}</strong>. It does not label the meal universally safe.
              NutriMind will still compare each user&apos;s current restrictions before reuse.
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-brand-muted">Library-owned ingredients</span>
                <span className="text-[10px] font-bold uppercase text-brand-muted">
                  {(selectedMeal.ingredients || []).length} recorded
                </span>
              </div>
              <div className="space-y-2">
                {(selectedMeal.ingredients || []).length === 0 ? (
                  <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-300">
                    This legacy meal has no stable ingredient snapshot and cannot be certified. Recreate it through a reviewed meal plan first.
                  </div>
                ) : (selectedMeal.ingredients || []).map((ingredient) => (
                  <div key={ingredient.id} className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bg/60 px-3 py-2 text-xs">
                    <span className="font-semibold text-brand-text">{ingredient.ingredientName}</span>
                    <span className={ingredient.dataSource === 'FNRI' && ingredient.foodItemId ? 'text-brand-green' : 'text-amber-300'}>
                      {ingredient.dataSource === 'FNRI' && ingredient.foodItemId ? 'FNRI linked' : 'Blocks certification'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-brand-muted">Condition review scope</span>
              <p className="mb-3 text-[11px] leading-relaxed text-brand-muted">
                Record only conditions you explicitly considered. Current complete diabetes and hypertension declarations may authorize reusable matching; heart, kidney, pregnancy, custom, and incomplete cases remain individually review-gated.
              </p>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3 sm:grid-cols-2">
                {AVAILABLE_CONDITIONS.map((condition) => (
                  <label key={condition.value} className="flex cursor-pointer items-center gap-2 text-xs text-brand-text">
                    <input
                      type="checkbox"
                      checked={evidenceForm.suitableConditions.includes(condition.value)}
                      onChange={() => toggleEvidenceCondition(condition.value)}
                      className="rounded border-brand-border bg-brand-bg text-brand-green focus:ring-brand-green"
                    />
                    {condition.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-brand-muted">Allergen declarations</span>
              <p className="mb-3 text-[11px] leading-relaxed text-brand-muted">
                Choose Present, Reviewed absent, or Not declared for every canonical allergen. Reviewed absent describes this evidence review only; it is not laboratory or manufacturing certification.
              </p>
              <div className="space-y-2">
                {AVAILABLE_ALLERGENS.map((allergen) => {
                  const mode = evidenceForm.allergensPresent.includes(allergen.value)
                    ? 'present'
                    : evidenceForm.allergensReviewedAbsent.includes(allergen.value)
                      ? 'absent'
                      : 'clear';
                  return (
                    <div key={allergen.value} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-brand-border/60 bg-brand-bg/60 px-3 py-2">
                      <span className="text-xs font-semibold text-brand-text">{allergen.label}</span>
                      <select
                        value={mode}
                        onChange={(event) => setEvidenceAllergen(allergen.value, event.target.value as 'present' | 'absent' | 'clear')}
                        className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-green"
                      >
                        <option value="clear">Not declared</option>
                        <option value="present">Present</option>
                        <option value="absent">Reviewed absent</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border/60 bg-brand-surface/60 p-4">
              <input
                type="checkbox"
                checked={evidenceForm.crossContactAcknowledged}
                onChange={(event) => setEvidenceForm((current) => ({ ...current, crossContactAcknowledged: event.target.checked }))}
                className="mt-0.5 rounded border-brand-border bg-brand-bg text-brand-green focus:ring-brand-green"
              />
              <span className="text-xs leading-relaxed text-brand-muted">
                I assessed the documented preparation information and found no known cross-contact risk in the evidence reviewed. This is not a guarantee about every kitchen or manufacturer.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-brand-border pt-4">
              <Button variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  actionLoading ||
                  !evidenceForm.crossContactAcknowledged ||
                  (selectedMeal.ingredients || []).length === 0 ||
                  (selectedMeal.ingredients || []).some((ingredient) => ingredient.dataSource !== 'FNRI' || !ingredient.foodItemId)
                }
              >
                {actionLoading ? 'Certifying...' : 'Certify this revision'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit / Resolve Meal Modal */}
      {selectedMeal && activeModal === 'edit' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={selectedMeal.status === 'FLAGGED' ? 'Resolve Flag: Edit Meal Details' : 'Edit Library Meal Details'}
          size="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <Input
              label="Meal Name"
              type="text"
              required
              value={editForm.mealName}
              onChange={(e) => setEditForm(prev => ({ ...prev, mealName: e.target.value }))}
            />

            <div>
              <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Description</label>
              <textarea
                required
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:outline-none focus:border-brand-green/80"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Input
                label="Calories (kcal)"
                type="number"
                required
                value={editForm.calories}
                onChange={(e) => setEditForm(prev => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
              />
              <Input
                label="Protein (g)"
                type="number"
                required
                value={editForm.proteinG}
                onChange={(e) => setEditForm(prev => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label="Carbs (g)"
                type="number"
                required
                value={editForm.carbsG}
                onChange={(e) => setEditForm(prev => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label="Fat (g)"
                type="number"
                required
                value={editForm.fatG}
                onChange={(e) => setEditForm(prev => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Checkboxes lists */}
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3 text-[11px] leading-relaxed text-brand-muted">
                Condition and allergen declarations are controlled in <strong className="text-brand-text">Review evidence</strong>. Editing meal content invalidates any current certification and never silently changes clinical declarations.
              </div>

              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Dietary & Goal Tags</span>
                <div className="grid grid-cols-2 gap-2 p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                  {AVAILABLE_DIETS.map(d => (
                    <label key={d.value} className="flex items-center gap-2 cursor-pointer text-xs text-brand-text">
                      <input
                        type="checkbox"
                        checked={editForm.dietaryTags.includes(d.value)}
                        onChange={() => handleToggleDiet(d.value)}
                        className="rounded text-brand-green bg-brand-bg border-brand-border focus:ring-brand-green"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Resolve or edit actions footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>

              {selectedMeal.status === 'FLAGGED' ? (
                <>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => handleResolveFlag('dismiss')}
                    disabled={actionLoading}
                    className="hover:border-brand-green hover:text-brand-green"
                  >
                    Dismiss Flag
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleResolveFlag('edit')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving...' : 'Resolve: Keep with Edits'}
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Resolve Delete Modal */}
      {selectedMeal && activeModal === 'delete' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={selectedMeal.status === 'FLAGGED' ? 'Resolve Flag: Archive Meal' : 'Archive Library Meal'}
          size="md"
        >
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <p className="text-sm text-brand-muted leading-relaxed">
              Archive <span className="font-bold text-brand-text">&quot;{selectedMeal.mealName}&quot;</span>? It will immediately stop appearing in user matching while its review history remains available for audit.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button
                variant="secondary"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={selectedMeal.status === 'FLAGGED' ? () => handleResolveFlag('delete') : handleDeleteSubmit}
                disabled={actionLoading}
                className="bg-red-900 hover:bg-red-800 text-brand-text border-transparent"
              >
                {actionLoading ? 'Archiving...' : selectedMeal.status === 'FLAGGED' ? 'Resolve: Archive Meal' : 'Archive Meal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Flag Modal */}
      {selectedMeal && activeModal === 'flag' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title="Flag Meal for Re-Review"
          size="md"
        >
          <form onSubmit={handleFlagSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <p className="text-xs text-brand-muted leading-relaxed">
              Submit a flag to alert the original verifying nutritionist (<span className="font-bold">{selectedMeal.verifiedByNutritionist?.user.name}</span>) 
              of clinical inaccuracies. Flagged meals will be immediately hidden from matching algorithms for new user plans.
            </p>

            <div>
              <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Reason for flag</label>
              <textarea
                required
                rows={4}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Describe why you disagree with this verified meal (e.g. nutrition value is wrong, suitable conditions tags, unsafe ingredients for clinical tag, etc.)."
                className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-sm text-brand-text placeholder-brand-muted/70 focus:outline-none focus:border-brand-green/80"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={actionLoading || !flagReason.trim()}
              >
                {actionLoading ? 'Flagging...' : 'Submit Flag'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
