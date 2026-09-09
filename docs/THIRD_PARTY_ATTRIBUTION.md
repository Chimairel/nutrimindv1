# Third-Party Code Attribution Record

This document records third-party design components, primitives, and patterns adapted into the NutriMind repository in accordance with open-source license preservation requirements.

---

## 1. Motion Primitives (`ibelick/motion-primitives`)

- **Author / Originator**: ibelick
- **Upstream Repository**: [https://github.com/ibelick/motion-primitives](https://github.com/ibelick/motion-primitives)
- **Documentation**: [https://motion-primitives.com/docs](https://motion-primitives.com/docs)
- **License**: MIT License
- **License Notice**:
  ```text
  MIT License

  Copyright (c) 2024 ibelick

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  ```

### Adapted Components

#### A. `MotionActiveIndicator`
- **File**: `frontend/src/components/ui/motion/MotionActiveIndicator.tsx`
- **Pattern Reference**: [https://motion-primitives.com/docs/animated-background](https://motion-primitives.com/docs/animated-background)
- **Material Modifications**:
  - Simplified from a stateful child-cloning container into a small, presentational, caller-mounted active indicator.
  - Accepts a required caller-supplied `layoutId` and optional `className`.
  - Implemented strict `useReducedMotion()` bypass with `{ duration: 0 }` to honor accessibility preferences.
  - Contains no internal state, clones no children, and intercepts no click, hover, keyboard, or navigation handlers.
  - Preserves native keyboard navigation and remains `aria-hidden="true"` and `pointer-events-none`.

#### B. `AnimatedNumber`
- **File**: `frontend/src/components/ui/motion/AnimatedNumber.tsx`
- **Source URL**: `https://github.com/ibelick/motion-primitives/blob/main/components/core/animated-number.tsx`
- **Material Modifications**:
  - Replaced spring physics with a strictly monotonic cubic ease-out tween to ensure clinical values (calories, macros, weight) never overshoot, never show negative values, and never display transient inflated numbers.
  - Built dual-layer accessible DOM representation: stable, authoritative static text in a visually hidden `.sr-only` element, coupled with `aria-hidden="true"` on visual animated text to avoid spamming screen readers on each animation frame.
  - Implemented target-memoization to prevent spurious re-animations on window focus, route remounts, or identical cache revalidation.
  - Added immediate settle under `useReducedMotion()`.

#### C. `TextShimmer`
- **File**: `frontend/src/components/ui/motion/TextShimmer.tsx`
- **Source URL**: `https://github.com/ibelick/motion-primitives/blob/main/components/core/text-shimmer.tsx`
- **Material Modifications**:
  - Converted imports to React 19 and `motion/react`.
  - Enforced fully opaque gradient endpoints (`from-brand-text via-brand-accent to-brand-text`) for clinical legibility and contrast across all frames.
  - Added `useReducedMotion()` fallback rendering static text.

---

## 2. Watermelon UI (`WatermelonCorp/watermelon-platform`)

- **Author / Originator**: Watermelon Platform
- **Upstream Repository**: [https://github.com/WatermelonCorp/watermelon-platform](https://github.com/WatermelonCorp/watermelon-platform)
- **Catalog Reference**: [https://ui.watermelon.sh/developers](https://ui.watermelon.sh/developers) / `bionis-dashboard`
- **License**: MIT License
- **License Notice**:
  ```text
  MIT License

  Copyright (c) 2026 Watermelon Platform Contributors

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  ```

### Adapted Visual Patterns

*Note: NutriMind did not copy components or source code from Watermelon Platform. Only visual KPI card styling and subtle status dot presentation patterns were referenced.*

#### A. Metric Card & Subtle Status Dot Presentation
- **Files**: `frontend/src/components/ui/Badge.tsx`, `frontend/src/app/(nutritionist)/nutritionist/reviews/page.tsx`
- **Adapted Pattern**: Subtle status pills with decorative static dots for KPI and queue severity displays.
- **Material Modifications**:
  - Maintained 100% backward compatibility with NutriMind's existing `BadgeVariant` (`verified`, `pending`, `rejected`, `ai`, `user`).
  - Extended `Badge` with optional decorative static `dot?: boolean` (`aria-hidden="true"`).
  - Strictly rejected pulsing status dots in favor of persistent, high-contrast text and decorative static dots for clinical legibility.
  - Suppressed conflicting tone abstractions in favor of existing semantic variant mappings.