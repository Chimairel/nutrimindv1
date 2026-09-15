import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account access | KAINARA',
  description: 'Securely access your KAINARA nutrition workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
