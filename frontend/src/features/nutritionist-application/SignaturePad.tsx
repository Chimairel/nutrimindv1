'use client';

import React, { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, PenTool, ShieldCheck, CheckCircle2, RotateCcw, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  error?: string;
}

export function SignaturePad({ value, onChange, error }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const isConfirmed = Boolean(value);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const alignDrawingCoordinates = useCallback(() => {
    const canvas = sigRef.current?.getCanvas();
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width && bounds.height) {
      // The fixed bitmap survives resizing; pointer coordinates are measured in CSS pixels.
      canvas.getContext('2d')?.setTransform(canvas.width / bounds.width, 0, 0, canvas.height / bounds.height, 0, 0);
    }
  }, []);

  const handleBegin = useCallback(() => {
    setCaptureError(null);
    setHasDrawn(true);
  }, []);

  const handleStrokeEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setHasDrawn(true);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      try {
        // Export directly: the wrapper's trim-canvas ESM interop can throw before onChange.
        const dataUrl = sigRef.current.getCanvas().toDataURL('image/png');
        if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Empty image');
        onChange(dataUrl);
        setCaptureError(null);
      } catch {
        setCaptureError('Your signature could not be saved. Please tap Confirm Signature again.');
      }
    } else {
      setHasDrawn(false);
      setCaptureError('Draw your signature before confirming it.');
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    if (sigRef.current) {
      sigRef.current.clear();
    }
    setHasDrawn(false);
    setCaptureError(null);
    onChange('');
  }, [onChange]);

  const handleRedraw = useCallback(() => {
    setCaptureError(null);
    setHasDrawn(false);
    onChange('');
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-brand-text">
          Digital Handwritten Signature <span className="text-status-error-text">*</span>
        </label>
        {isConfirmed && value ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Signature Confirmed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
            <PenTool className="h-3 w-3" /> Draw with Finger / Mouse
          </span>
        )}
      </div>

      {isConfirmed && value ? (
        /* Confirmed & Locked View — immune to canvas resize and keyboard shifts */
        <div className="surface-card relative rounded-2xl border border-emerald-500/30 p-4 bg-black/40 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Signature Confirmed & Locked
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRedraw}
              className="text-xs font-bold text-slate-300 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear & Redraw
            </Button>
          </div>

          <div className="relative w-full h-36 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Confirmed Digital Handwritten Signature"
              className="max-h-28 max-w-full object-contain filter drop-shadow-[0_2px_8px_rgba(52,211,153,0.35)]"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-brand-muted">
            <p className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Locked to your application to certify medical accountability.</span>
            </p>
            <span className="text-[10px] font-mono text-brand-muted shrink-0">PNG Certified</span>
          </div>
        </div>
      ) : (
        /* Interactive Drawing Pad */
        <div className="surface-card relative rounded-2xl border border-brand-border p-4 bg-black/40 overflow-hidden">
          <div
            className="relative w-full h-36 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden touch-none"
            onMouseDownCapture={alignDrawingCoordinates}
            onTouchStartCapture={alignDrawingCoordinates}
          >
            <SignatureCanvas
              ref={sigRef}
              clearOnResize={false}
              penColor="#34d399"
              backgroundColor="rgba(0,0,0,0)"
              canvasProps={{
                width: 900,
                height: 360,
                className: 'w-full h-full cursor-crosshair select-none',
                style: { width: '100%', height: '100%' },
                'aria-label': 'Digital signature drawing pad',
              }}
              onBegin={handleBegin}
              onEnd={handleStrokeEnd}
            />

            {!hasDrawn && (
              <div className="pointer-events-none absolute inset-x-8 bottom-8 flex flex-col items-center">
                <div className="w-full border-b border-dashed border-white/20" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/30 mt-1">
                  Sign above line with finger or mouse
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-brand-muted leading-relaxed flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Sign your name, then tap Confirm Signature.</span>
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!hasDrawn}
                className="text-xs font-bold text-slate-400 hover:text-white shrink-0"
              >
                <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!hasDrawn}
                className="text-xs font-bold shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Confirm Signature
              </Button>
            </div>
          </div>
        </div>
      )}

      {(captureError || error) && (
        <p role="alert" className="text-xs font-semibold text-status-error-text">
          {captureError || error}
        </p>
      )}
    </div>
  );
}

export default SignaturePad;
