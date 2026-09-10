'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { getApiErrorMessage } from '@/lib/api-error';

const fields = [
  'calories',
  'proteinG',
  'carbsG',
  'fatG',
  'fiber',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'vitaminA',
  'vitaminC',
  'vitaminB1',
  'vitaminB2',
  'niacin',
  'water',
] as const;
type Values = Record<(typeof fields)[number], number | null>;
type Revision = {
  id: string;
  baseRevision: number;
  previousValues: Values;
  proposedValues: Values;
  sourceUrl: string;
  reason: string;
  publishedAt: string | null;
};
export default function CompositionEditor({
  foodId,
  onClose,
  onChanged,
}: {
  foodId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [food, setFood] = useState<(Values & { name: string; compositionRevision: number }) | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [history, setHistory] = useState<Revision[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const res = await api.get('/admin/data/foods/' + foodId + '/composition');
    setFood(res.data.data.food);
    setValues(Object.fromEntries(fields.map((key) => [key, res.data.data.food[key]])) as Values);
    setHistory(res.data.data.history);
  }
  useEffect(() => {
    load().catch((err) =>
      setError(getApiErrorMessage(err, 'Could not load composition.'))
    ); /* foodId identifies this modal instance. */
  }, [foodId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal isOpen onClose={onClose} title={'Composition · ' + (food?.name ?? 'Loading')} size="lg">
      <p className="mb-4 text-sm">
        Record values per 100 g from the cited source, using its FNRI nutrient units. Save a draft, review the changes,
        then publish. A correction sends affected recipes and unconsumed meals back for review.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-status-error-text">
          {error}
        </p>
      )}
      {values && (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError('');
            try {
              await api.post('/admin/data/foods/' + foodId + '/composition', {
                expectedRevision: food!.compositionRevision,
                values,
                sourceUrl: form.get('sourceUrl'),
                sourcePublishedAt: new Date(String(form.get('date'))).toISOString(),
                reason: form.get('reason'),
              });
              await load();
            } catch (err) {
              setError(getApiErrorMessage(err, 'Could not save draft.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.map((key) => (
              <label key={key} className="text-xs">
                {key}
                <input
                  aria-label={key}
                  type="number"
                  min="0"
                  step="any"
                  required={['calories', 'proteinG', 'carbsG', 'fatG'].includes(key)}
                  value={values[key] ?? ''}
                  onChange={(event) =>
                    setValues({ ...values, [key]: event.target.value === '' ? null : Number(event.target.value) })
                  }
                  className="mt-1 block w-full rounded border border-brand-border bg-brand-surface p-2"
                />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Official source URL
            <input
              name="sourceUrl"
              type="url"
              required
              className="block w-full rounded border border-brand-border bg-brand-surface p-2"
            />
          </label>
          <label className="block text-sm">
            Source publication date
            <input
              name="date"
              type="date"
              required
              className="block rounded border border-brand-border bg-brand-surface p-2"
            />
          </label>
          <label className="block text-sm">
            Reason for correction
            <input
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              className="block w-full rounded border border-brand-border bg-brand-surface p-2"
            />
          </label>
          <Button type="submit" disabled={busy}>
            Save review draft
          </Button>
        </form>
      )}
      <h3 className="mt-6 font-bold">Drafts and publication history</h3>
      {history.map((entry) => (
        <details key={entry.id} className="mt-3 rounded border border-brand-border p-3 text-sm">
          <summary>
            {entry.publishedAt ? 'Published correction' : 'Draft'} · based on revision {entry.baseRevision}
          </summary>
          <p className="my-2">{entry.reason}</p>
          <a className="underline" href={entry.sourceUrl} target="_blank" rel="noreferrer">
            Source evidence
          </a>
          <table className="my-3 w-full text-left text-xs">
            <thead>
              <tr>
                <th>Nutrient</th>
                <th>Before</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {fields
                .filter((key) => entry.previousValues[key] !== entry.proposedValues[key])
                .map((key) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{entry.previousValues[key] ?? 'Unknown'}</td>
                    <td>{entry.proposedValues[key] ?? 'Unknown'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!entry.publishedAt && (
            <Button
              disabled={busy || entry.baseRevision !== food?.compositionRevision}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api.post('/admin/data/composition/' + entry.id + '/publish', {});
                  await load();
                  await onChanged();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'Could not publish correction.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish reviewed correction
            </Button>
          )}
          {entry.publishedAt && (
            <Button
              variant="secondary"
              onClick={() => {
                setValues(entry.previousValues);
              }}
            >
              Prepare rollback draft
            </Button>
          )}
        </details>
      ))}
    </Modal>
  );
}
