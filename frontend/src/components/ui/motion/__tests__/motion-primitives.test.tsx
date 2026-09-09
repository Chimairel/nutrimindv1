import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

import { AnimatedNumber, MotionActiveIndicator, TextShimmer } from '../index';
import Badge from '../../Badge';

const MockMotionDiv = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'> & {
    layoutId?: string;
    transition?: Record<string, unknown> | null;
  }
>(function MockMotionDiv({ layoutId, transition, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-testid="motion-div"
      data-layout-id={layoutId}
      data-transition-duration={transition?.duration !== undefined ? String(transition.duration) : undefined}
      data-transition-type={transition?.type}
      {...props}
    >
      {children}
    </div>
  );
});

// Mock motion/react to intercept useReducedMotion and truthfully expose motion.div props for verification
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    motion: new Proxy(actual.motion, {
      get(target, prop, receiver) {
        if (prop === 'div') {
          return MockMotionDiv;
        }
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import { useReducedMotion } from 'motion/react';

describe('Motion Primitives & Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  describe('AnimatedNumber', () => {
    it('provides a stable, authoritative screen-reader value using sr-only and aria-hidden', () => {
      render(<AnimatedNumber value={2150} format={(v) => `${Math.round(v)} kcal`} />);

      const container = screen.getByLabelText('2150 kcal');
      expect(container).toBeInTheDocument();

      const srOnlyText = container.querySelector('.sr-only');
      expect(srOnlyText).toHaveTextContent('2150 kcal');

      const ariaHiddenVisual = container.querySelector('[aria-hidden="true"]');
      expect(ariaHiddenVisual).toBeInTheDocument();
    });

    it('immediately settles to target value when reduced motion is preferred', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true);

      render(<AnimatedNumber value={1800} initial={0} format={(v) => `${Math.round(v)}`} />);

      const container = screen.getByLabelText('1800');
      expect(container).toBeInTheDocument();

      const visual = container.querySelector('[aria-hidden="true"]');
      expect(visual).toHaveTextContent('1800');
    });

    it('never overshoots or produces negative intermediate numbers', async () => {
      vi.useFakeTimers();

      const { rerender } = render(<AnimatedNumber value={100} duration={200} />);
      expect(screen.getByLabelText('100')).toBeInTheDocument();

      rerender(<AnimatedNumber value={50} duration={200} />);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const container = screen.getByLabelText('50');
      const visual = container.querySelector('[aria-hidden="true"]');
      const currentVal = parseInt(visual?.textContent ?? '0', 10);

      expect(currentVal).toBeGreaterThanOrEqual(50);
      expect(currentVal).toBeLessThanOrEqual(100);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('50');

      vi.useRealTimers();
    });

    it('does not re-animate if target value equals current value on cache revalidation or refocus', () => {
      const { rerender } = render(<AnimatedNumber value={2500} />);
      const visualBefore = screen.getByLabelText('2,500').querySelector('[aria-hidden="true"]')?.textContent;

      rerender(<AnimatedNumber value={2500} />);
      const visualAfter = screen.getByLabelText('2,500').querySelector('[aria-hidden="true"]')?.textContent;

      expect(visualBefore).toBe('2,500');
      expect(visualAfter).toBe('2,500');
    });
  });

  describe('MotionActiveIndicator', () => {
    it('passes caller-supplied layoutId unchanged to the motion element', () => {
      render(<MotionActiveIndicator layoutId="sidebar-active-nav-indicator" className="bg-brand-accent" />);

      const element = screen.getByTestId('motion-div');
      expect(element).toHaveAttribute('data-layout-id', 'sidebar-active-nav-indicator');
    });

    it('sets transition duration to 0 when reduced motion is preferred', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true);

      render(<MotionActiveIndicator layoutId="reduced-motion-indicator" />);

      const element = screen.getByTestId('motion-div');
      expect(element).toHaveAttribute('data-transition-duration', '0');
    });

    it('retains the default spring transition or a caller-supplied transition in normal mode', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false);

      const { rerender } = render(<MotionActiveIndicator layoutId="default-spring-indicator" />);
      let element = screen.getByTestId('motion-div');
      expect(element).toHaveAttribute('data-transition-type', 'spring');
      expect(element).toHaveAttribute('data-transition-duration', '0.35');

      rerender(
        <MotionActiveIndicator layoutId="custom-transition-indicator" transition={{ duration: 0.5, ease: 'easeOut' }} />
      );
      element = screen.getByTestId('motion-div');
      expect(element).toHaveAttribute('data-transition-duration', '0.5');
    });

    it('preserves aria-hidden="true", pointer-events-none, and caller-supplied classes', () => {
      render(
        <MotionActiveIndicator layoutId="accessible-indicator" className="rounded-2xl bg-brand-accent shadow-neon" />
      );

      const element = screen.getByTestId('motion-div');
      expect(element).toHaveAttribute('aria-hidden', 'true');
      expect(element).toHaveClass('pointer-events-none');
      expect(element).toHaveClass('absolute');
      expect(element).toHaveClass('inset-0');
      expect(element).toHaveClass('rounded-2xl');
      expect(element).toHaveClass('bg-brand-accent');
      expect(element).toHaveClass('shadow-neon');
    });
  });

  describe('TextShimmer', () => {
    it('renders fully opaque gradient text classes for clinical readability', () => {
      render(<TextShimmer>Validating ingredients and estimates...</TextShimmer>);

      const text = screen.getByText('Validating ingredients and estimates...');
      expect(text).toBeInTheDocument();
      expect(text).toHaveClass('from-brand-text');
      expect(text).toHaveClass('via-brand-accent');
      expect(text).toHaveClass('to-brand-text');
    });

    it('renders static text when reduced motion is preferred', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true);

      render(<TextShimmer>Preparing your nutrition profile</TextShimmer>);

      const text = screen.getByText('Preparing your nutrition profile');
      expect(text).toBeInTheDocument();
      expect(text.tagName.toLowerCase()).toBe('span');
    });
  });

  describe('Badge Component', () => {
    it('preserves all public BadgeVariant styles and default text', () => {
      const { rerender } = render(<Badge variant="verified" />);
      expect(screen.getByText('Verified')).toBeInTheDocument();

      rerender(<Badge variant="pending" />);
      expect(screen.getByText('Pending Review')).toBeInTheDocument();

      rerender(<Badge variant="rejected" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();

      rerender(<Badge variant="ai" />);
      expect(screen.getByText('AI Generated')).toBeInTheDocument();

      rerender(<Badge variant="user" />);
      expect(screen.getByText('You logged')).toBeInTheDocument();
    });

    it('renders decorative static dot and suppresses the variant icon when dot=true', () => {
      const { container } = render(
        <Badge variant="verified" dot>
          SAFE
        </Badge>
      );

      expect(screen.getByText('SAFE')).toBeInTheDocument();
      const dot = container.querySelector('span.rounded-full.bg-current');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('aria-hidden', 'true');

      // The Check icon svg should not be rendered when dot is true
      const svgIcon = container.querySelector('svg');
      expect(svgIcon).not.toBeInTheDocument();
    });

    it('renders variant icon when dot is false or omitted', () => {
      const { container } = render(<Badge variant="verified">SAFE</Badge>);

      const svgIcon = container.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
    });
  });
});
