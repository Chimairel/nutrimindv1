'use client';

import React, { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input';

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type'>;

interface SelectionSnapshot {
  start: number | null;
  end: number | null;
  direction: 'forward' | 'backward' | 'none' | null;
  hadFocus: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', disabled, label, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const selectionSnapshotRef = useRef<SelectionSnapshot | null>(null);
    const selectionRestoreFrameRef = useRef<number | null>(null);
    const accessibleLabel = isVisible ? 'Hide password' : 'Show password';

    const setInputRef = useCallback(
      (input: HTMLInputElement | null) => {
        inputRef.current = input;

        if (typeof ref === 'function') {
          ref(input);
        } else if (ref) {
          ref.current = input;
        }
      },
      [ref]
    );

    const captureSelection = () => {
      const input = inputRef.current;

      selectionSnapshotRef.current = input
        ? {
            start: input.selectionStart,
            end: input.selectionEnd,
            direction: input.selectionDirection,
            hadFocus: document.activeElement === input,
          }
        : null;
    };

    const handleVisibilityToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 || !selectionSnapshotRef.current) {
        captureSelection();
      }

      setIsVisible((visible) => !visible);
    };

    useLayoutEffect(() => {
      const input = inputRef.current;
      const snapshot = selectionSnapshotRef.current;

      if (!input || !snapshot) return;

      const restoreSelection = () => {
        if (snapshot.hadFocus && document.activeElement !== input) {
          input.focus({ preventScroll: true });
        }

        if (snapshot.start !== null && snapshot.end !== null) {
          input.setSelectionRange(
            snapshot.start,
            snapshot.end,
            snapshot.direction ?? undefined
          );
        }
      };

      restoreSelection();
      selectionRestoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreSelection();
        selectionSnapshotRef.current = null;
        selectionRestoreFrameRef.current = null;
      });

      return () => {
        if (selectionRestoreFrameRef.current !== null) {
          window.cancelAnimationFrame(selectionRestoreFrameRef.current);
          selectionRestoreFrameRef.current = null;
        }
      };
    }, [isVisible]);

    return (
      <div className="relative w-full">
        <Input
          ref={setInputRef}
          {...props}
          label={label}
          type={isVisible ? 'text' : 'password'}
          disabled={disabled}
          className={`pr-14 ${className}`}
        />
        <button
          type="button"
          aria-label={accessibleLabel}
          aria-pressed={isVisible}
          disabled={disabled}
          onPointerDown={(event) => {
            captureSelection();
            event.preventDefault();
          }}
          onPointerCancel={() => {
            selectionSnapshotRef.current = null;
          }}
          onClick={handleVisibilityToggle}
          className={`absolute right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-muted transition-colors hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bgAlt disabled:cursor-not-allowed disabled:opacity-40 ${
            label ? 'top-7' : 'top-1'
          }`}
        >
          {isVisible ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
