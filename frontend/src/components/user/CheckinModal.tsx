import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/axios';
import axios from 'axios';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanRegenerated: () => void;
}

export default function CheckinModal({ isOpen, onClose, onPlanRegenerated }: CheckinModalProps) {
  const [step, setStep] = useState<'PROMPT' | 'FORM'>('PROMPT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    weightKg: '',
    activityLevel: '',
    goal: '',
  });

  useEffect(() => {
    if (isOpen && step === 'FORM') {
      // Fetch profile to prefill
      api.get('/user/profile').then(res => {
        if (res.data?.success && res.data.data?.userProfile) {
          const profile = res.data.data.userProfile;
          setFormData({
            weightKg: profile.weightKg ? String(profile.weightKg) : '',
            activityLevel: profile.activityLevel || 'SEDENTARY',
            goal: profile.goal || 'MAINTAIN',
          });
        }
      }).catch(err => {
        console.error('[CheckinModal] Failed to fetch profile:', err);
      });
    }
  }, [isOpen, step]);

  const handleSameSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/user/checkin/submit', { changed: false });
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to submit check-in.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updates = {
        weightKg: parseFloat(formData.weightKg) || undefined,
        activityLevel: formData.activityLevel,
        goal: formData.goal,
      };

      await api.post('/user/checkin/submit', { changed: true, updates });
      
      // Refresh the dashboard. The updated profile is applied to the next
      // schedule-derived plan; the current approved week is not discarded.
      onPlanRegenerated();
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to update check-in and regenerate plan.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'PROMPT') {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {}} // Force them to choose
        title="Weekly Check-in Due"
        description="It's time for your weekly NutriMind check-in! Let's ensure your meal plan remains accurate for your current progress."
      >
        <div className="flex flex-col gap-6 py-4 text-center">
          <p className="text-sm text-brand-muted">
            Has anything changed in the last 7 days regarding your weight, activity level, or fitness goal?
          </p>

          {error && <p className="text-status-error-text text-xs bg-status-error-bg/10 p-2 rounded">{error}</p>}

          <div className="flex flex-col gap-3">
            <Button 
              variant="primary" 
              onClick={handleSameSubmit} 
              isLoading={isSubmitting}
            >
              Everything is the same
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setStep('FORM')} 
              disabled={isSubmitting}
            >
              Update my profile
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setStep('PROMPT')}
      title="Update Check-in Details"
      description="Update your current metrics. NutriMind will use them for the next scheduled plan without discarding your active approved week."
    >
      <div className="flex flex-col gap-5 py-2">
        {error && <p className="text-status-error-text text-xs bg-status-error-bg/10 p-2 rounded">{error}</p>}

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">
            Current Weight (kg)
          </label>
          <Input
            type="number"
            step="0.1"
            value={formData.weightKg}
            onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
            placeholder="e.g. 70.5"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">
            Activity Level
          </label>
          <select
            value={formData.activityLevel}
            onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
            className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text outline-none transition-all placeholder:text-brand-muted focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          >
            <option value="SEDENTARY">Sedentary (Little or no exercise)</option>
            <option value="LIGHTLY_ACTIVE">Lightly Active (Exercise 1-3 times/week)</option>
            <option value="ACTIVE">Active (Exercise 3-5 times/week)</option>
            <option value="VERY_ACTIVE">Very Active (Daily exercise)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">
            Primary Goal
          </label>
          <select
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text outline-none transition-all placeholder:text-brand-muted focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          >
            <option value="LOSE_WEIGHT">Lose Weight</option>
            <option value="MAINTAIN">Maintain Weight</option>
            <option value="GAIN_WEIGHT">Gain Weight</option>
            <option value="BUILD_MUSCLE">Build Muscle</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setStep('PROMPT')} disabled={isSubmitting}>
            Back
          </Button>
          <Button variant="primary" onClick={handleUpdateSubmit} isLoading={isSubmitting}>
            Save for Next Plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
