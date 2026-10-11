'use client';

import CaseReviewWorkspace from '@/features/nutritionist-reviews/CaseReviewWorkspace';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';
import { useReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';
import OutsideMealReviewsPanel from '../outside-meals/OutsideMealReviewsPanel';
import MealVerificationPanel from './MealVerificationPanel';
import ProfileWorkPanel from './ProfileWorkPanel';
import WorkspaceTabs, { type ReviewWorkspace } from './WorkspaceTabs';
import SharedWorkspaceTabs from '@/components/ui/WorkspaceTabs';
import DesktopReviewGate from '@/features/nutritionist-reviews/DesktopReviewGate';

export default function ReviewsPage() {
  return (
    <DesktopReviewGate>
      <ReviewsWorkspace />
    </DesktopReviewGate>
  );
}

function ReviewsWorkspace() {
  const workCounts = useReviewWorkCounts();
  const [workspace, setWorkspace] = useState<ReviewWorkspace>('case');
  const [caseFilter, setCaseFilter] = useState<'pending' | 'outside'>('pending');
  const [expanded, setExpanded] = useState(false);
  const review = useNutritionistReviews(workspace === 'case' && caseFilter === 'pending');

  const navigation = (
    <WorkspaceTabs
      value={workspace}
      counts={workCounts}
      onChange={(next) => {
        setWorkspace(next);
        setExpanded(false);
      }}
    />
  );

  const caseFilters = (
    <SharedWorkspaceTabs
      value={caseFilter}
      onChange={(next) => {
        setCaseFilter(next);
        setExpanded(false);
      }}
      label="Case approval filters"
      tone="accentSoft"
      size="sm"
      items={[
        { value: 'pending', label: 'Pending' },
        { value: 'outside', label: 'Outside food logs' },
      ]}
    />
  );

  if (workspace === 'meal') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          <MealVerificationPanel />
        </div>
      </div>
    );
  }

  if (workspace === 'profile') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          <ProfileWorkPanel />
        </div>
      </div>
    );
  }

  if (caseFilter === 'outside') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          {caseFilters}
          <OutsideMealReviewsPanel embedded />
        </div>
      </div>
    );
  }

  return (
    <CaseReviewWorkspace
      review={review}
      caseFilter={caseFilter}
      expanded={expanded}
      setExpanded={setExpanded}
      navigation={navigation}
      caseFilters={caseFilters}
    />
  );
}
