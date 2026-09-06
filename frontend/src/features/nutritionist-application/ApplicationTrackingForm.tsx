import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Props = {
  email: string;
  error: string | null;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  referenceCode: string;
};

export function ApplicationTrackingForm(props: Props) {
  return (
    <form onSubmit={props.onSubmit} className="surface-panel rounded-[30px] p-6 sm:p-8">
      <p className="portal-kicker !text-brand-green">Private status lookup</p>
      <h2 className="mt-3 font-display text-3xl font-black">Track your application</h2>
      <p className="mt-3 text-sm leading-6 text-brand-muted">
        Use the reference code shown after submission together with the same email address you applied with.
      </p>
      {props.error && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          {props.error}
        </p>
      )}
      <div className="mt-7 space-y-4">
        <Input
          id="tracking-reference"
          label="Application reference"
          value={props.referenceCode}
          onChange={(event) => props.onReferenceChange(event.target.value.toUpperCase())}
          placeholder="NM-XXXXXXXXXXXX"
          required
        />
        <Input
          id="tracking-email"
          label="Application email"
          type="email"
          value={props.email}
          onChange={(event) => props.onEmailChange(event.target.value)}
          placeholder="professional@example.com"
          required
        />
        <Button type="submit" size="lg" isLoading={props.isLoading} className="w-full">
          <Search className="h-4 w-4" />
          Check status
        </Button>
      </div>
    </form>
  );
}
