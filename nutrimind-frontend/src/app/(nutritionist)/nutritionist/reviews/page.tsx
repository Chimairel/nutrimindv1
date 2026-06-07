'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

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
  user: { id: string; name: string; email: string };
  ingredients: { ingredientName: string }[];
}

export default function ReviewsPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/nutritionist/queue');
      if (res.data?.success) setQueue(res.data.data);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/nutritionist/review/${id}`, { action: 'approve' });
      setQueue((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectNote.trim()) return;
    setActionLoading(rejectId);
    try {
      await api.patch(`/nutritionist/review/${rejectId}`, { action: 'reject', note: rejectNote });
      setQueue((prev) => prev.filter((m) => m.id !== rejectId));
      setRejectId(null);
      setRejectNote('');
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const flagColor = (flag: string): 'rejected' | 'pending' | 'verified' => {
    switch (flag) {
      case 'NEEDS_REVIEW': return 'rejected';
      case 'CAUTION': return 'pending';
      default: return 'verified';
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading queue...</span></div>;
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-text font-display">Review Queue</h1>
        <Badge variant="pending" className="text-xs">{queue.length} pending</Badge>
      </div>

      {queue.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="text-5xl block mb-4">✅</span>
          <p className="text-brand-muted">All caught up! No meals pending review.</p>
        </Card>
      ) : (
        queue.map((meal) => (
          <Card key={meal.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-brand-text">{meal.mealName}</h3>
                <p className="text-xs text-brand-muted">
                  {meal.mealType} • {meal.user.name} • {new Date(meal.scheduledDate).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={flagColor(meal.aiConfidenceFlag)} className="text-[10px]">
                {meal.aiConfidenceFlag}
              </Badge>
            </div>

            {meal.description && (
              <p className="text-xs text-brand-muted mb-3 line-clamp-2">{meal.description}</p>
            )}

            <div className="flex gap-4 text-xs text-brand-muted mb-3">
              <span>🔥 {meal.calories} kcal</span>
              <span>P: {meal.proteinG}g</span>
              <span>C: {meal.carbsG}g</span>
              <span>F: {meal.fatG}g</span>
            </div>

            {meal.ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {meal.ingredients.map((ing, i) => (
                  <span key={i} className="px-2 py-1 bg-brand-border/40 rounded-md text-[10px] text-brand-muted">
                    {ing.ingredientName}
                  </span>
                ))}
              </div>
            )}

            {rejectId === meal.id ? (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Rejection reason (required)..."
                  className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:border-brand-green focus:outline-none resize-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleReject} isLoading={actionLoading === meal.id} className="text-xs px-4">
                    Confirm Reject
                  </Button>
                  <Button variant="secondary" onClick={() => { setRejectId(null); setRejectNote(''); }} className="text-xs px-4">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => handleApprove(meal.id)} isLoading={actionLoading === meal.id} className="text-xs px-6">
                  ✅ Approve
                </Button>
                <Button variant="secondary" onClick={() => setRejectId(meal.id)} className="text-xs px-6">
                  ❌ Reject
                </Button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
