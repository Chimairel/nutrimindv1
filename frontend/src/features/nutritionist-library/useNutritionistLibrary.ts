import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { normalizeExclusiveNone } from '@/lib/profile-normalization';
import { getApiErrorMessage } from '@/lib/api-error';

export interface Flag {
  id: string;
  reason: string;
  createdAt: string;
  flaggedByNutritionist: {
    user: {
      name: string;
    };
  };
}

export interface Verifier {
  id: string;
  userId: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  officialHeadshot?: string | null;
  digitalSignature?: string | null;
  user: {
    name: string;
    image?: string | null;
  };
}

export interface LibraryMeal {
  id: string;
  mealName: string;
  mealType: string;
  applicableMealTypes?: Array<{
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    reviewStatus: 'PROPOSED' | 'REVIEWED';
  }>;
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | null;
  riceRoleReviewStatus?: 'NOT_REVIEWED' | 'PROPOSED' | 'REVIEWED';
  includedRiceG?: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg?: number | null;
  sugarG?: number | null;
  fiberG?: number | null;
  potassiumMg?: number | null;
  phosphorusMg?: number | null;
  saturatedFatG?: number | null;
  nutritionServingDescription?: string | null;
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
  verifiedByNutritionistId: string | null;
  verifiedByNutritionist?: Verifier;
  flags?: Flag[];
  safetyReviews?: Array<{ id: string; reasonCode: string | null; evidenceSnapshot?: { nutritionBasis?: string } | null }>;
  ingredients?: {
    id: string;
    ingredientName: string;
    category?: string | null;
    foodItemId?: string | null;
    dataSource: 'FNRI' | 'GEMINI_ESTIMATED' | 'SOURCE_RECIPE';
    position: number;
    quantity?: number | null;
    unit?: string | null;
  }[];
  safetyReviewedByNutritionist?: { user: { name: string } } | null;
}

