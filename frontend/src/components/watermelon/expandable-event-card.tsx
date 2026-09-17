'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ExpandableCardProps {
  imageSrc?: string;
  title?: string;
  description?: string;
  content?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function ExpandableEventCard({
  imageSrc = 'https://assets.watermelon.sh/event.avif',
  title = 'Neon Nights Festival',
  description = 'Experience the ultimate electronic music festival with top DJs and immersive visual arts.',
  content,
  children,
  className = '',
}: ExpandableCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const layoutId = `expandable-event-card-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <>
      <motion.div
        layoutId={layoutId}
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer overflow-hidden rounded-2xl bg-brand-surface border border-brand-border/70 hover:border-brand-green/30 transition-colors group shadow-card ${className}`}
      >
        <motion.div layoutId={`image-container-${layoutId}`} className="relative h-48 w-full overflow-hidden">
          {imageSrc && (
            <motion.img
              layoutId={`image-${layoutId}`}
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </motion.div>
        <div className="p-4 sm:p-5">
          <motion.h3
            layoutId={`title-${layoutId}`}
            className="text-base font-bold font-display tracking-tight text-brand-text mb-1"
          >
            {title}
          </motion.h3>
          <motion.p layoutId={`desc-${layoutId}`} className="text-brand-muted text-xs tracking-wide line-clamp-2">
            {description}
          </motion.p>
          {children}
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              layoutId={layoutId}
              className="relative w-full max-w-2xl bg-brand-surface rounded-3xl overflow-hidden border border-brand-border/80 z-10 flex flex-col shadow-2xl max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center bg-black/60 hover:bg-black/80 rounded-full border border-white/20 text-white transition-colors backdrop-blur-md"
                aria-label="Close modal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <motion.div
                layoutId={`image-container-${layoutId}`}
                className="relative h-56 sm:h-72 w-full overflow-hidden shrink-0"
              >
                {imageSrc && (
                  <motion.img
                    layoutId={`image-${layoutId}`}
                    src={imageSrc}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                )}
              </motion.div>

              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                <motion.h3
                  layoutId={`title-${layoutId}`}
                  className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-brand-text mb-2"
                >
                  {title}
                </motion.h3>
                <motion.p
                  layoutId={`desc-${layoutId}`}
                  className="text-brand-green text-xs font-semibold tracking-wide uppercase mb-6"
                >
                  {description}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0, delay: 0.1 }}
                  className="text-brand-text/90 text-sm leading-relaxed"
                >
                  {content}
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
