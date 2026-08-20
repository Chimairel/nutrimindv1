import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account access | NutriMind',
  description: 'Securely access your NutriMind nutrition workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
