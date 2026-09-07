import { AlertTriangle } from 'lucide-react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function AuthFormPrelude({
  googleLabel,
  error,
  compact = false,
}: {
  googleLabel: string;
  error?: string | null;
  compact?: boolean;
}) {
  return (
    <>
      <GoogleSignInButton label={googleLabel} />
      <div className={`${compact ? 'my-5' : 'my-6'} flex items-center gap-4`}>
        <div className="h-px flex-1 bg-brand-border/70" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-muted">
          or use email
        </span>
        <div className="h-px flex-1 bg-brand-border/70" />
      </div>
      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-5">{error}</span>
        </div>
      ) : null}
    </>
  );
}
