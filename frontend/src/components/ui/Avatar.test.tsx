import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Avatar from './Avatar';

describe('Avatar', () => {
  beforeEach(() => {
    vi.spyOn(window.Image.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      setTimeout(() => {
        this.dispatchEvent(new Event('load'));
      }, 10);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the salakot hat overlay when showSalakot is true', () => {
    const { container } = render(<Avatar fallbackText="Juan Dela Cruz" showSalakot={true} />);

    const salakotImg = container.querySelector('img[src="/icons/salakot.svg"]');
    expect(salakotImg).toBeInTheDocument();
    expect(salakotImg).toHaveClass('pointer-events-none');
    expect(salakotImg).toHaveClass('absolute');
  });

  it('omits the salakot overlay by default when showSalakot is false or omitted', () => {
    const { container } = render(<Avatar fallbackText="Maria Clara" />);

    const salakotImg = container.querySelector('img[src="/icons/salakot.svg"]');
    expect(salakotImg).not.toBeInTheDocument();
  });

  it('renders fallback initials when src is "default" or null', () => {
    render(<Avatar src="default" fallbackText="Pacaldo Chimairel" />);

    expect(screen.getByText('PC')).toBeInTheDocument();
  });

  it('renders DiceBear open-peeps URL when given a Filipino name preset seed', async () => {
    const { container } = render(<Avatar src="Bedic" fallbackText="Bedic Pacaldo" />);

    await waitFor(() => {
      const img = container.querySelector('img[src*="seed=Bedic"]');
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute('src')).toContain('dicebear.com/10.x/open-peeps/svg');
    });
  });

  it('renders custom configured URL for Chimay preset', async () => {
    const { container } = render(<Avatar src="Chimay" fallbackText="Chimay Pacaldo" />);

    await waitFor(() => {
      const img = container.querySelector('img[src*="headVariant=dreads2"]');
      expect(img).toBeInTheDocument();
    });
  });

  it('renders external image directly when given an http/https URL', async () => {
    const googlePhoto = 'https://lh3.googleusercontent.com/a/test-profile-photo';
    const { container } = render(<Avatar src={googlePhoto} fallbackText="Google User" />);

    await waitFor(() => {
      const img = container.querySelector('img[src="' + googlePhoto + '"]');
      expect(img).toBeInTheDocument();
    });
  });
});
