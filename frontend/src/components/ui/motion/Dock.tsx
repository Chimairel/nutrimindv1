'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  type HTMLMotionProps,
  AnimatePresence,
  useReducedMotion,
} from 'motion/react';

export type DockDirection = 'horizontal' | 'vertical';

export interface DockContextType {
  mousePos: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  baseSize: number;
  distance: number;
  direction: DockDirection;
  isReducedMotion: boolean;
}

const DockContext = createContext<DockContextType | undefined>(undefined);

export function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDock must be used within a DockProvider');
  }
  return context;
}

export interface DockProps {
  children: React.ReactNode;
  className?: string;
  direction?: DockDirection;
  distance?: number;
  baseSize?: number;
  magnification?: number;
  spring?: SpringOptions;
  role?: string;
  ariaLabel?: string;
}

export interface DockItemProps extends HTMLMotionProps<'div'> {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export interface DockLabelProps {
  className?: string;
  children: React.ReactNode;
}

export interface DockIconProps {
  className?: string;
  children: React.ReactNode;
}

export function Dock({
  children,
  className = '',
  direction = 'horizontal',
  spring = { mass: 0.08, stiffness: 300, damping: 16 },
  magnification = 58,
  baseSize = 40,
  distance = 130,
  role = 'toolbar',
  ariaLabel = 'Application dock',
}: DockProps) {
  const mousePos = useMotionValue(Infinity);
  const shouldReduceMotion = useReducedMotion();
  const isReducedMotion = Boolean(shouldReduceMotion);

  return (
    <nav
      onMouseEnter={(e) => {
        if (!isReducedMotion) {
          mousePos.set(direction === 'vertical' ? e.clientY : e.clientX);
        }
      }}
      onMouseMove={(e) => {
        if (!isReducedMotion) {
          mousePos.set(direction === 'vertical' ? e.clientY : e.clientX);
        }
      }}
      onMouseLeave={() => {
        mousePos.set(Infinity);
      }}
      onTouchMove={(e) => {
        if (!isReducedMotion && e.touches[0]) {
          mousePos.set(direction === 'vertical' ? e.touches[0].clientY : e.touches[0].clientX);
        }
      }}
      onTouchEnd={() => {
        mousePos.set(Infinity);
      }}
      className={`flex select-none ${
        direction === 'vertical' ? 'flex-col items-center gap-1.5' : 'flex-row items-end gap-1.5'
      } ${className}`}
      role={role}
      aria-label={ariaLabel}
    >
      <DockContext.Provider
        value={{
          mousePos,
          spring,
          distance,
          magnification,
          baseSize,
          direction,
          isReducedMotion,
        }}
      >
        {children}
      </DockContext.Provider>
    </nav>
  );
}

export interface DockItemContextType {
  size: MotionValue<number>;
  isHovered: MotionValue<number>;
}

const DockItemContext = createContext<DockItemContextType | undefined>(undefined);

export function useDockItem() {
  return useContext(DockItemContext);
}

export function DockItem({ children, className = '', onClick, active = false, ...props }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, baseSize, mousePos, spring, direction, isReducedMotion } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mousePos, (val) => {
    if (isReducedMotion || val === Infinity) return Infinity;
    const domRect = ref.current?.getBoundingClientRect();
    if (!domRect) return Infinity;
    if (direction === 'vertical') {
      return val - (domRect.y + domRect.height / 2);
    }
    return val - (domRect.x + domRect.width / 2);
  });

  const sizeTransform = useTransform(mouseDistance, [-distance, 0, distance], [baseSize, magnification, baseSize]);

  const size = useSpring(sizeTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={isReducedMotion ? { width: baseSize, height: baseSize } : { width: size, height: size }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      data-active={active ? 'true' : undefined}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${className}`}
      onClick={onClick}
      {...props}
    >
      <DockItemContext.Provider value={{ size, isHovered }}>{children}</DockItemContext.Provider>
    </motion.div>
  );
}

export function DockIcon({ children, className = '', ...rest }: DockIconProps) {
  const restProps = rest as Record<string, unknown>;
  const itemCtx = useDockItem();
  const size = (restProps['size'] as MotionValue<number> | undefined) ?? itemCtx?.size;
  const defaultSize = useMotionValue(36);

  const iconScale = useTransform(size ?? defaultSize, (val) => Math.max(14, Math.round(val * 0.44)));

  return (
    <motion.div
      style={size ? { width: iconScale, height: iconScale } : undefined}
      className={`flex items-center justify-center shrink-0 [&>svg]:h-full [&>svg]:w-full ${className}`}
    >
      {children}
    </motion.div>
  );
}

export interface DockAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function DockAvatar({ children, className = '', ...props }: DockAvatarProps) {
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-visible ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DockLabel({ children, className = '', ...rest }: DockLabelProps) {
  const { direction } = useDock();
  const restProps = rest as Record<string, unknown>;
  const itemCtx = useDockItem();
  const isHovered = (restProps['isHovered'] as MotionValue<number> | undefined) ?? itemCtx?.isHovered;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  const placementStyles =
    direction === 'vertical' ? 'left-full top-1/2 -translate-y-1/2 ml-3' : '-top-9 left-1/2 -translate-x-1/2';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.9,
            ...(direction === 'vertical' ? { x: -4 } : { y: 4 }),
          }}
          animate={{
            opacity: 1,
            scale: 1,
            ...(direction === 'vertical' ? { x: 0 } : { y: 0 }),
          }}
          exit={{
            opacity: 0,
            scale: 0.9,
            ...(direction === 'vertical' ? { x: -4 } : { y: 4 }),
          }}
          transition={{ duration: 0.15 }}
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-white/10 bg-[#17201d]/95 px-2.5 py-1 font-display text-[11px] font-semibold tracking-tight text-white shadow-[0_12px_34px_rgba(0,0,0,0.38)] backdrop-blur-xl ${placementStyles} ${className}`}
          role="tooltip"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Dock;
