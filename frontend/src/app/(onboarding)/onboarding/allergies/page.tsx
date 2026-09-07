import OnboardingSafetyStep from '@/features/onboarding/OnboardingSafetyStep';

export default function OnboardingAllergiesPage() {
  return (
    <OnboardingSafetyStep
      step={4}
      progress={67}
      backHref="/onboarding/conditions"
      backLabel="Back to conditions"
      title="Food safety"
      description="Record allergies, intolerances, and foods or ingredients you avoid as separate entries."
      guidance="Each category is evaluated together. An unsupported entry is retained and routes automatic compatibility to review."
      editableDomains={['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
      nextHref="/onboarding/shopping-day"
    />
  );
}
