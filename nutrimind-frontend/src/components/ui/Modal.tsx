'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';

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
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Dark overlay with backdrop-blur support */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-all duration-300" />
        
        {/* Dialog Content styled as premium dark surface card with pop animation */}
        <Dialog.Content 
          className={`
            fixed left-[50%] top-[50%] z-50 w-[92vw] ${sizeClasses[size]} 
            translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-brand-border 
            bg-brand-surface p-6 shadow-2xl outline-none transition-all duration-300
          `}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-xl font-bold tracking-tight text-brand-text font-display">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-brand-muted">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              
              <Dialog.Close 
                className="rounded-lg p-1.5 text-brand-muted hover:bg-brand-border hover:text-brand-green transition-colors outline-none focus:ring-2 focus:ring-brand-green"
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>
            
            <div className="py-2 text-brand-text text-sm leading-relaxed">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-brand-border pt-4 mt-2">
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
