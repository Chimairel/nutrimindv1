'use client';

import React, { useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, PenTool, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  error?: string;
}

export function SignaturePad({ value, onChange, error }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const trimmedCanvas = sigRef.current.getTrimmedCanvas();
      const dataUrl = trimmedCanvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    if (sigRef.current) {
      sigRef.current.clear();
    }
    onChange('');
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-brand-text">
          Digital Handwritten Signature <span className="text-status-error-text">*</span>
        </label>
        {value ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Signature Saved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
            <PenTool className="h-3 w-3" /> Draw with Finger / Mouse
          </span>
        )}
      </div>

      <div className="surface-card relative rounded-2xl border border-brand-border p-4 bg-black/40 overflow-hidden">
        {/* Interactive Canvas */}
        <div className="relative w-full h-36 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
          <SignatureCanvas
            ref={sigRef}
            penColor="#34d399"
            backgroundColor="rgba(0,0,0,0)"
            canvasProps={{
              className: 'w-full h-full cursor-crosshair select-none',
              style: { width: '100%', height: '100%' },
              'aria-label': 'Digital signature drawing pad',
            }}
            onEnd={handleEnd}
          />

          {/* Guide Line and Placeholder if Empty */}
          {!value && (
            <div className="pointer-events-none absolute inset-x-8 bottom-8 flex flex-col items-center">
              <div className="w-full border-b border-dashed border-white/20" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/30 mt-1">
                Sign above line
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions & Clinical Disclaimer */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-brand-muted leading-relaxed flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Used on verified meal plans to certify medical accountability.</span>
          </p>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs font-bold text-slate-400 hover:text-white shrink-0"
          >
            <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-status-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

export default SignaturePad;
