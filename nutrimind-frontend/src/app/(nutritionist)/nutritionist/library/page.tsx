'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Utensils, Stethoscope, ShieldAlert, Flag, Salad } from 'lucide-react';


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
  status: 'APPROVED' | 'FLAGGED';
  addedAt: string;
  verifiedByNutritionistId: string;
  verifiedByNutritionist?: Verifier;
  flags?: Flag[];
}

const AVAILABLE_CONDITIONS = [
  { label: 'Diabetic-Safe', value: 'DIABETES' },
  { label: 'Low-Sodium', value: 'HYPERTENSION' },
  { label: 'Kidney-Healthy', value: 'KIDNEY_DISEASE' },
  { label: 'Heart-Healthy', value: 'HEART_CONDITION' },
  { label: 'Pregnancy-Safe', value: 'PREGNANT' },
];

const AVAILABLE_ALLERGENS = [
  { label: 'Shellfish-Free', value: 'SHELLFISH' },
  { label: 'Nut-Free', value: 'NUTS' },
  { label: 'Dairy-Free', value: 'DAIRY' },
  { label: 'Gluten-Free', value: 'GLUTEN' },
  { label: 'Egg-Free', value: 'EGGS' },
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

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('All');
  const [conditionTag, setConditionTag] = useState('All');
  const [status, setStatus] = useState('All');
  const [verifiedByMe, setVerifiedByMe] = useState(false);

  // Modal / Action States
  const [activeModal, setActiveModal] = useState<'view' | 'edit' | 'delete' | 'flag' | 'resolve' | 'verifier' | null>(null);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mealType, conditionTag, status, verifiedByMe, page]);

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
      suitableConditions: (meal.suitableConditions || []) as string[],
      allergenFree: (meal.allergenFree || []) as string[],
      dietaryTags: (meal.dietaryTags || []) as string[],
    });
    setActionError(null);
    setActiveModal('edit');
  };

  // Submit Edit Mutation
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeal) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.patch(`/nutritionist/library/${selectedMeal.id}`, editForm);
      if (res.data?.success) {
        fetchLibrary();
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
        fetchLibrary();
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
        fetchLibrary();
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
        updatedFields: resolution === 'edit' ? editForm : undefined,
      };
      const res = await api.patch(`/nutritionist/library/${selectedMeal.id}/resolve-flag`, payload);
      if (res.data?.success) {
        fetchLibrary();
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
  const handleToggleCondition = (val: string) => {
    setEditForm(prev => ({
      ...prev,
      suitableConditions: prev.suitableConditions.includes(val)
        ? prev.suitableConditions.filter(c => c !== val)
        : [...prev.suitableConditions, val]
    }));
  };

  const handleToggleAllergen = (val: string) => {
    setEditForm(prev => ({
      ...prev,
      allergenFree: prev.allergenFree.includes(val)
        ? prev.allergenFree.filter(a => a !== val)
        : [...prev.allergenFree, val]
    }));
  };

  const handleToggleDiet = (val: string) => {
    setEditForm(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(val)
        ? prev.dietaryTags.filter(d => d !== val)
        : [...prev.dietaryTags, val]
    }));
  };

  return (
    <div className="px-4 py-8 md:px-8 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-text font-display">Meal Library</h1>
          <p className="text-sm text-brand-muted mt-1">
            Browse, manage, and verify clinically approved native meal records.
          </p>
        </div>
        <span className="self-start md:self-center px-4 py-2 bg-brand-surface border border-brand-border rounded-xl text-xs text-brand-text font-bold flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-green" /> Total: {totalCount} verified meals
        </span>
      </div>

      {/* Top Filter Panel */}
      <Card className="p-5 border-brand-border/60 bg-brand-surface/50 backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search bar */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Search meal name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search e.g. Tinola..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full h-11 bg-brand-bg border border-brand-border rounded-xl px-4 text-sm text-brand-text placeholder-brand-muted/70 focus:outline-none focus:border-brand-green/80 transition-colors"
              />
              {searchVal && (
                <button 
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
            <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Meal Type</label>
            <select
              value={mealType}
              onChange={(e) => { setMealType(e.target.value); setPage(1); }}
              className="w-full h-11 bg-brand-bg border border-brand-border rounded-xl px-3 text-sm text-brand-text focus:outline-none focus:border-brand-green/80 transition-colors"
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
            <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Condition Tag</label>
            <select
              value={conditionTag}
              onChange={(e) => { setConditionTag(e.target.value); setPage(1); }}
              className="w-full h-11 bg-brand-bg border border-brand-border rounded-xl px-3 text-sm text-brand-text focus:outline-none focus:border-brand-green/80 transition-colors"
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
              <span className="text-xs font-bold text-brand-muted uppercase">Status:</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text focus:outline-none focus:border-brand-green/80"
              >
                <option value="All">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="FLAGGED">Flagged</option>
              </select>
            </div>
          </div>

          {/* Owner filter */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={verifiedByMe}
              onChange={(e) => { setVerifiedByMe(e.target.checked); setPage(1); }}
              className="w-4.5 h-4.5 rounded border-brand-border text-brand-green focus:ring-brand-green bg-brand-bg"
            />
            <span className="text-xs font-bold text-brand-text">Show only meals verified by me</span>
          </label>
          
        </div>
      </Card>

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
                        ) : (
                          <Badge variant="verified" showIcon>Approved</Badge>
                        )}
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
                      {meal.suitableConditions && (meal.suitableConditions as string[]).map(cond => (
                        <span key={cond} className="text-[10px] bg-brand-border/30 text-brand-text px-2 py-0.5 rounded border border-brand-border/50 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-brand-green" /> {AVAILABLE_CONDITIONS.find(c => c.value === cond)?.label || cond}
                        </span>
                      ))}
                      {meal.allergenFree && (meal.allergenFree as string[]).map(alg => (
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

                      {owned ? (
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
                            Delete
                          </Button>
                        </>
                      ) : (
                        !isFlagged && (
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
                {selectedMeal.suitableConditions && (selectedMeal.suitableConditions as string[]).map(cond => (
                  <Badge key={cond} variant="verified" className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" /> {AVAILABLE_CONDITIONS.find(c => c.value === cond)?.label || cond}
                  </Badge>
                ))}
                {selectedMeal.allergenFree && (selectedMeal.allergenFree as string[]).map(alg => (
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
              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Suitable Health Conditions</span>
                <div className="grid grid-cols-2 gap-2 p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                  {AVAILABLE_CONDITIONS.map(c => (
                    <label key={c.value} className="flex items-center gap-2 cursor-pointer text-xs text-brand-text">
                      <input
                        type="checkbox"
                        checked={editForm.suitableConditions.includes(c.value)}
                        onChange={() => handleToggleCondition(c.value)}
                        className="rounded text-brand-green bg-brand-bg border-brand-border focus:ring-brand-green"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Allergen Exclusions</span>
                <div className="grid grid-cols-2 gap-2 p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                  {AVAILABLE_ALLERGENS.map(a => (
                    <label key={a.value} className="flex items-center gap-2 cursor-pointer text-xs text-brand-text">
                      <input
                        type="checkbox"
                        checked={editForm.allergenFree.includes(a.value)}
                        onChange={() => handleToggleAllergen(a.value)}
                        className="rounded text-brand-green bg-brand-bg border-brand-border focus:ring-brand-green"
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
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
          title={selectedMeal.status === 'FLAGGED' ? 'Resolve Flag: Delete Meal' : 'Delete Library Meal'}
          size="md"
        >
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <p className="text-sm text-brand-muted leading-relaxed">
              Are you sure you want to delete the meal <span className="font-bold text-brand-text">&quot;{selectedMeal.mealName}&quot;</span>? 
              This action is permanent and will completely remove this meal entry from the verified library database.
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
                {actionLoading ? 'Deleting...' : selectedMeal.status === 'FLAGGED' ? 'Resolve: Remove Meal' : 'Delete Permanently'}
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
