import { redirect } from 'next/navigation';

export default async function LegacyNutritionReportPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const allowedNext = next === 'dashboard' || next === 'regenerate' ? `?next=${next}` : '';
  redirect(`/profile/nutrition-report${allowedNext}`);
}
