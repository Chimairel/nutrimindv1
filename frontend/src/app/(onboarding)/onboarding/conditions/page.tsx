import OnboardingSafetyStep from '@/features/onboarding/OnboardingSafetyStep';

export default function OnboardingConditionsPage() {
  return (
    <OnboardingSafetyStep
      step={3}
      progress={50}
      backHref="/onboarding/preferences"
      backLabel="Back to preferences"
      title="Medical conditions"
      description="Combine common choices with your own terms, then review every entry before saving."
      guidance="Report diagnosed conditions accurately. Vague or unsupported entries require clarification or individual review."
      editableDomains={['CONDITION']}
      nextHref="/onboarding/allergies"
    />
  );
}
