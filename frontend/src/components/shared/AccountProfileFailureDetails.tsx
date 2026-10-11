import { profileLoadFailureCopy, type ProfileLoadFailure } from '@/lib/profile-load-failure';

export default function AccountProfileFailureDetails({ failure }: { failure?: ProfileLoadFailure | null }) {
  const { reason, recovery } = profileLoadFailureCopy(failure);
  return (
    <div className="mt-3 space-y-2 text-sm leading-6">
      <p className="text-brand-text">{reason}</p>
      <p className="text-brand-muted">{recovery}</p>
      {failure?.requestId && <p className="break-all text-xs text-brand-muted">Request ID: {failure.requestId}</p>}
    </div>
  );
}
