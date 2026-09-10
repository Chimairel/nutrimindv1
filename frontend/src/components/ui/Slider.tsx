'use client';

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    {
      className = '',
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
      'aria-describedby': describedBy,
      ...props
    },
    ref
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      className={`relative flex w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${className}`}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full border border-brand-border/70 bg-brand-bgAlt shadow-inner">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-brand-green via-brand-accent to-brand-cyan" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
          aria-describedby={describedBy}
          className="block h-7 w-7 rounded-full border-[3px] border-brand-surface bg-brand-accent shadow-[0_4px_14px_rgba(91,214,121,0.38)] outline-none ring-brand-green transition-[transform,box-shadow] duration-150 hover:scale-110 focus-visible:ring-4 focus-visible:ring-brand-green/25 disabled:pointer-events-none motion-reduce:transition-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
);

Slider.displayName = SliderPrimitive.Root.displayName;

export default Slider;
