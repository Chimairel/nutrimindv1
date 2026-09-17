import ProgressSkeleton from '@/features/progress/ProgressSkeleton';

export default function ProgressLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <ProgressSkeleton />
      </div>
    </div>
  );
}
