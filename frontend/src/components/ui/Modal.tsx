'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  const descriptionId = React.useId();
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#020806]/75 backdrop-blur-md transition-all duration-300" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          className={`
            fixed left-1/2 top-1/2 z-50 w-[92vw] ${sizeClasses[size]}
            max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px]
            border border-brand-border bg-brand-surface p-6 text-brand-text shadow-card-lg
            outline-none transition-all duration-300
          `}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-5">
              <div>
                <Dialog.Title className="font-display text-xl font-bold tracking-tight text-brand-text">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description id={descriptionId} className="mt-1 text-sm leading-relaxed text-brand-muted">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-bgAlt text-brand-muted outline-none transition-colors hover:border-brand-green hover:text-brand-green focus:ring-2 focus:ring-brand-green/30"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <div className="py-2 text-sm leading-relaxed text-brand-text">{children}</div>
            {footer && (
              <div className="mt-2 flex items-center justify-end gap-3 border-t border-brand-border pt-4">
                {footer}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
