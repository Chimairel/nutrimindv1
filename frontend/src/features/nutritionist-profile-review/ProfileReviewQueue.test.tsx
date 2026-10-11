import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import ProfileReviewQueue from './ProfileReviewQueue';

type Model = ComponentProps<typeof ProfileReviewQueue>['model'];
function model(overrides: Partial<Model> = {}): Model {
  return {
    detail: null,
    expanded: false,
    isLoading: false,
    busy: false,
    openingPersonId: null,
    error: null,
    openPerson: vi.fn(),
    people: [
      {
        userId: 'a',
        name: 'Member A',
        conditions: ['HEART_CONDITION'],
        allergies: ['NONE'],
        profileStatus: 'PENDING',
        documentCount: 1,
        documentIds: ['doc'],
      },
      {
        userId: 'b',
        name: 'Member B',
        conditions: ['NONE'],
        allergies: ['NUTS'],
        profileStatus: 'APPROVED',
        documentCount: 0,
        documentIds: [],
      },
    ],
    ...overrides,
  };
}

describe('member task navigation', () => {
  it('filters health context without reordering or opening work automatically', () => {
    const data = model();
    render(<ProfileReviewQueue model={data} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'heart condition' } });
    expect(screen.queryByRole('button', { name: /Member B/ })).not.toBeInTheDocument();
    const row = screen.getByRole('button', { name: /Member A/ });
    expect(row).toHaveTextContent('1 document');
    expect(data.openPerson).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(data.openPerson).toHaveBeenCalledWith('a');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no matching person' } });
    expect(screen.getByRole('status')).toHaveTextContent('No members match');
    expect(screen.queryByText('Profile queue is clear.')).not.toBeInTheDocument();
  });
  it('marks the opening row and prevents selection changes while busy', () => {
    render(
      <ProfileReviewQueue
        model={model({ busy: true, openingPersonId: 'b', detail: { userId: 'a' } as Model['detail'] })}
      />
    );
    const opening = screen.getByRole('button', { name: /Member B/ });
    expect(opening).toBeDisabled();
    expect(opening).toHaveAttribute('aria-pressed', 'true');
    expect(opening).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Member A/ })).toHaveAttribute('aria-pressed', 'false');
  });
  it('distinguishes loading and failed requests from an empty queue', () => {
    const { rerender } = render(<ProfileReviewQueue model={model({ people: [], isLoading: true })} />);
    expect(screen.getByLabelText('Loading member profile queue')).toHaveAttribute('aria-busy', 'true');
    rerender(<ProfileReviewQueue model={model({ people: [], error: 'Request failed' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('unavailable');
    expect(screen.queryByText('Profile queue is clear.')).not.toBeInTheDocument();
  });
});
