'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, FlipHorizontal } from 'lucide-react';
import Button from '@/components/ui/Button';

interface LiveWebcamCaptureProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  error?: string;
}

export function LiveWebcamCapture({ value, onChange, error }: LiveWebcamCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Check if camera devices exist on mount
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setHasCamera(false);
      return;
    }

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasCamera(videoInputs.length > 0);
      })
      .catch(() => {
        setHasCamera(false);
      });
  }, []);

  const handleUserMedia = useCallback(() => {
    setCameraError(null);
    setHasCamera(true);
  }, []);

  const handleUserMediaError = useCallback((err: string | DOMException) => {
    const msg = typeof err === 'string' ? err : err.message || 'Camera permission denied.';
    setCameraError(msg);
  }, []);

  const processAndCompress = useCallback(
    (rawScreenshot: string) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onChange(rawScreenshot);
          setIsCapturing(false);
          return;
        }

        // Center crop to 1:1 square
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const compressed = canvas.toDataURL('image/jpeg', 0.88);
        onChange(compressed);
        setIsCapturing(false);
      };
      img.onerror = () => {
        onChange(rawScreenshot);
        setIsCapturing(false);
      };
      img.src = rawScreenshot;
    },
    [onChange]
  );

  const takeSnapshot = useCallback(() => {
    if (!webcamRef.current) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (screenshot) {
      processAndCompress(screenshot);
    }
  }, [processAndCompress]);

  const startCountdownAndSnap = useCallback(() => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          takeSnapshot();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [takeSnapshot]);

  const retake = useCallback(() => {
    onChange('');
    setCameraError(null);
  }, [onChange]);

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // 1. Photo Already Confirmed
  if (value) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-text">
            Official Clinical Headshot <span className="text-status-error-text">*</span>
          </label>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Live Verified
          </span>
        </div>

        <div className="surface-card flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl border border-brand-green/30 bg-brand-green/5">
          <div className="relative h-28 w-28 shrink-0 rounded-full overflow-hidden border-2 border-brand-green shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Live captured clinical headshot" className="h-full w-full object-cover" />
            <div className="absolute bottom-1 right-1 rounded-full bg-brand-green p-1 text-white shadow">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
            <h4 className="text-sm font-bold text-brand-text flex items-center justify-center sm:justify-start gap-1.5">
              Live Photo Captured &amp; Verified
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              This photo will be displayed on your verified meal credentials. Once your application is approved by Admin,
              this official verification photo is locked and cannot be changed.
            </p>
            <div className="pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={retake} className="text-xs font-bold">
                <RefreshCw className="h-3 w-3 mr-1" /> Retake Photo
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Live Camera Viewfinder
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-brand-text">
          Official Clinical Headshot (Live Webcam) <span className="text-status-error-text">*</span>
        </label>
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Camera className="h-3 w-3" /> Live Capture Only
        </span>
      </div>

      <div className="surface-card relative flex flex-col items-center rounded-2xl border border-brand-border p-4 sm:p-6 overflow-hidden bg-black/40">
        {cameraError || hasCamera === false ? (
          <div className="p-6 text-center space-y-3 max-w-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-error-bg/20 text-status-error-text">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-brand-text">Camera Access Required</h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              KAINARA enforces mandatory live biometric verification for Registered Nutritionist-Dietitians. Photo file
              uploads are disabled to prevent identity theft and maintain clinical authenticity.
            </p>
            <p className="text-[11px] font-semibold text-amber-500">
              Please enable camera permissions in your browser or switch to a device with a webcam to continue.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCameraError(null);
                setHasCamera(true);
              }}
              className="text-xs font-bold mt-2"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Try Camera Again
            </Button>
          </div>
        ) : (
          <div className="relative w-full max-w-sm flex flex-col items-center">
            {/* Viewfinder Container */}
            <div className="relative h-64 w-64 sm:h-72 sm:w-72 rounded-full overflow-hidden border-4 border-dashed border-emerald-500/70 bg-black shadow-inner flex items-center justify-center">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 480,
                  height: 480,
                  facingMode,
                }}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className="h-full w-full object-cover"
                mirrored={facingMode === 'user'}
              />

              {/* Viewfinder Circular Face Alignment Guide */}
              <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/30" />

              {/* Live Countdown Overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                  <span className="font-display font-black text-6xl text-white animate-ping">
                    {countdown}
                  </span>
                </div>
              )}
            </div>

            {/* Viewfinder Guidance & Controls */}
            <p className="mt-3 text-xs text-brand-muted text-center font-medium">
              Center your face and shoulders within the circle.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <Button
                type="button"
                onClick={startCountdownAndSnap}
                disabled={isCapturing || countdown !== null}
                className="font-bold text-xs px-5 py-2.5 flex items-center gap-2 shadow-md bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Camera className="h-4 w-4" />
                {countdown !== null ? 'Snapping...' : 'Snap Live Photo'}
              </Button>

              <button
                type="button"
                onClick={toggleCamera}
                title="Switch Camera"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-white/5 text-brand-muted hover:text-white transition"
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-status-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

export default LiveWebcamCapture;
