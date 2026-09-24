'use client';

import React from 'react';
import { useTheme } from '@/lib/context/ThemeContext';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ position = 'bottom-right', ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={(theme as ToasterProps['theme']) || 'system'}
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-brand-surface group-[.toaster]:text-brand-text group-[.toaster]:border-brand-border group-[.toaster]:shadow-card-lg group-[.toaster]:rounded-2xl',
          description: 'group-[.toast]:text-brand-muted',
          actionButton: 'group-[.toast]:bg-brand-green group-[.toast]:text-brand-black group-[.toast]:font-semibold',
          cancelButton: 'group-[.toast]:bg-brand-bgAlt group-[.toast]:text-brand-muted',
        },
      }}
      {...props}
    />
  );
};

export { toast };
export default Toaster;
