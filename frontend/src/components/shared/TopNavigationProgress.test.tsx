import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TopNavigationProgress from './TopNavigationProgress';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe('TopNavigationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially renders hidden or null when idle', () => {
    const { container } = render(<TopNavigationProgress />);
    expect(container.firstChild).toBeNull();
  });

  it('triggers progress animation when an internal link is clicked', () => {
    render(
      <div>
        <TopNavigationProgress />
        <a href="/meals">Meals</a>
      </div>
    );

    const link = screen.getByText('Meals');
    act(() => {
      fireEvent.click(link);
    });

    // The progress bar container should now be visible in the document
    const progressBar = document.querySelector('[aria-hidden="true"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('does not trigger on external or hash links', () => {
    render(
      <div>
        <TopNavigationProgress />
        <a href="https://example.com" target="_blank" rel="noreferrer">External</a>
        <a href="#section">Hash</a>
      </div>
    );

    act(() => {
      fireEvent.click(screen.getByText('External'));
      fireEvent.click(screen.getByText('Hash'));
    });

    const progressBar = document.querySelector('[aria-hidden="true"]');
    expect(progressBar).toBeNull();
  });
});
