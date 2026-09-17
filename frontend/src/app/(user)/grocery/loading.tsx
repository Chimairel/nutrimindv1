import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';

export default function GroceryLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <GrocerySkeleton />
      </div>
    </div>
  );
}
