import DashboardSkeleton from '@/features/dashboard/DashboardSkeleton';

export default function DashboardLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <DashboardSkeleton />
      </div>
    </div>
  );
}