export interface LibraryCoverage {
  certifiedMeals: number;
  requiredPerSlot: number;
  profiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    total: number;
    servingCoverage?: Array<{ dailyCalorieTarget: number; counts: Record<string, number>; weekReady: boolean }>;
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

export const AVAILABLE_CONDITIONS = [
  { label: 'Diabetes reviewed', value: 'DIABETES' },
  { label: 'Hypertension reviewed', value: 'HYPERTENSION' },
  { label: 'Kidney disease reviewed', value: 'KIDNEY_DISEASE' },
  { label: 'Heart condition reviewed', value: 'HEART_CONDITION' },
  { label: 'Pregnancy reviewed', value: 'PREGNANT' },
];

export const AVAILABLE_ALLERGENS = [
  { label: 'Shellfish', value: 'SHELLFISH' },
  { label: 'Nuts', value: 'NUTS' },
  { label: 'Dairy', value: 'DAIRY' },
  { label: 'Gluten', value: 'GLUTEN' },
  { label: 'Eggs', value: 'EGGS' },
];

export const AVAILABLE_DIETS = [
  { label: 'Omnivore', value: 'OMNIVORE' },
  { label: 'Vegetarian', value: 'VEGETARIAN' },
  { label: 'Vegan', value: 'VEGAN' },
  { label: 'Pescatarian', value: 'PESCATARIAN' },
];

export function useNutritionistLibrary() {
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
  const [adminDraftsOnly, setAdminDraftsOnly] = useState(false);

  // Modal / Action States
  const [activeModal, setActiveModal] = useState<
    'view' | 'edit' | 'delete' | 'flag' | 'resolve' | 'verifier' | 'certify' | null
  >(null);
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
    applicableMealTypes: [] as string[],
    riceRole: 'STANDALONE' as 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE',
    includedRiceG: null as number | null,
  });
  const [flagReason, setFlagReason] = useState('');
  const [evidenceForm, setEvidenceForm] = useState({
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
          adminDraftsOnly: adminDraftsOnly ? 'true' : undefined,
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
  }, [search, mealType, conditionTag, status, verifiedByMe, adminDraftsOnly, page]);

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
      applicableMealTypes: meal.applicableMealTypes?.map((entry) => entry.mealType) ?? [meal.mealType],
      riceRole: meal.riceRole ?? 'STANDALONE',
      includedRiceG: meal.includedRiceG ?? null,
    });
    setActionError(null);
    setActiveModal('edit');
  };

  const handleOpenCertification = (meal: LibraryMeal) => {
    setSelectedMeal(meal);
    setEvidenceForm({
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
        conditionDeclarationState: 'NOT_REVIEWED',
        allergenDeclarationState: allergenCount > 0 ? 'REVIEWED_WITH_DECLARATIONS' : 'REVIEWED_NONE_DECLARED',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        suitableConditions: [],
        allergensPresent: evidenceForm.allergensPresent,
        allergensReviewedAbsent: evidenceForm.allergensReviewedAbsent,
      });
      if (res.data?.success) {
        if (res.data.data?.certificationAwaitingSecondReview) {
          setActionError(
            'First review recorded. A different nutritionist must submit the same kidney/pregnancy evidence before certification.'
          );
          await fetchLibrary();
          return;
        }
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to certify the current evidence revision.'));
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
        applicableMealTypes: editForm.applicableMealTypes,
        riceRole: editForm.riceRole,
        includedRiceG: editForm.riceRole === 'INCLUDES_RICE' ? editForm.includedRiceG : null,
      });
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to update library meal.'));
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
      setActionError(getApiErrorMessage(err, 'Failed to delete library meal.'));
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
      setActionError(getApiErrorMessage(err, 'Failed to submit flag.'));
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
        updatedFields:
          resolution === 'edit'
            ? {
                mealName: editForm.mealName,
                description: editForm.description,
                calories: editForm.calories,
                proteinG: editForm.proteinG,
                carbsG: editForm.carbsG,
                fatG: editForm.fatG,
                dietaryTags: editForm.dietaryTags,
                applicableMealTypes: editForm.applicableMealTypes,
                riceRole: editForm.riceRole,
                includedRiceG: editForm.riceRole === 'INCLUDES_RICE' ? editForm.includedRiceG : null,
              }
            : undefined,
      };
      const res = await api.patch(`/nutritionist/library/${selectedMeal.id}/resolve-flag`, payload);
      if (res.data?.success) {
        await Promise.all([fetchLibrary(), fetchCoverage()]);
        setActiveModal(null);
      }
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to resolve flag.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Helper toggle arrays
  const handleToggleDiet = (val: string) => {
    setEditForm((prev) => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(val)
        ? prev.dietaryTags.filter((d) => d !== val)
        : [...prev.dietaryTags, val],
    }));
  };

  const setEvidenceAllergen = (value: string, mode: 'present' | 'absent' | 'clear') => {
    setEvidenceForm((current) => ({
      ...current,
      allergensPresent:
        mode === 'present'
          ? [...current.allergensPresent.filter((item) => item !== value), value]
          : current.allergensPresent.filter((item) => item !== value),
      allergensReviewedAbsent:
        mode === 'absent'
          ? [...current.allergensReviewedAbsent.filter((item) => item !== value), value]
          : current.allergensReviewedAbsent.filter((item) => item !== value),
    }));
  };

  return {
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    status,
    setStatus,
    verifiedByMe,
    setVerifiedByMe,
    adminDraftsOnly,
    setAdminDraftsOnly,
    activeModal,
    setActiveModal,
    selectedMeal,
    setSelectedMeal,
    selectedVerifier,
    setSelectedVerifier,
    editForm,
    setEditForm,
    flagReason,
    setFlagReason,
    evidenceForm,
    setEvidenceForm,
    actionLoading,
    actionError,
    setActionError,
    fetchLibrary,
    fetchCoverage,
    isOwner,
    handleOpenEdit,
    handleOpenCertification,
    handleCertificationSubmit,
    handleEditSubmit,
    handleDeleteSubmit,
    handleFlagSubmit,
    handleResolveFlag,
    handleToggleDiet,
    setEvidenceAllergen,
  };
}
