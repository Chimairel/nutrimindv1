'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { GroceryItem } from './current-grocery';

export default function PurchaseAmountEditor({ item, onSaved }: { item: GroceryItem; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.purchasedQuantity ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!editing)
    return (
      <button
        type="button"
        className="mt-1 text-xs text-brand-green underline"
        onClick={() => {
          setAmount(String(item.purchasedQuantity ?? 0));
          setEditing(true);
        }}
      >
        Enter purchased amount
      </button>
    );
  return (
    <span className="mt-2 block space-y-2">
      <label className="block text-xs">
        Total purchased ({item.unit})
        <input
          type="number"
          min="0"
          max="1000000"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="block w-full rounded border border-brand-border bg-brand-surface p-2"
        />
      </label>
      <span className="block text-xs text-brand-muted">
        Record the total bought for this shopping cycle. Meal portions stay the same.
      </span>
      {error && (
        <span role="alert" className="block text-xs text-status-error-text">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={saving || amount.trim() === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0}
        className="mr-3 text-xs font-bold text-brand-green"
        onClick={async () => {
          setSaving(true);
          setError('');
          try {
            await api.patch('/user/grocery/items/' + item.id + '/purchase', { purchasedQuantity: Number(amount) });
            await onSaved();
            setEditing(false);
          } catch (err) {
            setError(getApiErrorMessage(err, 'Could not record purchase.'));
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" disabled={saving} onClick={() => setEditing(false)} className="text-xs">
        Cancel
      </button>
    </span>
  );
}
