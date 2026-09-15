import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import KainaraLogo from './KainaraLogo';

describe('KainaraLogo', () => {
  it('renders with accessible role and default aria-label', () => {
    render(<KainaraLogo />);
    const logo = screen.getByRole('img', { name: 'KAINARA logo' });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('viewBox', '290 318 450 450');
  });

  it('renders multicolor variant by default with authentic brand palette', () => {
    const { container } = render(<KainaraLogo />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(5);
    expect(paths[0]).toHaveAttribute('fill', '#fbf8f1'); // Cream highlight
    expect(paths[1]).toHaveAttribute('fill', '#264741'); // Deep Emerald hair
    expect(paths[2]).toHaveAttribute('fill', '#efb48a'); // Peach skin
    expect(paths[3]).toHaveAttribute('fill', '#f7a249'); // Mango gold
    expect(paths[4]).toHaveAttribute('fill', '#e05f46'); // Coral terracotta
  });

  it('renders gradient variant with SVG defs and linearGradient', () => {
    const { container } = render(<KainaraLogo variant="gradient" />);
    const defs = container.querySelector('defs');
    const linearGradient = container.querySelector('linearGradient');
    const paths = container.querySelectorAll('path');

    expect(defs).toBeInTheDocument();
    expect(linearGradient).toBeInTheDocument();
    expect(paths).toHaveLength(5);

    const gradId = linearGradient?.getAttribute('id');
    expect(gradId).toMatch(/^kainara-logo-grad-/);
    expect(paths[1]?.getAttribute('fill')).toBe(`url(#${gradId})`);

    const stops = container.querySelectorAll('stop');
    expect(stops).toHaveLength(3);
    expect(stops[0]).toHaveStyle({ stopColor: 'var(--kainara-logo-grad-start, #08705b)' });
  });

  it('renders solid variant with currentColor fill and no defs', () => {
    const { container } = render(<KainaraLogo variant="solid" className="text-emerald-600" />);
    const defs = container.querySelector('defs');
    const paths = container.querySelectorAll('path');

    expect(defs).not.toBeInTheDocument();
    expect(paths).toHaveLength(5);
    expect(paths[1]?.getAttribute('fill')).toBe('currentColor');
  });

  it('applies string size classes correctly', () => {
    const { container: smContainer } = render(<KainaraLogo size="sm" />);
    const smSvg = smContainer.querySelector('svg');
    expect(smSvg?.className.baseVal || smSvg?.className).toContain('h-5 w-5');

    const { container: lgContainer } = render(<KainaraLogo size="lg" />);
    const lgSvg = lgContainer.querySelector('svg');
    expect(lgSvg?.className.baseVal || lgSvg?.className).toContain('h-8 w-8');
  });

  it('applies numeric width and height when size is a number', () => {
    const { container } = render(<KainaraLogo size={40} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('40');
    expect(svg?.getAttribute('height')).toBe('40');
  });

  it('allows custom aria-label', () => {
    render(<KainaraLogo ariaLabel="Custom Brand Mark" />);
    expect(screen.getByRole('img', { name: 'Custom Brand Mark' })).toBeInTheDocument();
  });
});
